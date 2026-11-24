-- Cloudflare D1 Schema for The Burgers Brother POS (QR + Admin + BIXOLON + Chef)
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  table_name TEXT,
  customer TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  payment_status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_ref TEXT,
  status TEXT NOT NULL,
  boleta_num TEXT,
  total REAL NOT NULL,
  items_json TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  station TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock REAL NOT NULL,
  min_stock REAL NOT NULL,
  cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS kardex_movements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  ing_name TEXT NOT NULL,
  type TEXT NOT NULL,
  doc TEXT NOT NULL,
  prev_stock REAL NOT NULL,
  qty REAL NOT NULL,
  next_stock REAL NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,
  desc TEXT NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code);
