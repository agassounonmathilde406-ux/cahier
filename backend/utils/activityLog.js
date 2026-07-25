const { v4: uuid } = require('uuid');
const db = require('../db');

function logActivity(userId, action, target) {
  db.prepare(
    'INSERT INTO activity_log (id, user_id, action, target) VALUES (?,?,?,?)'
  ).run(uuid(), userId || null, action, target || null);
}

module.exports = { logActivity };
