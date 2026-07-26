const { v4: uuid } = require('uuid');
const db = require('../db');

async function logActivity(userId, action, target) {
  try {
    await db.prepare(
      'INSERT INTO activity_log (id, user_id, action, target) VALUES (?,?,?,?)'
    ).run(uuid(), userId || null, action, target || null);
  } catch (e) {
    // Le journal d'activité ne doit jamais faire échouer l'action principale
    // (créer un compte, valider un achat, etc.) si son propre enregistrement rate.
    console.error('Erreur activityLog:', e.message);
  }
}

module.exports = { logActivity };
