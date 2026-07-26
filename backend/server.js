require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const purchaseRoutes = require('./routes/purchases');
const adminRoutes = require('./routes/admin');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN; // ex: https://kajye.vercel.app — laissez vide en dev
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',') } : {}));
app.use(express.json());

// Les couvertures sont publiques (images de vitrine).
// Les PDF complets ne sont JAMAIS servis en statique : uniquement via
// /api/purchases/download/:token (lien temporaire + filigrane).
// UPLOADS_DIR doit pointer vers un disque persistant en production.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'data');
app.use('/files/covers', express.static(path.join(UPLOADS_DIR, 'covers')));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

const PORT = process.env.PORT || 4000;

db.initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`API cahiers-benin démarrée sur http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('Impossible d\'initialiser la base de données Turso :', e);
    process.exit(1);
  });
