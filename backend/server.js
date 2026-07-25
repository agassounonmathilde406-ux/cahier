require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const purchaseRoutes = require('./routes/purchases');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

// Les couvertures sont publiques (images de vitrine).
// Les PDF complets ne sont JAMAIS servis en statique : uniquement via
// /api/purchases/download/:token (lien temporaire + filigrane).
app.use('/files/covers', express.static(path.join(__dirname, 'data', 'covers')));

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
app.listen(PORT, () => console.log(`API cahiers-benin démarrée sur http://localhost:${PORT}`));
