const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired, optionalAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { extractPreview } = require('../utils/watermark');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'cover'
      ? path.join(__dirname, '..', 'data', 'covers')
      : path.join(__dirname, '..', 'data', 'pdfs');
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover' && !file.mimetype.startsWith('image/')) {
      return cb(new Error('La couverture doit être une image.'));
    }
    if (file.fieldname === 'pdf' && file.mimetype !== 'application/pdf') {
      return cb(new Error('Le fichier du cahier doit être un PDF.'));
    }
    cb(null, true);
  },
});

function toPublicBook(b, { includeInternal } = {}) {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    level: b.level,
    series: b.series,
    subjectId: b.subject_id,
    author: b.author,
    coverUrl: b.cover_path ? `/files/covers/${path.basename(b.cover_path)}` : null,
    previewPages: b.preview_pages,
    totalPages: b.total_pages,
    isFree: !!b.is_free,
    price: b.price,
    status: b.status,
    viewCount: b.view_count,
    publishedAt: b.published_at,
    ...(includeInternal ? { downloadLimit: b.download_limit, downloadsEnabled: !!b.downloads_enabled, createdBy: b.created_by } : {}),
  };
}

// ---------- CATALOGUE PUBLIC ----------

router.get('/subjects', (req, res) => {
  res.json(db.prepare('SELECT * FROM subjects ORDER BY name').all());
});

router.post('/subjects', authRequired, requireRole('admin_content'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom de la matière requis.' });
  const id = uuid();
  db.prepare('INSERT INTO subjects (id, name) VALUES (?,?)').run(id, name);
  res.status(201).json({ id, name });
});

// Recherche + filtres: niveau, serie, matiere, gratuit/payant, prix, popularite, date
router.get('/', optionalAuth, (req, res) => {
  const { q, level, series, subjectId, free, sort } = req.query;
  let sql = "SELECT * FROM books WHERE status = 'published'";
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR description LIKE ? OR author LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (level) { sql += ' AND level = ?'; params.push(level); }
  if (series) { sql += ' AND series = ?'; params.push(series); }
  if (subjectId) { sql += ' AND subject_id = ?'; params.push(subjectId); }
  if (free === 'true') sql += ' AND is_free = 1';
  if (free === 'false') sql += ' AND is_free = 0';

  if (sort === 'popular') sql += ' ORDER BY view_count DESC';
  else if (sort === 'price_asc') sql += ' ORDER BY price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY price DESC';
  else sql += ' ORDER BY published_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((b) => toPublicBook(b)));
});

router.get('/:id', optionalAuth, (req, res) => {
  const b = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Cahier introuvable.' });
  if (b.status !== 'published' && !(req.user && ['owner', 'admin_content', 'admin_validation'].includes(req.user.role))) {
    return res.status(404).json({ error: 'Cahier introuvable.' });
  }
  db.prepare('UPDATE books SET view_count = view_count + 1 WHERE id = ?').run(b.id);
  res.json(toPublicBook(b));
});

// ---------- APERCU ----------
// Sert un PDF tronque contenant uniquement les pages d'apercu autorisees.
router.get('/:id/preview', async (req, res) => {
  const b = db.prepare("SELECT * FROM books WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!b || !b.pdf_path) return res.status(404).json({ error: 'Cahier introuvable.' });
  try {
    const bytes = await extractPreview(b.pdf_path, b.preview_pages);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="apercu-${b.id}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (e) {
    res.status(500).json({ error: "Impossible de générer l'aperçu." });
  }
});

// ---------- ADMINISTRATION DES CAHIERS ----------

// Ajout d'un cahier (statut initial: draft ou pending selon le role)
router.post(
  '/',
  authRequired,
  requireRole('admin_content'),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]),
  (req, res) => {
    const { title, description, level, series, subjectId, author, isFree, price, previewPages } = req.body;
    if (!title || !level) return res.status(400).json({ error: 'Titre et niveau requis.' });

    const id = uuid();
    const cover = req.files?.cover?.[0];
    const pdf = req.files?.pdf?.[0];
    const status = req.user.role === 'owner' ? 'published' : 'pending';

    db.prepare(`INSERT INTO books
      (id,title,description,level,series,subject_id,author,cover_path,pdf_path,preview_pages,is_free,price,status,created_by,published_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id, title, description || '', level, series || null, subjectId || null, author || '',
      cover ? cover.path : null, pdf ? pdf.path : null,
      Number(previewPages) || 5,
      isFree === 'true' ? 1 : 0,
      Number(price) || 1000,
      status,
      req.user.id,
      status === 'published' ? new Date().toISOString() : null
    );
    logActivity(req.user.id, `A créé le cahier "${title}"`, id);
    const b = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    res.status(201).json(toPublicBook(b, { includeInternal: true }));
  }
);

router.put(
  '/:id',
  authRequired,
  requireRole('admin_content'),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]),
  (req, res) => {
    const b = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!b) return res.status(404).json({ error: 'Cahier introuvable.' });

    const { title, description, level, series, subjectId, author, isFree, price, previewPages, downloadsEnabled, downloadLimit } = req.body;
    const cover = req.files?.cover?.[0];
    const pdf = req.files?.pdf?.[0];

    // Seul le proprietaire (ou un admin avec permission) peut changer le prix ici sans re-validation
    db.prepare(`UPDATE books SET
      title = COALESCE(?,title), description = COALESCE(?,description), level = COALESCE(?,level),
      series = COALESCE(?,series), subject_id = COALESCE(?,subject_id), author = COALESCE(?,author),
      cover_path = COALESCE(?,cover_path), pdf_path = COALESCE(?,pdf_path),
      preview_pages = COALESCE(?,preview_pages), is_free = COALESCE(?,is_free), price = COALESCE(?,price),
      downloads_enabled = COALESCE(?,downloads_enabled), download_limit = COALESCE(?,download_limit)
      WHERE id = ?`
    ).run(
      title, description, level, series, subjectId, author,
      cover ? cover.path : null, pdf ? pdf.path : null,
      previewPages ? Number(previewPages) : null,
      isFree === undefined ? null : (isFree === 'true' ? 1 : 0),
      price ? Number(price) : null,
      downloadsEnabled === undefined ? null : (downloadsEnabled === 'true' ? 1 : 0),
      downloadLimit ? Number(downloadLimit) : null,
      req.params.id
    );
    logActivity(req.user.id, `A modifié le cahier "${b.title}"`, b.id);
    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json(toPublicBook(updated, { includeInternal: true }));
  }
);

// Envoi pour validation (admin_content -> pending)
router.post('/:id/submit', authRequired, requireRole('admin_content'), (req, res) => {
  db.prepare("UPDATE books SET status = 'pending' WHERE id = ?").run(req.params.id);
  logActivity(req.user.id, 'A soumis un cahier pour validation', req.params.id);
  res.json({ ok: true });
});

// Validation (accepter / refuser) — admin_validation ou owner
router.post('/:id/validate', authRequired, requireRole('admin_validation'), (req, res) => {
  const { decision } = req.body; // 'accept' | 'refuse'
  const status = decision === 'accept' ? 'published' : 'refused';
  db.prepare('UPDATE books SET status = ?, published_at = ? WHERE id = ?')
    .run(status, status === 'published' ? new Date().toISOString() : null, req.params.id);
  logActivity(req.user.id, `A ${decision === 'accept' ? 'validé' : 'refusé'} le cahier`, req.params.id);
  res.json({ ok: true, status });
});

router.get('/admin/pending', authRequired, requireRole('admin_validation'), (req, res) => {
  const rows = db.prepare("SELECT * FROM books WHERE status = 'pending' ORDER BY created_at ASC").all();
  res.json(rows.map((b) => toPublicBook(b, { includeInternal: true })));
});

router.get('/admin/all', authRequired, requireRole('admin_content', 'admin_validation'), (req, res) => {
  const rows = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
  res.json(rows.map((b) => toPublicBook(b, { includeInternal: true })));
});

router.post('/:id/archive', authRequired, requireRole('admin_content'), (req, res) => {
  db.prepare("UPDATE books SET status = 'archived' WHERE id = ?").run(req.params.id);
  logActivity(req.user.id, 'A archivé un cahier', req.params.id);
  res.json({ ok: true });
});

// Signaler un contenu
router.post('/:id/report', authRequired, (req, res) => {
  const { reason } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO reports (id, book_id, reported_by, reason) VALUES (?,?,?,?)')
    .run(id, req.params.id, req.user.id, reason || '');
  logActivity(req.user.id, 'A signalé un cahier', req.params.id);
  res.status(201).json({ ok: true });
});

module.exports = router;
