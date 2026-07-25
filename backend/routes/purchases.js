const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { getProvider, listProviders } = require('../utils/payments');
const { watermarkPdf } = require('../utils/watermark');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Construit un header Content-Disposition sûr pour des titres contenant des
// accents ou caractères spéciaux (obligatoire, sinon Node lève ERR_INVALID_CHAR).
function contentDisposition(type, title) {
  const ascii = title.replace(/[^\x20-\x7E]/g, '').replace(/["]/g, '') || 'cahier';
  const encoded = encodeURIComponent(`${title}.pdf`);
  return `${type}; filename="${ascii}.pdf"; filename*=UTF-8''${encoded}`;
}

router.get('/payment-methods', (req, res) => res.json(listProviders()));

// ---------- ACHAT ----------
// Etape 1: creer la transaction "pending" + initier le paiement chez le provider.
// Le cahier n'est JAMAIS debloque a cette etape.
router.post('/', authRequired, async (req, res) => {
  const { bookId, paymentMethod, phone } = req.body;
  const book = db.prepare("SELECT * FROM books WHERE id = ? AND status = 'published'").get(bookId);
  if (!book) return res.status(404).json({ error: 'Cahier introuvable.' });
  if (book.is_free) return res.status(400).json({ error: 'Ce cahier est gratuit, aucun achat requis.' });

  // Empeche un double achat actif du meme cahier
  const already = db.prepare(
    "SELECT * FROM purchases WHERE user_id = ? AND book_id = ? AND status IN ('success','pending')"
  ).get(req.user.id, bookId);
  if (already && already.status === 'success') {
    return res.status(409).json({ error: 'Vous possédez déjà ce cahier.', purchaseId: already.id });
  }

  const purchaseId = already ? already.id : uuid();
  const provider = getProvider(paymentMethod);

  try {
    const result = await provider.initiate({ amount: book.price, phone, reference: purchaseId });
    if (!already) {
      db.prepare(`INSERT INTO purchases (id,user_id,book_id,amount,payment_method,payment_reference,status)
        VALUES (?,?,?,?,?,?,?)`)
        .run(purchaseId, req.user.id, bookId, book.price, paymentMethod, result.providerReference, 'pending');
    } else {
      db.prepare('UPDATE purchases SET payment_reference = ?, status = ? WHERE id = ?')
        .run(result.providerReference, 'pending', purchaseId);
    }
    logActivity(req.user.id, `A initié l'achat du cahier "${book.title}"`, purchaseId);
    res.status(201).json({ purchaseId, status: 'pending', message: result.message });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Le service de paiement est momentanément indisponible.' });
  }
});

// Etape 2: le client (ou une tache periodique) verifie le statut reel aupres du provider.
// Le deblocage du cahier ne se fait QUE si le provider confirme "success" — jamais sur
// simple declaration/capture d'ecran de l'utilisateur.
router.post('/:id/confirm', authRequired, async (req, res) => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!purchase) return res.status(404).json({ error: 'Transaction introuvable.' });
  if (purchase.status === 'success') return res.json({ status: 'success' });
  if (purchase.status !== 'pending') return res.status(409).json({ error: `Transaction ${purchase.status}.` });

  const provider = getProvider(purchase.payment_method);
  const result = await provider.checkStatus(purchase.payment_reference);

  if (result.status === 'success') {
    db.prepare("UPDATE purchases SET status = 'success', confirmed_at = datetime('now') WHERE id = ?").run(purchase.id);
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(purchase.book_id);
    logActivity(req.user.id, `Paiement confirmé pour "${book.title}"`, purchase.id);
  } else if (result.status === 'failed') {
    db.prepare("UPDATE purchases SET status = 'failed' WHERE id = ?").run(purchase.id);
  }
  res.json({ status: result.status });
});

// ---------- BIBLIOTHEQUE ----------
router.get('/library', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id as purchase_id, p.status, p.download_count, p.created_at as purchased_at,
           b.id as book_id, b.title, b.author, b.level, b.series, b.cover_path
    FROM purchases p JOIN books b ON b.id = p.book_id
    WHERE p.user_id = ? AND p.status = 'success'
    ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(rows.map((r) => ({
    purchaseId: r.purchase_id,
    bookId: r.book_id,
    title: r.title,
    author: r.author,
    level: r.level,
    series: r.series,
    coverUrl: r.cover_path ? `/files/covers/${path.basename(r.cover_path)}` : null,
    downloadCount: r.download_count,
    purchasedAt: r.purchased_at,
  })));
});

router.get('/history', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, b.title FROM purchases p JOIN books b ON b.id = p.book_id
    WHERE p.user_id = ? ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// ---------- TELECHARGEMENT SECURISE ----------
// Genere un lien temporaire (JWT courte duree) plutot que d'exposer l'URL du fichier.
router.get('/:bookId/download-link', authRequired, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Cahier introuvable.' });

  if (book.is_free) {
    if (!book.downloads_enabled) return res.status(403).json({ error: 'Téléchargement désactivé pour ce cahier.' });
    const token = jwt.sign({ bookId: book.id, kind: 'free' }, JWT_SECRET, { expiresIn: '10m' });
    return res.json({ url: `/api/purchases/download/${token}` });
  }

  const purchase = db.prepare(
    "SELECT * FROM purchases WHERE user_id = ? AND book_id = ? AND status = 'success'"
  ).get(req.user.id, book.id);
  if (!purchase) return res.status(403).json({ error: "Vous n'avez pas acheté ce cahier." });
  if (!book.downloads_enabled) return res.status(403).json({ error: 'Téléchargement temporairement désactivé.' });
  if (book.download_limit && purchase.download_count >= book.download_limit) {
    return res.status(403).json({ error: 'Limite de téléchargements atteinte pour ce cahier.' });
  }

  const token = jwt.sign(
    { bookId: book.id, purchaseId: purchase.id, userId: req.user.id, kind: 'paid' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
  res.json({ url: `/api/purchases/download/${token}` });
});

router.get('/download/:token', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Lien de téléchargement expiré ou invalide.' });
  }
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(payload.bookId);
  if (!book || !book.pdf_path || !fs.existsSync(book.pdf_path)) {
    return res.status(404).json({ error: 'Fichier introuvable.' });
  }

  try {
    if (payload.kind === 'free') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', contentDisposition('attachment', book.title));
      return fs.createReadStream(book.pdf_path).pipe(res);
    }
    // Paiement: on filigrane le PDF a la volee avec les infos de l'acheteur.
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    const bytes = await watermarkPdf(book.pdf_path, {
      buyerName: user.name,
      orderNumber: payload.purchaseId.slice(0, 8).toUpperCase(),
      date: new Date().toLocaleDateString('fr-FR'),
    });
    db.prepare('UPDATE purchases SET download_count = download_count + 1 WHERE id = ?').run(payload.purchaseId);
    logActivity(payload.userId, `A téléchargé le cahier "${book.title}"`, book.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition('attachment', book.title));
    res.send(Buffer.from(bytes));
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la génération du fichier.' });
  }
});

module.exports = router;
