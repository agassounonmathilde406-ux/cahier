const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function normalizeEmail(v) {
  return v ? v.trim().toLowerCase() : v;
}
function normalizePhone(v) {
  return v ? v.replace(/\s+/g, '').trim() : v;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, balance: u.balance || 0 };
}

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

// L'inscription publique par email/mot de passe est desactivee : seule la
// connexion avec Google est proposee au grand public. Cette route reste en
// place uniquement pour la creation d'administrateurs par le proprietaire,
// via POST /api/admin/admins — jamais depuis le frontend public.
router.post('/register', (req, res) => {
  res.status(403).json({ error: "L'inscription par email/mot de passe n'est plus disponible. Connecte-toi avec Google." });
});

router.post('/login', asyncHandler(async (req, res) => {
  let { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });

  identifier = identifier.trim();
  const asEmail = normalizeEmail(identifier);
  const asPhone = normalizePhone(identifier);

  const user = await db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(asEmail, asPhone);
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
  let { name, email, phone } = req.body;
  email = email ? normalizeEmail(email) : email;
  phone = phone ? normalizePhone(phone) : phone;
  await db.prepare('UPDATE users SET name = COALESCE(?,name), email = COALESCE(?,email), phone = COALESCE(?,phone) WHERE id = ?')
    .run(name, email, phone, req.user.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
}));

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

  const email = normalizeEmail(payload.email);
  let user = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, email);

  if (!user) {
    const id = uuid();
    const unusableHash = bcrypt.hashSync(uuid(), 10);
    await db.prepare(
      'INSERT INTO users (id,name,email,password_hash,role,google_id) VALUES (?,?,?,?,?,?)'
    ).run(id, payload.name || email.split('@')[0], email, unusableHash, 'user', payload.sub);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    await logActivity(id, 'Inscription via Google', email);
  } else if (!user.google_id) {
    await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  if (user.status === 'suspended') return res.status(403).json({ error: 'Ce compte est suspendu.' });
  res.json({ token: sign(user), user: publicUser(user) });
}));

module.exports = router;
