// utils/payments.js
// Systeme de paiement MODULAIRE. Chaque moyen de paiement implemente la meme
// interface { initiate(purchase), checkStatus(reference) } afin de pouvoir en
// ajouter facilement (carte bancaire, autre mobile money, etc.) sans toucher
// au reste du code.
//
// IMPORTANT: L'integration Moov Money Benin reelle necessite un contrat
// marchand + des identifiants API fournis par Moov Africa (client_id,
// client_secret, merchant number) que vous devrez renseigner dans le fichier
// .env. En attendant, ce module fonctionne en mode "sandbox" qui simule le
// cycle de vie d'un paiement (pending -> success) pour que toute la
// plateforme soit testable de bout en bout. Remplacez `moovMoneyProvider`
// par de vrais appels HTTP vers l'API Moov une fois vos identifiants obtenus.

const PROVIDERS = {};

const moovMoneyProvider = {
  name: 'moov_money',
  label: 'Moov Money Bénin',
  async initiate({ amount, phone, reference }) {
    if (process.env.MOOV_MODE === 'live') {
      // TODO: brancher ici l'appel reel a l'API marchand Moov Money
      // (endpoint, client_id/secret, merchant number fournis par Moov Africa).
      throw new Error('Mode live Moov Money non configure. Renseignez MOOV_* dans .env.');
    }
    // --- SANDBOX ---
    // Simule l'envoi d'une demande de paiement (push USSD) au numero du client.
    return {
      status: 'pending',
      providerReference: `SANDBOX-${reference}`,
      message: `Demande de paiement envoyee au ${phone}. Confirmez sur votre telephone.`,
    };
  },
  async checkStatus(providerReference) {
    if (process.env.MOOV_MODE === 'live') {
      throw new Error('Mode live Moov Money non configure.');
    }
    // --- SANDBOX --- : on considere le paiement reussi apres verification.
    return { status: 'success' };
  },
};

PROVIDERS.moov_money = moovMoneyProvider;

function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Moyen de paiement inconnu : ${name}`);
  return p;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.name, label: p.label }));
}

// Permet d'enregistrer facilement un nouveau moyen de paiement plus tard, ex:
// registerProvider(require('./providers/cardProvider'));
function registerProvider(provider) {
  PROVIDERS[provider.name] = provider;
}

module.exports = { getProvider, listProviders, registerProvider };
