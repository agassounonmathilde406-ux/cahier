const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status };
}

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !password || (!email && !phone)) {
    return res.status(400).json({ error: 'Nom, mot de passe et (email ou téléphone) requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ? OR phone = ?')
    .get(email || null, phone || null);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet email ou ce téléphone.' });

  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare(
    'INSERT INTO users (id,name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)'
  ).run(id, name, email || null, phone || null, hash, 'user');

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  await logActivity(id, 'Inscription', name);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password } = req.body; // identifier = email ou telephone
  if (!identifier || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  const user = await db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Ce compte est suspendu.' });
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', authRequired, asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  await db.prepare('UPDATE users SET name = COALESCE(?,name), email = COALESCE(?,email), phone = COALESCE(?,phone) WHERE id = ?')
    .run(name, email, phone, req.user.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
}));

// ---------- CONNEXION AVEC GOOGLE ----------
router.post('/google', asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Jeton Google requis.' });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "La connexion Google n'est pas configurée." });
  }

  const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const payload = await verifyRes.json();
  if (!verifyRes.ok || !payload.email) {
    return res.status(401).json({ error: 'Jeton Google invalide.' });
  }
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    return res.status(401).json({ error: 'Ce jeton Google ne correspond pas à ce site.' });
  }
  if (payload.email_verified === 'false') {
    return res.status(401).json({ error: "L'email Google associé n'est pas vérifié." });
  }

  let user = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, payload.email);

  if (!user) {
    const id = uuid();
    const unusableHash = bcrypt.hashSync(uuid(), 10);
    await db.prepare(
      'INSERT INTO users (id,name,email,password_hash,role,google_id) VALUES (?,?,?,?,?,?)'
    ).run(id, payload.name || payload.email.split('@')[0], payload.email, unusableHash, 'user', payload.sub);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    await logActivity(id, 'Inscription via Google', payload.email);
  } else if (!user.google_id) {
    await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  if (user.status === 'suspended') return res.status(403).json({ error: 'Ce compte est suspendu.' });
  res.json({ token: sign(user), user: publicUser(user) });
}));

module.exports = router;
