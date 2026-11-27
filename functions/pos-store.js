import { MENU, EXTRAS } from '../public/catalog.js';
import { priceOrder } from '../public/order-pricing.js';
import { initialState, withInventoryCatalog } from './initial-state.js';
import {
  isSundayDate,
  limaClock,
  limaMidnightAfterIso,
  parseLegacyDateToLima,
  reportDateRange
} from './business-calendar.js';

const menuById = new Map(MENU.map(product => [product.id, product]));
const extrasById = new Map(EXTRAS.map(extra => [extra.id, extra]));
const DEFAULT_AUTO_CLOSE_NOTE = 'Cierre automático a medianoche (00:00 Lima)';
const CLOSED_SUNDAY_MESSAGE = 'Hoy domingo el local permanece cerrado. Puedes ver nuestra carta, pero el envío de pedidos está deshabilitado.';
const CLOSED_MANUAL_MESSAGE = 'Hoy el local se encuentra cerrado. Puedes revisar la carta, pero no recibimos pedidos por hoy.';

export const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
export const stockQty = value => Math.round((Number(value) || 0) * 1000) / 1000;
export const padNum = (value, len) => String(value).padStart(len, '0');

export const ORDER_COLUMNS = [
  'id', 'code', 'channel', 'table_name', 'customer', 'phone', 'address',
  'payment_status', 'payment_method', 'payment_ref', 'status', 'boleta_num',
  'total', 'items_json', 'note', 'created_at', 'approved_at', 'completed_at',
  'business_date', 'shift_id', 'takeaway', 'preparation_started_at',
  'station_completed_json', 'fee', 'num', 'created_iso', 'sort_order'
].join(', ');

export function orderToDbValues(order, { businessDate, shiftId = null, createdIso, sortOrder }) {
  return [
    order.id,
    order.code,
    order.channel,
    order.table || '-',
    order.customer || '',
    order.phone || '',
    order.address || '',
    order.paymentStatus || 'PENDIENTE',
    order.paymentMethod || '',
    order.paymentRef || '',
    order.status,
    order.boletaNum || null,
    Number(order.total) || 0,
    JSON.stringify(order.items || []),
    order.note || '',
    order.createdAt || '',
    order.approvedAt || null,
    order.completedAt || null,
    businessDate,
    shiftId,
    order.takeaway ? 1 : 0,
    order.preparationStartedAt || null,
    order.stationCompletedAt ? JSON.stringify(order.stationCompletedAt) : null,
    Number(order.fee) || 0,
    order.num || order.code.replace(/^BB-/, ''),
    createdIso,
    sortOrder
  ];
}

export function dbRowToOrder(row) {
  let items = [];
  let stationCompletedAt;
  try { items = JSON.parse(row.items_json || '[]'); } catch {}
  try {
    if (row.station_completed_json) stationCompletedAt = JSON.parse(row.station_completed_json);
  } catch {}
  const order = {
    id: row.id,
    num: row.num || String(row.code || '').replace(/^BB-/, ''),
    code: row.code,
    channel: row.channel,
    table: row.table_name || '-',
    customer: row.customer || '',
    phone: row.phone || '',
    address: row.address || '',
    paymentStatus: row.payment_status || 'PENDIENTE',
    paymentMethod: row.payment_method || '',
    paymentRef: row.payment_ref || '',
    status: row.status,
    boletaNum: row.boleta_num || null,
    total: Number(row.total) || 0,
    fee: Number(row.fee) || 0,
    takeaway: Boolean(row.takeaway),
    items,
    note: row.note || '',
    createdAt: row.created_at || '',
    approvedAt: row.approved_at || null,
    preparationStartedAt: row.preparation_started_at || null,
    completedAt: row.completed_at || null,
    businessDate: row.business_date || null,
    shiftId: row.shift_id || null
  };
  if (stationCompletedAt) order.stationCompletedAt = stationCompletedAt;
  return order;
}

export function dbRowToShift(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessDate: row.business_date,
    status: row.status,
    opening: roundMoney(row.opening_amount),
    openedAt: row.opened_at,
    closedAt: row.closed_at || null,
    closeReason: row.close_reason || '',
    cashSales: roundMoney(row.cash_sales),
    digitalSales: roundMoney(row.digital_sales),
    expensesTotal: roundMoney(row.expenses_total),
    expectedCash: roundMoney(row.expected_cash),
    countedCash: row.counted_cash == null ? null : roundMoney(row.counted_cash),
    ordersCount: Number(row.orders_count) || 0,
    boletasCount: Number(row.boletas_count) || 0,
    notes: row.notes || ''
  };
}

/**
 * Ensures one-time normalization from legacy single-row pos_state JSON into SQL tables.
 * Preserves existing orders, ingredients, kardex, boletas, purchases, and caja data.
 */
export async function ensureInitialized(db, now = new Date()) {
  const flag = await db.prepare("SELECT val FROM pos_counters WHERE name = 'migrated_v2'").first();
  if (flag?.val === 1) return;

  const clock = limaClock(now);
  const legacyRow = await db.prepare('SELECT payload, revision FROM pos_state WHERE id = 1').first();
  const baseDefaults = initialState();
  let legacy = null;
  if (legacyRow?.payload && legacyRow.payload !== '{}') {
    try {
      const parsed = JSON.parse(legacyRow.payload);
      if (parsed && typeof parsed === 'object') legacy = parsed;
    } catch {
      legacy = null;
    }
  }

  const statements = [];
  const ingredients = withInventoryCatalog({
    ingredients: Array.isArray(legacy?.ingredients) && legacy.ingredients.length
      ? legacy.ingredients.map(item => ({ ...item }))
      : baseDefaults.ingredients
  }).ingredients;

  for (const ing of ingredients) {
    statements.push(db.prepare(
      `INSERT INTO ingredients (id, code, name, station, unit, stock, min_stock, cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, name = excluded.name, station = excluded.station, unit = excluded.unit,
         stock = excluded.stock, min_stock = excluded.min_stock, cost = excluded.cost
       WHERE ingredients.stock IS NOT excluded.stock OR ingredients.cost IS NOT excluded.cost`
    ).bind(
      ing.id,
      ing.code || 'IN-00',
      ing.name || '',
      ing.station || 'COCINA',
      ing.unit || 'und',
      stockQty(ing.stock),
      stockQty(ing.minStock),
      roundMoney(ing.cost)
    ));
  }

  for (const [productId, map] of Object.entries(legacy?.recipeQuantities || {})) {
    for (const [ingredientId, qty] of Object.entries(map || {})) {
      statements.push(db.prepare(
        'INSERT OR REPLACE INTO pos_recipes (product_id, ingredient_id, qty) VALUES (?, ?, ?)'
      ).bind(productId, ingredientId, stockQty(qty)));
    }
  }

  for (const sup of legacy?.suppliers || []) {
    statements.push(db.prepare(
      'INSERT OR IGNORE INTO pos_suppliers (id, ruc, name, category, contact) VALUES (?, ?, ?, ?, ?)'
    ).bind(sup.id || crypto.randomUUID(), sup.ruc || '', sup.name || '', sup.category || '', sup.contact || ''));
  }

  const orders = Array.isArray(legacy?.orders) ? legacy.orders : [];
  let maxSort = 0;
  const orderDateById = new Map();
  // Legacy state stores newest orders at index 0; insert oldest-first so sort_order increments monotonically.
  for (let i = orders.length - 1; i >= 0; i--) {
    const ord = orders[i];
    if (!ord?.id) continue;
    maxSort += 1;
    const bDate = parseLegacyDateToLima(ord.createdAt, clock.businessDate);
    orderDateById.set(ord.id, bDate);
    statements.push(db.prepare(
      `INSERT INTO pos_orders (${ORDER_COLUMNS}) VALUES (${'?,'.repeat(26)}?)
       ON CONFLICT(id) DO UPDATE SET
         business_date = COALESCE(pos_orders.business_date, excluded.business_date),
         takeaway = COALESCE(pos_orders.takeaway, excluded.takeaway),
         preparation_started_at = COALESCE(pos_orders.preparation_started_at, excluded.preparation_started_at),
         station_completed_json = COALESCE(pos_orders.station_completed_json, excluded.station_completed_json),
         fee = COALESCE(pos_orders.fee, excluded.fee),
         num = COALESCE(pos_orders.num, excluded.num),
         created_iso = COALESCE(pos_orders.created_iso, excluded.created_iso),
         sort_order = CASE WHEN pos_orders.sort_order = 0 THEN excluded.sort_order ELSE pos_orders.sort_order END`
    ).bind(...orderToDbValues(ord, {
      businessDate: bDate,
      shiftId: `shift_${bDate}`,
      createdIso: ord.preparationStartedAt || clock.iso,
      sortOrder: maxSort
    })));
  }

  const kardex = Array.isArray(legacy?.kardex) ? legacy.kardex : [];
  for (let i = kardex.length - 1; i >= 0; i--) {
    const k = kardex[i];
    if (!k) continue;
    const bDate = parseLegacyDateToLima(k.date, clock.businessDate);
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO kardex_movements
        (id, date, ing_name, type, doc, prev_stock, qty, next_stock, unit, ingredient_id, order_id, business_date, created_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      k.id || crypto.randomUUID(),
      k.date || clock.dateTimeLabel,
      k.ingName || '',
      k.type || 'SALIDA',
      k.doc || '',
      stockQty(k.prev),
      stockQty(k.qty),
      stockQty(k.next),
      k.unit || '',
      k.ingredientId || null,
      k.orderId || null,
      bDate,
      clock.iso
    ));
  }

  const purchases = Array.isArray(legacy?.purchases) ? legacy.purchases : [];
  for (let i = purchases.length - 1; i >= 0; i--) {
    const p = purchases[i];
    if (!p) continue;
    const bDate = parseLegacyDateToLima(p.date, clock.businessDate);
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO pos_purchases
        (id, business_date, date_label, doc, supplier, item, ingredient_id, qty, total, created_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      p.id || crypto.randomUUID(),
      bDate,
      p.date || clock.dateTimeLabel,
      p.doc || '',
      p.supplier || '',
      p.item || '',
      p.ingredientId || null,
      Number(p.qty) || 0,
      roundMoney(p.total),
      clock.iso
    ));
  }

  const boletas = Array.isArray(legacy?.boletas) ? legacy.boletas : [];
  const boletaDateByNum = new Map();
  for (let i = boletas.length - 1; i >= 0; i--) {
    const b = boletas[i];
    if (!b?.boletaNum) continue;
    const bDate = orderDateById.get(b.orderId) || parseLegacyDateToLima(b.date, clock.businessDate);
    boletaDateByNum.set(b.boletaNum, bDate);
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO pos_boletas
        (boleta_num, code, order_id, shift_id, business_date, customer, payment_method, total, date_label, created_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      b.boletaNum,
      b.code || '',
      b.orderId || '',
      `shift_${bDate}`,
      bDate,
      b.customer || '',
      b.paymentMethod || '',
      roundMoney(b.total),
      b.date || clock.dateTimeLabel,
      clock.iso
    ));
  }

  const movements = Array.isArray(legacy?.caja?.movements) ? legacy.caja.movements : [];
  const legacyOpening = roundMoney(legacy?.caja?.opening);
  const shiftDates = new Set();
  for (let i = movements.length - 1; i >= 0; i--) {
    const m = movements[i];
    if (!m) continue;
    const bolMatch = String(m.desc || '').match(/\b(BI-\d{3}-\d+)\b/);
    const boletaNum = bolMatch ? bolMatch[1] : null;
    const cmTimeMatch = String(m.id || '').match(/^cm_(\d{12,15})$/);
    const cmTimeDate = cmTimeMatch ? limaClock(new Date(Number(cmTimeMatch[1]))).businessDate : null;
    const bDate = (boletaNum && boletaDateByNum.get(boletaNum)) || cmTimeDate || clock.businessDate;
    shiftDates.add(bDate);
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO cash_movements
        (id, time, desc, method, amount, type, shift_id, business_date, order_id, boleta_num, created_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      m.id || crypto.randomUUID(),
      m.time || clock.timeLabel,
      m.desc || '',
      m.method || 'Efectivo',
      roundMoney(m.amount),
      m.type || 'VENTA',
      `shift_${bDate}`,
      bDate,
      m.orderId || null,
      boletaNum,
      clock.iso
    ));
  }
  if (legacyOpening > 0 || (movements.length > 0 && !shiftDates.has(clock.businessDate))) {
    if (legacyOpening > 0) shiftDates.add(clock.businessDate);
  }
  for (const bDate of shiftDates) {
    const isToday = bDate === clock.businessDate;
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO cash_shifts (id, business_date, status, opening_amount, opened_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      `shift_${bDate}`,
      bDate,
      isToday ? 'OPEN' : 'OPEN',
      isToday ? legacyOpening : 0,
      isToday ? clock.iso : limaMidnightAfterIso(bDate)
    ));
  }

  const counters = legacy?.counters || { order: 0, boleta: 0, kardex: 0 };
  for (const [name, val] of [
    ['order', Number(counters.order) || 0],
    ['boleta', Number(counters.boleta) || boletas.length],
    ['kardex', Number(counters.kardex) || kardex.length],
    ['sort_seq', maxSort],
    ['migrated_v2', 1]
  ]) {
    statements.push(db.prepare('INSERT OR REPLACE INTO pos_counters (name, val) VALUES (?, ?)').bind(name, val));
  }

  if (legacyRow) {
    statements.push(db.prepare("UPDATE pos_state SET payload = '{}' WHERE id = 1"));
  }

  for (let offset = 0; offset < statements.length; offset += 80) {
    await db.batch(statements.slice(offset, offset + 80));
  }
}

export async function getBusinessStatus(db, now = new Date()) {
  const clock = limaClock(now);
  const override = await db.prepare('SELECT business_date, closed, reason, updated_at FROM pos_closed_days WHERE business_date = ?')
    .bind(clock.businessDate).first();
  if (override) {
    const closed = Number(override.closed) === 1;
    const reason = override.reason || (clock.isSunday ? CLOSED_SUNDAY_MESSAGE : CLOSED_MANUAL_MESSAGE);
    return {
      businessDate: clock.businessDate,
      weekdayName: clock.weekdayName,
      isSunday: clock.isSunday,
      open: !closed,
      closedManual: closed,
      reason: closed ? (clock.isSunday ? 'SUNDAY_CLOSED' : 'MANUAL_CLOSED') : 'MANUAL_OPEN',
      message: closed ? reason : ''
    };
  }
  if (clock.isSunday) {
    return {
      businessDate: clock.businessDate,
      weekdayName: clock.weekdayName,
      isSunday: true,
      open: false,
      closedManual: false,
      reason: 'SUNDAY_CLOSED',
      message: CLOSED_SUNDAY_MESSAGE
    };
  }
  return {
    businessDate: clock.businessDate,
    weekdayName: clock.weekdayName,
    isSunday: false,
    open: true,
    closedManual: false,
    reason: 'OPEN',
    message: ''
  };
}

export async function computeShiftStats(db, shift) {
  const cashRow = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'VENTA' AND method = 'Efectivo' THEN amount ELSE 0 END), 0) AS cash_sales,
       COALESCE(SUM(CASE WHEN type = 'VENTA' AND method != 'Efectivo' THEN amount ELSE 0 END), 0) AS digital_sales,
       COALESCE(SUM(CASE WHEN type = 'EGRESO' THEN ABS(amount) ELSE 0 END), 0) AS expenses_total
     FROM cash_movements
     WHERE shift_id = ? OR (shift_id IS NULL AND business_date = ?)`
  ).bind(shift.id, shift.business_date).first();

  const orderRow = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM pos_orders
     WHERE (shift_id = ? OR (shift_id IS NULL AND business_date = ?))
       AND status NOT IN ('CANCELADO', 'RECHAZADO')`
  ).bind(shift.id, shift.business_date).first();

  const boletaRow = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM pos_boletas
     WHERE shift_id = ? OR (shift_id IS NULL AND business_date = ?)`
  ).bind(shift.id, shift.business_date).first();

  const opening = roundMoney(shift.opening_amount);
  const cashSales = roundMoney(cashRow?.cash_sales);
  const digitalSales = roundMoney(cashRow?.digital_sales);
  const expensesTotal = roundMoney(cashRow?.expenses_total);
  return {
    opening,
    cashSales,
    digitalSales,
    expensesTotal,
    expectedCash: roundMoney(opening + cashSales - expensesTotal),
    ordersCount: Number(orderRow?.cnt) || 0,
    boletasCount: Number(boletaRow?.cnt) || 0
  };
}

export function revisionBumpStatement(db, nextRevision) {
  return db.prepare(
    `INSERT INTO pos_state (id, payload, revision, updated_at)
     VALUES (1, '{}', ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       revision = excluded.revision,
       updated_at = datetime('now')`
  ).bind(nextRevision);
}

/**
 * Automatically closes any open shift whose Lima business_date is before today (past 00:00).
 */
export async function reconcileOpenShifts(db, now = new Date()) {
  const clock = limaClock(now);
  const { results: expired } = await db.prepare(
    "SELECT * FROM cash_shifts WHERE status = 'OPEN' AND business_date < ? ORDER BY business_date ASC"
  ).bind(clock.businessDate).all();

  if (!expired.length) return [];
  const closedShifts = [];
  for (const shift of expired) {
    const stats = await computeShiftStats(db, shift);
    const closedAt = limaMidnightAfterIso(shift.business_date);
    const nextRev = crypto.randomUUID();
    const [res] = await db.batch([
      db.prepare(
        `UPDATE cash_shifts
         SET status = 'AUTO_CLOSED',
             closed_at = ?,
             close_reason = ?,
             cash_sales = ?,
             digital_sales = ?,
             expenses_total = ?,
             expected_cash = ?,
             orders_count = ?,
             boletas_count = ?
         WHERE id = ? AND status = 'OPEN'`
      ).bind(
        closedAt,
        DEFAULT_AUTO_CLOSE_NOTE,
        stats.cashSales,
        stats.digitalSales,
        stats.expensesTotal,
        stats.expectedCash,
        stats.ordersCount,
        stats.boletasCount,
        shift.id
      ),
      revisionBumpStatement(db, nextRev)
    ]);
    if (res.meta.changes) {
      closedShifts.push(shift.business_date);
    }
  }
  return closedShifts;
}

/**
 * Ensures an OPEN shift row exists for an open operating day on its first live activity.
 */
export async function ensureTodayOpenShift(db, businessDate, nowIso) {
  const existing = await db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(businessDate).first();
  if (existing) return existing;
  const id = `shift_${businessDate}`;
  await db.prepare(
    `INSERT INTO cash_shifts (id, business_date, status, opening_amount, opened_at, notes)
     VALUES (?, ?, 'OPEN', 0, ?, '')
     ON CONFLICT(business_date) DO NOTHING`
  ).bind(id, businessDate, nowIso).run();
  return db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(businessDate).first();
}

export async function getActiveRecipeOverrides(db) {
  const { results } = await db.prepare('SELECT product_id, ingredient_id, qty FROM pos_recipes').all();
  const map = {};
  for (const row of results) {
    map[row.product_id] ||= {};
    map[row.product_id][row.ingredient_id] = stockQty(row.qty);
  }
  return map;
}

export function recipeForProduct(product, recipeOverrides) {
  if (!product) return new Map();
  const recipe = new Map((product.recipe || []).map(({ id, qty }) => [id, qty]));
  for (const [id, qty] of Object.entries(recipeOverrides?.[product.id] || {})) {
    recipe.set(id, qty);
  }
  return recipe;
}

export async function buildOrderDeductions(db, items, { orderId, code, action = 'Aprobación', dateLabel, businessDate, createdIso }) {
  const recipeOverrides = await getActiveRecipeOverrides(db);
  const usage = new Map();
  const addUsage = (id, qty) => usage.set(id, (usage.get(id) || 0) + qty);

  for (const item of items || []) {
    for (const [id, qty] of recipeForProduct(menuById.get(item.menuId), recipeOverrides)) {
      if (qty > 0) addUsage(id, qty * item.qty);
    }
    for (const selected of item.extras || []) {
      const extra = extrasById.get(selected.id);
      if (extra) addUsage(extra.ingId, extra.qty * item.qty);
    }
  }

  if (!usage.size) return [];
  const { results: ingRows } = await db.prepare('SELECT * FROM ingredients').all();
  const ingMap = new Map(ingRows.map(row => [row.id, row]));
  const counterRow = await db.prepare("SELECT val FROM pos_counters WHERE name = 'kardex'").first();
  let nextKardex = Number(counterRow?.val) || 0;
  const statements = [];

  for (const [ingId, consumed] of usage) {
    const ing = ingMap.get(ingId);
    if (!ing) continue;
    const prev = stockQty(ing.stock);
    const next = stockQty(prev - consumed);
    const delta = stockQty(next - prev);
    nextKardex += 1;
    statements.push(
      db.prepare('UPDATE ingredients SET stock = ? WHERE id = ?').bind(next, ingId),
      db.prepare(
        `INSERT INTO kardex_movements
          (id, date, ing_name, type, doc, prev_stock, qty, next_stock, unit, ingredient_id, order_id, business_date, created_iso)
         VALUES (?, ?, ?, 'SALIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `k${nextKardex}`,
        dateLabel,
        ing.name,
        `${action} ${code}`,
        prev,
        delta,
        next,
        ing.unit,
        ing.id,
        orderId,
        businessDate,
        createdIso
      )
    );
  }
  if (statements.length) {
    statements.push(db.prepare("INSERT OR REPLACE INTO pos_counters (name, val) VALUES ('kardex', ?)").bind(nextKardex));
  }
  return statements;
}

export async function loadKitchenOrders(db, now = new Date()) {
  const clock = limaClock(now);
  const { results } = await db.prepare(
    `SELECT * FROM pos_orders
     WHERE status IN ('POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF', 'ENTREGADO')
       AND (status != 'ENTREGADO' OR business_date = ? OR id IN (SELECT id FROM pos_orders ORDER BY sort_order DESC, rowid DESC LIMIT 120))
     ORDER BY sort_order DESC, rowid DESC
     LIMIT 250`
  ).bind(clock.businessDate).all();

  return results.map(row => {
    const o = dbRowToOrder(row);
    const sanitized = {
      id: o.id,
      code: o.code,
      num: o.num,
      table: o.table,
      channel: o.channel,
      status: o.status,
      takeaway: o.takeaway,
      approvedAt: o.approvedAt,
      preparationStartedAt: o.preparationStartedAt,
      stationCompletedAt: o.stationCompletedAt,
      completedAt: o.completedAt,
      note: o.status === 'POR_APROBAR' ? '' : o.note,
      items: o.status === 'POR_APROBAR'
        ? []
        : o.items
          .filter(item => item.menuId !== 'delivery-card-fee')
          .map(({ name, qty, station, menuId, flavors, extras, note }) => ({
            name,
            qty,
            station,
            menuId,
            flavors: flavors || [],
            extras: (extras || []).map(({ name: extraName }) => ({ name: extraName })),
            note
          }))
    };
    return sanitized;
  });
}

export async function loadStateSnapshot(db, now = new Date()) {
  const clock = limaClock(now);
  const businessStatus = await getBusinessStatus(db, now);

  const [
    { results: orderRows },
    { results: ingRows },
    { results: supRows },
    { results: purRows },
    { results: karRows },
    { results: counterRows },
    todayShiftRow,
    lastClosedRow,
    recipeQuantities
  ] = await Promise.all([
    db.prepare(
      `SELECT * FROM pos_orders
       WHERE status IN ('POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF')
          OR business_date = ?
          OR id IN (SELECT id FROM pos_orders ORDER BY sort_order DESC, rowid DESC LIMIT 100)
       ORDER BY sort_order DESC, rowid DESC
       LIMIT 250`
    ).bind(clock.businessDate).all(),
    db.prepare('SELECT * FROM ingredients ORDER BY code ASC').all(),
    db.prepare('SELECT * FROM pos_suppliers ORDER BY name ASC').all(),
    db.prepare('SELECT * FROM pos_purchases ORDER BY rowid DESC LIMIT 60').all(),
    db.prepare('SELECT * FROM kardex_movements ORDER BY rowid DESC LIMIT 100').all(),
    db.prepare('SELECT name, val FROM pos_counters').all(),
    db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(clock.businessDate).first(),
    db.prepare("SELECT * FROM cash_shifts WHERE status IN ('CLOSED', 'AUTO_CLOSED') ORDER BY business_date DESC LIMIT 1").first(),
    getActiveRecipeOverrides(db)
  ]);

  let shiftMovements = [];
  let shiftBoletas = [];
  let shiftData = null;

  if (todayShiftRow) {
    const [{ results: movRows }, { results: bolRows }, liveStats] = await Promise.all([
      db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? OR (shift_id IS NULL AND business_date = ?) ORDER BY rowid DESC')
        .bind(todayShiftRow.id, clock.businessDate).all(),
      db.prepare('SELECT * FROM pos_boletas WHERE shift_id = ? OR (shift_id IS NULL AND business_date = ?) ORDER BY rowid DESC')
        .bind(todayShiftRow.id, clock.businessDate).all(),
      computeShiftStats(db, todayShiftRow)
    ]);
    shiftMovements = movRows.map(m => ({
      id: m.id, time: m.time, desc: m.desc, method: m.method, amount: roundMoney(m.amount), type: m.type
    }));
    shiftBoletas = bolRows.map(b => ({
      boletaNum: b.boleta_num,
      code: b.code,
      orderId: b.order_id,
      customer: b.customer,
      paymentMethod: b.payment_method,
      total: roundMoney(b.total),
      date: b.date_label
    }));
    shiftData = {
      ...dbRowToShift(todayShiftRow),
      ...(todayShiftRow.status === 'OPEN' ? liveStats : {})
    };
  }

  const counterMap = Object.fromEntries(counterRows.map(row => [row.name, Number(row.val) || 0]));
  return {
    businessStatus,
    activeShift: shiftData?.status === 'OPEN' ? shiftData : null,
    lastClosedShift: dbRowToShift(lastClosedRow),
    state: {
      counters: {
        order: counterMap.order || 0,
        boleta: counterMap.boleta || 0,
        kardex: counterMap.kardex || 0
      },
      recipeQuantities,
      ingredients: ingRows.map(i => ({
        id: i.id,
        code: i.code,
        name: i.name,
        station: i.station,
        unit: i.unit,
        stock: stockQty(i.stock),
        minStock: stockQty(i.min_stock),
        cost: roundMoney(i.cost)
      })),
      suppliers: supRows.map(s => ({
        id: s.id, ruc: s.ruc, name: s.name, category: s.category, contact: s.contact
      })),
      purchases: purRows.map(p => ({
        id: p.id, date: p.date_label, doc: p.doc, supplier: p.supplier, item: p.item, total: roundMoney(p.total)
      })),
      orders: orderRows.map(dbRowToOrder),
      kardex: karRows.map(k => ({
        id: k.id,
        date: k.date,
        ingName: k.ing_name,
        ingredientId: k.ingredient_id,
        orderId: k.order_id,
        type: k.type,
        doc: k.doc,
        prev: stockQty(k.prev_stock),
        qty: stockQty(k.qty),
        next: stockQty(k.next_stock),
        unit: k.unit
      })),
      caja: {
        shiftId: shiftData?.id || null,
        businessDate: clock.businessDate,
        status: shiftData?.status || 'NOT_OPENED',
        opening: shiftData?.opening || 0,
        openedAt: shiftData?.openedAt || null,
        closedAt: shiftData?.closedAt || null,
        closeReason: shiftData?.closeReason || '',
        movements: shiftMovements
      },
      boletas: shiftBoletas
    }
  };
}

export async function buildPeriodReport(db, { period = 'day', anchorDate, now = new Date() }) {
  const clock = limaClock(now);
  const range = reportDateRange(period, anchorDate || clock.businessDate);

  const [
    { results: shiftRows },
    methodRow,
    orderAgg,
    { results: orderRows },
    { results: boletaRows },
    { results: monthlyRows }
  ] = await Promise.all([
    db.prepare(
      `SELECT * FROM cash_shifts
       WHERE business_date BETWEEN ? AND ?
       ORDER BY business_date DESC`
    ).bind(range.startDate, range.endDate).all(),
    db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'VENTA' AND method = 'Efectivo' THEN amount ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN type = 'VENTA' AND method = 'Yape' THEN amount ELSE 0 END), 0) AS yape,
         COALESCE(SUM(CASE WHEN type = 'VENTA' AND method = 'Plin' THEN amount ELSE 0 END), 0) AS plin,
         COALESCE(SUM(CASE WHEN type = 'VENTA' AND method = 'Tarjeta' THEN amount ELSE 0 END), 0) AS tarjeta,
         COALESCE(SUM(CASE WHEN type = 'VENTA' THEN amount ELSE 0 END), 0) AS total_sales,
         COALESCE(SUM(CASE WHEN type = 'EGRESO' THEN ABS(amount) ELSE 0 END), 0) AS expenses_total
       FROM cash_movements
       WHERE business_date BETWEEN ? AND ?`
    ).bind(range.startDate, range.endDate).first(),
    db.prepare(
      `SELECT
         COUNT(CASE WHEN status NOT IN ('CANCELADO', 'RECHAZADO') THEN 1 END) AS active_count,
         COUNT(CASE WHEN status IN ('CANCELADO', 'RECHAZADO') THEN 1 END) AS cancelled_count,
         COALESCE(SUM(CASE WHEN status NOT IN ('CANCELADO', 'RECHAZADO') THEN total ELSE 0 END), 0) AS orders_total
       FROM pos_orders
       WHERE business_date BETWEEN ? AND ?`
    ).bind(range.startDate, range.endDate).first(),
    db.prepare(
      `SELECT * FROM pos_orders
       WHERE business_date BETWEEN ? AND ?
       ORDER BY sort_order DESC, rowid DESC
       LIMIT 100`
    ).bind(range.startDate, range.endDate).all(),
    db.prepare(
      `SELECT * FROM pos_boletas
       WHERE business_date BETWEEN ? AND ?
       ORDER BY rowid DESC
       LIMIT 100`
    ).bind(range.startDate, range.endDate).all(),
    period === 'year'
      ? db.prepare(
        `SELECT
           substr(business_date, 1, 7) AS month_key,
           COUNT(*) AS open_days,
           COALESCE(SUM(cash_sales), 0) AS cash_sales,
           COALESCE(SUM(digital_sales), 0) AS digital_sales,
           COALESCE(SUM(expenses_total), 0) AS expenses_total,
           COALESCE(SUM(orders_count), 0) AS orders_count,
           COALESCE(SUM(boletas_count), 0) AS boletas_count
         FROM cash_shifts
         WHERE business_date BETWEEN ? AND ?
         GROUP BY month_key
         ORDER BY month_key DESC`
      ).bind(range.startDate, range.endDate).all()
      : Promise.resolve({ results: [] })
  ]);

  // Refresh live metrics on any OPEN shift inside the range so current day report matches real time.
  const shifts = [];
  for (const row of shiftRows) {
    if (row.status === 'OPEN') {
      const live = await computeShiftStats(db, row);
      shifts.push({ ...dbRowToShift(row), ...live });
    } else {
      shifts.push(dbRowToShift(row));
    }
  }

  const cashSales = roundMoney(methodRow?.efectivo);
  const yape = roundMoney(methodRow?.yape);
  const plin = roundMoney(methodRow?.plin);
  const tarjeta = roundMoney(methodRow?.tarjeta);
  const totalSales = roundMoney(methodRow?.total_sales);
  const expensesTotal = roundMoney(methodRow?.expenses_total);
  const boletasCount = boletaRows.length >= 100
    ? Number((await db.prepare('SELECT COUNT(*) AS cnt FROM pos_boletas WHERE business_date BETWEEN ? AND ?').bind(range.startDate, range.endDate).first())?.cnt) || boletaRows.length
    : boletaRows.length;
  const ordersCount = Number(orderAgg?.active_count) || 0;

  // For year views, also compute open shift live numbers into monthly bucket if active shift exists in that year.
  const months = monthlyRows.map(m => {
    const openInMonth = shifts.find(s => s.status === 'OPEN' && s.businessDate.startsWith(m.month_key));
    const cash = roundMoney(m.cash_sales) + (openInMonth ? openInMonth.cashSales : 0);
    const digital = roundMoney(m.digital_sales) + (openInMonth ? openInMonth.digitalSales : 0);
    const expenses = roundMoney(m.expenses_total) + (openInMonth ? openInMonth.expensesTotal : 0);
    return {
      month: m.month_key,
      openDays: Number(m.open_days) || 0,
      cashSales: roundMoney(cash),
      digitalSales: roundMoney(digital),
      totalSales: roundMoney(cash + digital),
      expensesTotal: roundMoney(expenses),
      ordersCount: (Number(m.orders_count) || 0) + (openInMonth ? openInMonth.ordersCount : 0),
      boletasCount: (Number(m.boletas_count) || 0) + (openInMonth ? openInMonth.boletasCount : 0)
    };
  });

  return {
    range,
    summary: {
      openDays: shifts.length,
      cashSales,
      digitalSales: roundMoney(yape + plin + tarjeta),
      totalSales,
      expensesTotal,
      netCashFlow: roundMoney(cashSales - expensesTotal),
      ordersCount,
      cancelledCount: Number(orderAgg?.cancelled_count) || 0,
      boletasCount,
      ticketAvg: boletasCount ? roundMoney(totalSales / boletasCount) : 0
    },
    byMethod: { Efectivo: cashSales, Yape: yape, Plin: plin, Tarjeta: tarjeta },
    shifts,
    months,
    boletas: boletaRows.map(b => ({
      boletaNum: b.boleta_num,
      code: b.code,
      orderId: b.order_id,
      businessDate: b.business_date,
      customer: b.customer,
      paymentMethod: b.payment_method,
      total: roundMoney(b.total),
      date: b.date_label
    })),
    orders: orderRows.map(dbRowToOrder)
  };
}

export async function repriceEditedOrder({ order, items, takeaway, tapers, note }) {
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 350) : order.note;
  return {
    ...priceOrder(items, {
      tapers,
      channel: order.channel,
      paymentMethod: order.paymentMethod
    }),
    takeaway: order.channel === 'MESA' ? Boolean(takeaway) : false,
    note: cleanNote
  };
}
