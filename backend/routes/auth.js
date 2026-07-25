const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status };
}

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !password || (!email && !phone)) {
    return res.status(400).json({ error: 'Nom, mot de passe et (email ou téléphone) requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR phone = ?')
    .get(email || null, phone || null);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet email ou ce téléphone.' });

  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id,name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)'
  ).run(id, name, email || null, phone || null, hash, 'user');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  logActivity(id, 'Inscription', name);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { identifier, password } = req.body; // identifier = email ou telephone
  if (!identifier || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Ce compte est suspendu.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', authRequired, (req, res) => {
  const { name, email, phone } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?,name), email = COALESCE(?,email), phone = COALESCE(?,phone) WHERE id = ?')
    .run(name, email, phone, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

module.exports = router;
