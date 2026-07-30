// db.js — Connexion Turso (libSQL, "SQLite hébergé dans le cloud", tier gratuit
// permanent) + schema complet de la plateforme.
//
// En développement local (sans compte Turso), laissez TURSO_DATABASE_URL vide :
// le client écrit alors dans un fichier local (./data/plateforme.db), pratique
// pour tester sans dépendre du réseau.
//
// En production, créez une base sur https://turso.tech (gratuit, sans carte
// bancaire), puis renseignez TURSO_DATABASE_URL et TURSO_AUTH_TOKEN dans .env —
// vos données survivent alors à tous les redéploiements, même sur un hébergeur
// dont le disque est éphémère (ex: Render en plan gratuit).
const { createClient } = require('@libsql/client');
const path = require('path');

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'data', 'plateforme.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN; // non requis en mode fichier local

const client = createClient(authToken ? { url, authToken } : { url });

// Petite couche de compatibilité qui imite l'API synchrone de better-sqlite3
// (db.prepare(sql).get/.all/.run(...args)) mais renvoie des Promises, puisque
// libSQL communique par le réseau. Cela limite les changements nécessaires
// dans le reste du code : il suffit d'ajouter `await` devant chaque appel.
// libSQL refuse les valeurs "undefined" en paramètre (contrairement à
// better-sqlite3 qui les tolérait dans ce projet) — on les convertit en null
// pour garder le même comportement (COALESCE(?, colonne) => garde l'ancienne
// valeur si le champ n'a pas été envoyé).
function cleanArgs(args) {
  return args.map((a) => (a === undefined ? null : a));
}

function prepare(sql) {
  return {
    async get(...args) {
      const res = await client.execute({ sql, args: cleanArgs(args) });
      return res.rows[0];
    },
    async all(...args) {
      const res = await client.execute({ sql, args: cleanArgs(args) });
      return res.rows;
    },
    async run(...args) {
      const res = await client.execute({ sql, args: cleanArgs(args) });
      return { changes: res.rowsAffected, lastInsertRowid: res.lastInsertRowid };
    },
  };
}

const SCHEMA = `
-- ===================== UTILISATEURS =====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  can_view_revenue INTEGER NOT NULL DEFAULT 0,
  can_manage_payments INTEGER NOT NULL DEFAULT 0,
  can_manage_admins INTEGER NOT NULL DEFAULT 0,
  can_manage_prices INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL,
  series TEXT,
  subject_id TEXT REFERENCES subjects(id),
  author TEXT,
  cover_path TEXT,
  pdf_path TEXT,
  preview_pages INTEGER NOT NULL DEFAULT 5,
  total_pages INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'draft',
  download_limit INTEGER,
  downloads_enabled INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  book_id TEXT REFERENCES books(id),
  reported_by TEXT REFERENCES users(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Codes de verification par SMS (inscription/connexion par numero de telephone)
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_level ON books(level);
CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_book ON purchases(book_id);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
`;

// Ajoute une colonne a une table existante si elle n'existe pas deja.
// (CREATE TABLE IF NOT EXISTS ne modifie jamais une table deja creee, donc les
// nouvelles colonnes ajoutees plus tard doivent passer par ce mini-systeme de
// migration, volontairement tres simple et sans dependance.)
async function ensureColumn(table, column, definition) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => r.name === column);
  if (!exists) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Doit être appelé une fois au démarrage du serveur avant de traiter des
// requêtes (voir server.js).
async function initSchema() {
  await client.executeMultiple(SCHEMA);
  // Connexion Google : identifiant Google unique, et mot de passe rendu
  // optionnel (un compte cree via Google n'a pas de mot de passe classique).
  await ensureColumn('users', 'google_id', 'TEXT');
  await ensureColumn('users', 'phone_verified', 'INTEGER NOT NULL DEFAULT 0');
}

module.exports = { prepare, client, initSchema };
