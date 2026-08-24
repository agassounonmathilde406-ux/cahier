// routes/wallet.js — Recharge du solde (depot) + consultation du solde.
const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { getProvider, listProviders } = require('../utils/payments');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/payment-methods', asyncHandler(async (req, res) => {
  res.json(await listProviders());
}));

router.get('/balance', authRequired, (req, res) => {
  res.json({ balance: req.user.balance || 0 });
});

router.post('/recharge', authRequired, asyncHandler(async (req, res) => {
  const { amount, phone } = req.body;
  const value = Number(amount);
  if (!value || value < 100) {
    return res.status(400).json({ error: 'Montant invalide (minimum 100 FCFA).' });
  }

  const id = uuid();
  const provider = await getProvider('moov_money');

  try {
    const result = await provider.initiate({ amount: value, phone, reference: id });
    await db.prepare(`INSERT INTO wallet_transactions (id,user_id,amount,payment_method,payment_reference,status)
      VALUES (?,?,?,?,?,?)`)
      .run(id, req.user.id, value, provider.name, result.providerReference, 'pending');
    await logActivity(req.user.id, `A initié une recharge de ${value} FCFA`, id);
    res.status(201).json({ rechargeId: id, status: 'pending', message: result.message, whatsappPhone: result.whatsappPhone, whatsappText: result.whatsappText });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Le service de paiement est momentanément indisponible.' });
  }
}));

router.post('/recharge/:id/confirm', authRequired, asyncHandler(async (req, res) => {
  const tx = await db.prepare('SELECT * FROM wallet_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tx) return res.status(404).json({ error: 'Recharge introuvable.' });
  if (tx.status === 'success') return res.json({ status: 'success', balance: req.user.balance });
  if (tx.status !== 'pending') return res.status(409).json({ error: `Recharge ${tx.status}.` });

  const provider = await getProvider(tx.payment_method);
  const result = await provider.checkStatus(tx.payment_reference);

  if (result.status === 'success') {
    await db.prepare("UPDATE wallet_transactions SET status = 'success', confirmed_at = datetime('now') WHERE id = ?").run(tx.id);
    await db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(tx.amount, req.user.id);
    await logActivity(req.user.id, `Recharge de ${tx.amount} FCFA confirmée`, tx.id);
    const user = await db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    return res.json({ status: 'success', balance: user.balance });
  }
  if (result.status === 'failed') {
    await db.prepare("UPDATE wallet_transactions SET status = 'failed' WHERE id = ?").run(tx.id);
  }
  res.json({ status: result.status });
}));

router.get('/history', authRequired, asyncHandler(async (req, res) => {
  const rows = await db.prepare(
    'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(rows);
}));

module.exports = router;
