const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL,           -- 'consult' | 'install'
    product TEXT,
    tier TEXT,
    price TEXT,
    name TEXT,
    contact TEXT,
    address TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new'   -- new | contacted | closed
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    product TEXT NOT NULL,
    tier TEXT NOT NULL,
    amount_uzs INTEGER NOT NULL,      -- сумма в сумах (целое число)
    phone TEXT,
    payment_method TEXT NOT NULL,     -- payme | click | uzcard | card
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | awaiting_gateway | paid | cancelled
    gateway_transaction_id TEXT,
    paid_at TEXT
  );

  CREATE TABLE IF NOT EXISTS assistant_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    session_id TEXT,
    message TEXT NOT NULL,
    reply TEXT NOT NULL,
    mode TEXT NOT NULL   -- 'ai' | 'rules'
  );
`);

module.exports = db;
