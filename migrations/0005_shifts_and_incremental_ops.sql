-- Normalize operational records for shifts, incremental writes, and multi-period D1 reports.

ALTER TABLE pos_orders ADD COLUMN business_date TEXT;
ALTER TABLE pos_orders ADD COLUMN shift_id TEXT;
ALTER TABLE pos_orders ADD COLUMN takeaway INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pos_orders ADD COLUMN preparation_started_at TEXT;
ALTER TABLE pos_orders ADD COLUMN station_completed_json TEXT;
ALTER TABLE pos_orders ADD COLUMN fee REAL NOT NULL DEFAULT 0;
ALTER TABLE pos_orders ADD COLUMN num TEXT;
ALTER TABLE pos_orders ADD COLUMN created_iso TEXT;
ALTER TABLE pos_orders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE kardex_movements ADD COLUMN ingredient_id TEXT;
ALTER TABLE kardex_movements ADD COLUMN order_id TEXT;
ALTER TABLE kardex_movements ADD COLUMN business_date TEXT;
ALTER TABLE kardex_movements ADD COLUMN created_iso TEXT;

ALTER TABLE cash_movements ADD COLUMN shift_id TEXT;
ALTER TABLE cash_movements ADD COLUMN business_date TEXT;
ALTER TABLE cash_movements ADD COLUMN order_id TEXT;
ALTER TABLE cash_movements ADD COLUMN boleta_num TEXT;
ALTER TABLE cash_movements ADD COLUMN created_iso TEXT;

CREATE TABLE IF NOT EXISTS cash_shifts (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opening_amount REAL NOT NULL DEFAULT 0,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  close_reason TEXT NOT NULL DEFAULT '',
  cash_sales REAL NOT NULL DEFAULT 0,
  digital_sales REAL NOT NULL DEFAULT 0,
  expenses_total REAL NOT NULL DEFAULT 0,
  expected_cash REAL NOT NULL DEFAULT 0,
  counted_cash REAL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  boletas_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pos_boletas (
  boleta_num TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  order_id TEXT NOT NULL,
  shift_id TEXT,
  business_date TEXT NOT NULL,
  customer TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  total REAL NOT NULL,
  date_label TEXT NOT NULL,
  created_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_purchases (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  date_label TEXT NOT NULL,
  doc TEXT NOT NULL,
  supplier TEXT NOT NULL,
  item TEXT NOT NULL,
  ingredient_id TEXT,
  qty REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_suppliers (
  id TEXT PRIMARY KEY,
  ruc TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_recipes (
  product_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  qty REAL NOT NULL,
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS pos_closed_days (
  business_date TEXT PRIMARY KEY,
  closed INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_counters (
  name TEXT PRIMARY KEY,
  val INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pos_orders_bdate ON pos_orders(business_date, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_shift ON pos_orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_sort ON pos_orders(sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_date ON cash_shifts(business_date DESC);
CREATE INDEX IF NOT EXISTS idx_kardex_bdate ON kardex_movements(business_date, created_iso DESC);
CREATE INDEX IF NOT EXISTS idx_cash_mov_shift ON cash_movements(shift_id, created_iso DESC);
CREATE INDEX IF NOT EXISTS idx_cash_mov_bdate ON cash_movements(business_date, created_iso DESC);
CREATE INDEX IF NOT EXISTS idx_pos_boletas_bdate ON pos_boletas(business_date, created_iso DESC);
CREATE INDEX IF NOT EXISTS idx_pos_purchases_bdate ON pos_purchases(business_date, created_iso DESC);
