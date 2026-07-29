// utils/payments.js
// Systeme de paiement MODULAIRE. Chaque moyen de paiement implemente la meme
// interface { initiate(purchase), checkStatus(reference) }.
//
// Integration FedaPay (https://fedapay.com) : agregateur beninois qui gere
// MTN Mobile Money ET Moov Money avec une seule API. On utilise ici le mode
// "paiement sans redirection" (push direct sur le telephone du client),
// disponible pour MTN Benin et Moov Benin.
//
// Variables requises dans .env :
//   FEDAPAY_API_KEY         (cle secrete, sandbox ou live)
//   FEDAPAY_ENVIRONMENT     ("sandbox" ou "live", defaut: sandbox)

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
    async initiate({ amount, phone, reference }) {
      if (!phone) throw new Error('Numéro de téléphone requis pour ce moyen de paiement.');

      const created = await fedapayRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: `Cahier Kajye — commande ${reference}`,
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
        message: `Demande de paiement envoyée au ${phone}. Confirmez sur votre téléphone.`,
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

function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Moyen de paiement inconnu : ${name}`);
  return p;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.name, label: p.label }));
}

function registerProvider(provider) {
  PROVIDERS[provider.name] = provider;
}

module.exports = { getProvider, listProviders, registerProvider };
