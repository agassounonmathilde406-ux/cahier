// utils/payments.js
// Systeme de paiement MODULAIRE, utilisé désormais pour RECHARGER le solde
// (wallet), pas pour payer un cahier directement.
const db = require('../db');
const PROVIDERS = {};

const FEDAPAY_ENV = process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox';
const FEDAPAY_BASE = FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

async function fedapayRequest(path, options = {}) {
  const apiKey = process.env.FEDAPAY_API_KEY;
  if (!apiKey) throw new Error("FEDAPAY_API_KEY n'est pas configurée.");
  const res = await fetch(`${FEDAPAY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.errors?.[0]?.message || `Erreur FedaPay (${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

function makeFedapayProvider(mode, name, label) {
  return {
    name,
    label,
    kind: 'fedapay',
    async initiate({ amount, phone, reference }) {
      if (!phone) throw new Error('Numéro de téléphone requis pour ce moyen de paiement.');

      const created = await fedapayRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: `Recharge Kajye — ${reference}`,
          amount,
          currency: { iso: 'XOF' },
          customer: {
            firstname: 'Client',
            lastname: 'Kajye',
            email: `${reference}@client.kajye.bj`,
            phone_number: { number: phone, country: 'bj' },
          },
        }),
      });
      const transaction = created['v1/transaction'] || created.transaction || created;

      const tokenRes = await fedapayRequest(`/transactions/${transaction.id}/token`, { method: 'POST' });
      const token = tokenRes.token || tokenRes['v1/token']?.token;
      if (!token) throw new Error('FedaPay: token de paiement introuvable.');

      await fedapayRequest(`/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      return {
        status: 'pending',
        providerReference: String(transaction.id),
        message: `Demande de paiement envoyée au ${phone}. Confirme sur ton téléphone.`,
      };
    },

    async checkStatus(providerReference) {
      const data = await fedapayRequest(`/transactions/${providerReference}`);
      const transaction = data['v1/transaction'] || data.transaction || data;
      if (transaction.status === 'approved') return { status: 'success' };
      if (['declined', 'canceled'].includes(transaction.status)) return { status: 'failed' };
      return { status: 'pending' };
    },
  };
}

PROVIDERS.moov_money = makeFedapayProvider('moov', 'moov_money', 'Moov Money Bénin');
PROVIDERS.mtn_money = makeFedapayProvider('mtn_open', 'mtn_money', 'MTN Mobile Money');

const MANUAL_PHONE = process.env.MANUAL_PAYMENT_PHONE || '0194180824';
const MANUAL_PHONE_INTL = `229${MANUAL_PHONE.replace(/\D/g, '').replace(/^0/, '')}`;

const manualProvider = {
  name: 'manual_whatsapp',
  label: `Envoi direct (${MANUAL_PHONE})`,
  kind: 'manual',
  phone: MANUAL_PHONE,
  whatsappPhone: MANUAL_PHONE_INTL,
  async initiate({ amount, reference }) {
    const code = reference.slice(0, 8).toUpperCase();
    return {
      status: 'pending',
      providerReference: reference,
      message: `Envoie ${amount.toLocaleString('fr-FR')} FCFA (Mobile Money) au ${MANUAL_PHONE}, puis clique sur le numéro pour envoyer le reçu par WhatsApp avec ce code : ${code}.`,
      whatsappPhone: MANUAL_PHONE_INTL,
      whatsappText: `Bonjour, voici mon reçu de recharge Kajye de ${amount.toLocaleString('fr-FR')} FCFA. Code : ${code}`,
    };
  },
  async checkStatus(reference) {
    const tx = await db.prepare('SELECT status FROM wallet_transactions WHERE id = ?').get(reference);
    return { status: tx ? tx.status : 'pending' };
  },
};
PROVIDERS.manual_whatsapp = manualProvider;

async function getActivePaymentMode() {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'payment_mode'").get();
  return row?.value === 'manual' ? 'manual' : 'fedapay';
}

async function getProvider(name) {
  const mode = await getActivePaymentMode();
  if (mode === 'manual') return manualProvider;
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Moyen de paiement inconnu : ${name}`);
  return p;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.name, label: p.label, kind: p.kind }));
}

module.exports = { getProvider, listProviders, getActivePaymentMode };
