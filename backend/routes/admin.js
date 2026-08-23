const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired, requireRole, requirePermission } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/dashboard', authRequired, requirePermission('can_view_revenue'), asyncHandler(async (req, res) => {
  const totalUsers = (await db.prepare('SELECT COUNT(*) c FROM users').get()).c;
  const totalBooks = (await db.prepare("SELECT COUNT(*) c FROM books WHERE status='published'").get()).c;
  const sales = await db.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM purchases WHERE status='success'").get();
  const today = await db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM purchases
    WHERE status='success' AND date(confirmed_at) = date('now')`).get();
  const month = await db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM purchases
    WHERE status='success' AND strftime('%Y-%m', confirmed_at) = strftime('%Y-%m','now')`).get();
  const week = await db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM purchases
    WHERE status='success' AND strftime('%Y-%W', confirmed_at) = strftime('%Y-%W','now')`).get();
  const walletBalanceTotal = (await db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get()).s;
  const pendingRecharges = (await db.prepare("SELECT COUNT(*) c FROM wallet_transactions WHERE status='pending'").get()).c;

  const salesByDay = await db.prepare(`
    SELECT date(confirmed_at) as day, COUNT(*) as count, SUM(amount) as revenue
    FROM purchases WHERE status='success' AND confirmed_at >= date('now','-30 day')
    GROUP BY day ORDER BY day`).all();

  const topSelling = await db.prepare(`
    SELECT b.id, b.title, COUNT(p.id) as sales, SUM(p.amount) as revenue
    FROM purchases p JOIN books b ON b.id = p.book_id
    WHERE p.status='success' GROUP BY b.id ORDER BY sales DESC LIMIT 10`).all();

  const mostViewed = await db.prepare(`
    SELECT id, title, view_count FROM books WHERE status='published'
    ORDER BY view_count DESC LIMIT 10`).all();

  res.json({
    totalUsers, totalBooks,
    totalSales: sales.c, totalRevenue: sales.s,
    todaySales: today.c, todayRevenue: today.s,
    weekRevenue: week.s, monthRevenue: month.s,
    walletBalanceTotal, pendingRecharges,
    salesByDay, topSelling, mostViewed,
  });
}));

router.get('/settings', authRequired, requirePermission('can_manage_payments'), asyncHandler(async (req, res) => {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'payment_mode'").get();
  res.json({ paymentMode: row?.value === 'manual' ? 'manual' : 'fedapay' });
}));

router.post('/settings/payment-mode', authRequired, requirePermission('can_manage_payments'), asyncHandler(async (req, res) => {
  const { mode } = req.body;
  if (!['fedapay', 'manual'].includes(mode)) {
    return res.status(400).json({ error: "Mode invalide (attendu: 'fedapay' ou 'manual')." });
  }
  await db.prepare(
    "INSERT INTO settings (key, value) VALUES ('payment_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(mode);
  await logActivity(req.user.id, `A basculé le moyen de paiement (recharges) sur "${mode}"`, 'payment_mode');
  res.json({ paymentMode: mode });
}));

router.get('/wallet-transactions', authRequired, requirePermission('can_view_revenue'), asyncHandler(async (req, res) => {
  const { id, userId, status } = req.query;
  let sql = `SELECT w.*, u.name as user_name FROM wallet_transactions w
    JOIN users u ON u.id = w.user_id WHERE 1=1`;
  const params = [];
  if (id) { sql += ' AND w.id = ?'; params.push(id); }
  if (userId) { sql += ' AND w.user_id = ?'; params.push(userId); }
  if (status) { sql += ' AND w.status = ?'; params.push(status); }
  sql += ' ORDER BY w.created_at DESC LIMIT 200';
  res.json(await db.prepare(sql).all(...params));
}));

router.post('/wallet-transactions/:id/confirm-manual', authRequired, requirePermission('can_manage_payments'), asyncHandler(async (req, res) => {
  const tx = await db.prepare('SELECT * FROM wallet_transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Recharge introuvable.' });
  if (tx.status === 'success') return res.json({ ok: true, status: 'success' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ error: `Impossible de confirmer une recharge "${tx.status}".` });
  }
  await db.prepare("UPDATE wallet_transactions SET status = 'success', confirmed_at = datetime('now') WHERE id = ?").run(tx.id);
  await db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.user_id);
  await logActivity(req.user.id, `A confirmé manuellement une recharge de ${tx.amount} FCFA`, tx.id);
  res.json({ ok: true, status: 'success' });
}));

router.post('/wallet-transactions/:id/reject', authRequired, requirePermission('can_manage_payments'), asyncHandler(async (req, res) => {
  const tx = await db.prepare('SELECT * FROM wallet_transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Recharge introuvable.' });
  if (tx.status !== 'pending') return res.status(400).json({ error: 'Seule une recharge en attente peut être rejetée.' });
  await db.prepare("UPDATE wallet_transactions SET status = 'failed' WHERE id = ?").run(tx.id);
  await logActivity(req.user.id, `A rejeté une recharge de ${tx.amount} FCFA`, tx.id);
  res.json({ ok: true });
}));

router.get('/transactions', authRequired, requirePermission('can_view_revenue'), asyncHandler(async (req, res) => {
  const { id, userId, bookId, date, status } = req.query;
  let sql = `SELECT p.*, u.name as user_name, b.title as book_title FROM purchases p
    JOIN users u ON u.id = p.user_id JOIN books b ON b.id = p.book_id WHERE 1=1`;
  const params = [];
  if (id) { sql += ' AND p.id = ?'; params.push(id); }
  if (userId) { sql += ' AND p.user_id = ?'; params.push(userId); }
  if (bookId) { sql += ' AND p.book_id = ?'; params.push(bookId); }
  if (date) { sql += ' AND date(p.created_at) = ?'; params.push(date); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.created_at DESC LIMIT 200';
  res.json(await db.prepare(sql).all(...params));
}));

router.get('/users', authRequired, requireRole('admin_users'), asyncHandler(async (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT id,name,email,phone,role,status,balance,created_at FROM users WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  res.json(await db.prepare(sql).all(...params));
}));

router.get('/users/:id', authRequired, requireRole('admin_users'), asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id,name,email,phone,role,status,balance,created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  const purchases = await db.prepare(`
    SELECT p.*, b.title FROM purchases p JOIN books b ON b.id=p.book_id
    WHERE p.user_id = ? ORDER BY p.created_at DESC`).all(req.params.id);
  res.json({ user, purchases });
}));

router.post('/users/:id/suspend', authRequired, requireRole('admin_users'), asyncHandler(async (req, res) => {
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (target.role === 'owner') return res.status(403).json({ error: 'Le propriétaire ne peut pas être suspendu.' });
  await db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(req.params.id);
  await logActivity(req.user.id, `A suspendu le compte de ${target.name}`, target.id);
  res.json({ ok: true });
}));

router.post('/users/:id/reactivate', authRequired, requireRole('admin_users'), asyncHandler(async (req, res) => {
  await db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
  await logActivity(req.user.id, 'A réactivé un compte', req.params.id);
  res.json({ ok: true });
}));

router.get('/admins', authRequired, requireRole(), asyncHandler(async (req, res) => {
  const rows = await db.prepare(`
    SELECT u.id,u.name,u.email,u.phone,u.role,u.status,
           ap.can_view_revenue, ap.can_manage_payments, ap.can_manage_admins, ap.can_manage_prices
    FROM users u LEFT JOIN admin_permissions ap ON ap.user_id = u.id
    WHERE u.role != 'user' ORDER BY u.created_at DESC`).all();
  res.json(rows);
}));

router.post('/admins', authRequired, requirePermission('can_manage_admins'), asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, permissions } = req.body;
  const allowedRoles = ['admin_content', 'admin_validation', 'admin_users'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Rôle administrateur invalide.' });
  if (!name || !password) return res.status(400).json({ error: 'Nom et mot de passe requis.' });

  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('INSERT INTO users (id,name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)')
    .run(id, name, email || null, phone || null, hash, role);

  if (permissions) {
    await db.prepare(`INSERT INTO admin_permissions (user_id, can_view_revenue, can_manage_payments, can_manage_admins, can_manage_prices)
      VALUES (?,?,?,?,?)`).run(
      id,
      permissions.canViewRevenue ? 1 : 0,
      permissions.canManagePayments ? 1 : 0,
      permissions.canManageAdmins ? 1 : 0,
      permissions.canManagePrices ? 1 : 0
    );
  }
  await logActivity(req.user.id, `A créé un administrateur (${role}) : ${name}`, id);
  res.status(201).json({ id, name, role });
}));

router.delete('/admins/:id', authRequired, requirePermission('can_manage_admins'), asyncHandler(async (req, res) => {
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Introuvable.' });
  if (target.role === 'owner') return res.status(403).json({ error: 'Impossible de supprimer le propriétaire.' });
  await db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(req.params.id);
  await db.prepare('DELETE FROM admin_permissions WHERE user_id = ?').run(req.params.id);
  await logActivity(req.user.id, `A retiré les droits admin de ${target.name}`, target.id);
  res.json({ ok: true });
}));

router.get('/activity-log', authRequired, requireRole(), asyncHandler(async (req, res) => {
  const rows = await db.prepare(`
    SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 300`).all();
  res.json(rows);
}));

router.get('/reports', authRequired, requireRole('admin_content', 'admin_validation'), asyncHandler(async (req, res) => {
  const rows = await db.prepare(`
    SELECT r.*, b.title as book_title FROM reports r JOIN books b ON b.id = r.book_id
    ORDER BY r.created_at DESC`).all();
  res.json(rows);
}));

module.exports = router;
