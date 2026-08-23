const express = require('express');
const path = require('path');
const { v4: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { watermarkPdf } = require('../utils/watermark');
const { readFileBytes } = require('../utils/fileStorage');
const { JWT_SECRET } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function contentDisposition(type, title) {
  const ascii = title.replace(/[^\x20-\x7E]/g, '').replace(/["]/g, '') || 'cahier';
  const encoded = encodeURIComponent(`${title}.pdf`);
  return `${type}; filename="${ascii}.pdf"; filename*=UTF-8''${encoded}`;
}

router.post('/', authRequired, asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  const book = await db.prepare("SELECT * FROM books WHERE id = ? AND status = 'published'").get(bookId);
  if (!book) return res.status(404).json({ error: 'Cahier introuvable.' });
  if (book.is_free) return res.status(400).json({ error: 'Ce cahier est gratuit, aucun achat requis.' });

  const already = await db.prepare(
    "SELECT * FROM purchases WHERE user_id = ? AND book_id = ? AND status = 'success'"
  ).get(req.user.id, bookId);
  if (already) return res.status(409).json({ error: 'Vous possédez déjà ce cahier.', purchaseId: already.id });

  if ((req.user.balance || 0) < book.price) {
    return res.status(402).json({
      error: `Solde insuffisant. Il te manque ${(book.price - (req.user.balance || 0)).toLocaleString('fr-FR')} FCFA — recharge ton compte d'abord.`,
      missing: book.price - (req.user.balance || 0),
    });
  }

  const id = uuid();
  await db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(book.price, req.user.id);
  await db.prepare(`INSERT INTO purchases (id,user_id,book_id,amount,payment_method,status,confirmed_at)
    VALUES (?,?,?,?,?,?,datetime('now'))`)
    .run(id, req.user.id, bookId, book.price, 'wallet', 'success');

  await logActivity(req.user.id, `A acheté le cahier "${book.title}" (${book.price} FCFA depuis son solde)`, id);
  const user = await db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  res.status(201).json({ purchaseId: id, status: 'success', balance: user.balance });
}));

router.get('/library', authRequired, asyncHandler(async (req, res) => {
  const rows = await db.prepare(`
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
    coverUrl: r.cover_path
      ? (/^https?:\/\//i.test(r.cover_path) ? r.cover_path : `/files/covers/${path.basename(r.cover_path)}`)
      : null,
    downloadCount: r.download_count,
    purchasedAt: r.purchased_at,
  })));
}));

router.get('/history', authRequired, asyncHandler(async (req, res) => {
  const rows = await db.prepare(`
    SELECT p.*, b.title FROM purchases p JOIN books b ON b.id = p.book_id
    WHERE p.user_id = ? ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(rows);
}));

router.get('/:bookId/download-link', authRequired, asyncHandler(async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Cahier introuvable.' });

  if (book.is_free) {
    if (!book.downloads_enabled) return res.status(403).json({ error: 'Téléchargement désactivé pour ce cahier.' });
    const token = jwt.sign({ bookId: book.id, kind: 'free' }, JWT_SECRET, { expiresIn: '10m' });
    return res.json({ url: `/api/purchases/download/${token}` });
  }

  const purchase = await db.prepare(
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
}));

router.get('/download/:token', asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Lien de téléchargement expiré ou invalide.' });
  }
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(payload.bookId);
  if (!book || !book.pdf_path) {
    return res.status(404).json({ error: 'Fichier introuvable.' });
  }

  try {
    let bytes;
    if (payload.kind === 'free') {
      bytes = await readFileBytes(book.pdf_path);
    } else {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
      bytes = await watermarkPdf(book.pdf_path, {
        buyerName: user.name,
        orderNumber: payload.purchaseId.slice(0, 8).toUpperCase(),
        date: new Date().toLocaleDateString('fr-FR'),
      });
      await db.prepare('UPDATE purchases SET download_count = download_count + 1 WHERE id = ?').run(payload.purchaseId);
      await logActivity(payload.userId, `A téléchargé le cahier "${book.title}"`, book.id);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition('attachment', book.title));
    res.send(Buffer.from(bytes));
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la génération du fichier.' });
  }
}));

module.exports = router;
