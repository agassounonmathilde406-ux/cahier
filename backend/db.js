// db.js — Connexion SQLite + schema complet de la plateforme
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'plateforme.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- ===================== UTILISATEURS =====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  -- role: owner | admin_content | admin_validation | admin_users | user
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== PERMISSIONS ADMIN (accordées par le propriétaire) =====================
CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  can_view_revenue INTEGER NOT NULL DEFAULT 0,
  can_manage_payments INTEGER NOT NULL DEFAULT 0,
  can_manage_admins INTEGER NOT NULL DEFAULT 0,
  can_manage_prices INTEGER NOT NULL DEFAULT 0
);

-- ===================== CATEGORIES / MATIERES =====================
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ===================== CAHIERS =====================
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL,        -- 6eme,5eme,4eme,3eme,Seconde,Premiere,Terminale
  series TEXT,                -- A,B,C,D (lycee uniquement)
  subject_id TEXT REFERENCES subjects(id),
  author TEXT,
  cover_path TEXT,
  pdf_path TEXT,               -- fichier complet (jamais exposé publiquement)
  preview_pages INTEGER NOT NULL DEFAULT 5,
  total_pages INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,   -- 0 = payant, 1 = gratuit
  price INTEGER NOT NULL DEFAULT 1000,  -- FCFA
  status TEXT NOT NULL DEFAULT 'draft', -- draft|pending|published|refused|archived
  download_limit INTEGER,               -- NULL = illimite
  downloads_enabled INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

-- ===================== ACHATS / TRANSACTIONS =====================
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,   -- moov_money | ...
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed|cancelled|refunded
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

-- ===================== JOURNAL D'ACTIVITE =====================
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== SIGNALEMENTS =====================
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  book_id TEXT REFERENCES books(id),
  reported_by TEXT REFERENCES users(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open|resolved
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_level ON books(level);
CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_book ON purchases(book_id);
`);

module.exports = db;
