const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

async function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Ce compte est suspendu.' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (user && user.status !== 'suspended') req.user = user;
  } catch (e) { /* ignore */ }
  next();
}

// roles: 'owner' a toujours acces. Les autres roles listes sont autorises en plus.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
    if (req.user.role === 'owner' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: "Vous n'avez pas la permission d'effectuer cette action." });
  };
}

// Verifie une permission fine accordee par le proprietaire (ex: can_view_revenue)
function requirePermission(permKey) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
    if (req.user.role === 'owner') return next();
    try {
      const perm = await db.prepare('SELECT * FROM admin_permissions WHERE user_id = ?').get(req.user.id);
      if (perm && perm[permKey]) return next();
      return res.status(403).json({ error: "Permission insuffisante pour cette ressource sensible." });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { authRequired, optionalAuth, requireRole, requirePermission, JWT_SECRET };
