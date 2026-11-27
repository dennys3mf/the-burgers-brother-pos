import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { onRequest } from '../functions/api/[[route]].js';

const migrations = new URL('../migrations/', import.meta.url);
const origin = 'https://pos.example';
const adminPassword = 'local-admin-fixture-only';

crypto.subtle.timingSafeEqual ??= timingSafeEqual;

function createSqliteFixture(t, { stopBefore = null } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const files = readdirSync(migrations).filter(name => name.endsWith('.sql')).sort();
  for (const name of files) {
    if (stopBefore && name >= stopBefore) break;
    sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  const applyRemainingMigrations = () => {
    for (const name of files) {
      if (!stopBefore || name < stopBefore) continue;
      sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
    }
  };
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bind = (...parameters) => ({
        bind,
        first: () => statement.get(...parameters),
        all: () => ({ results: statement.all(...parameters) }),
        run: () => ({ meta: statement.run(...parameters) }),
      });
      return bind();
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = { DB, STAFF_PASSWORD: adminPassword };
  const call = (path, { method = 'GET', body, cookie, headers = {} } = {}) => onRequest({
    env,
    request: new Request(origin + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  });
  async function signInAdmin() {
    const response = await call('/api/session', { method: 'POST', body: { password: adminPassword, role: 'admin' } });
    assert.equal(response.status, 200);
    return response.headers.get('Set-Cookie').split(';')[0];
  }
  return { sqlite, applyRemainingMigrations, call, signInAdmin };
}

test('Sundays and closed days block QR order submission without creating ghost shifts', async t => {
  const { sqlite, call, signInAdmin } = createSqliteFixture(t);
  // Sunday 2026-11-29 14:00 Lima (UTC-5) = 19:00Z
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-29T19:00:00.000Z') });

  const statusRes = await call('/api/status');
  assert.equal(statusRes.status, 200);
  const { businessStatus } = await statusRes.json();
  assert.equal(businessStatus.open, false);
  assert.equal(businessStatus.isSunday, true);
  assert.equal(businessStatus.businessDate, '2026-11-29');

  const blockedOrder = await call('/api/orders', {
    method: 'POST',
    body: { id: crypto.randomUUID(), channel: 'MESA', table: 'Mesa 2', customer: 'Lucia', items: [{ menuId: 'm1', qty: 1 }] },
  });
  assert.equal(blockedOrder.status, 403);
  const blockedPayload = await blockedOrder.json();
  assert.equal(blockedPayload.closed, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS cnt FROM pos_orders').get().cnt, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS cnt FROM cash_shifts').get().cnt, 0);

  // Move clock to Monday 2026-11-30 12:00 Lima -> open by default, then manually close for a holiday.
  t.mock.timers.setTime(Date.parse('2026-11-30T17:00:00.000Z'));
  const admin = await signInAdmin();
  assert.equal((await (await call('/api/status')).json()).businessStatus.open, true);

  // Customer name is mandatory on open days for both Mesa and Delivery
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: { id: crypto.randomUUID(), channel: 'MESA', table: 'Mesa 1', customer: '   ', items: [{ menuId: 'm1', qty: 1 }] },
  })).status, 400);
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: {
      id: crypto.randomUUID(), channel: 'DELIVERY', customer: '', phone: '999888777',
      address: 'Av. Lima 10', payRef: 'OP-01', paymentMethod: 'Yape', items: [{ menuId: 'm1', qty: 1 }],
    },
  })).status, 400);

  const closeMon = await call('/api/business/day-status', {
    method: 'POST',
    cookie: admin,
    body: { closed: true, reason: 'Feriado local' },
  });
  assert.equal(closeMon.status, 200);
  const monOrder = await call('/api/orders', {
    method: 'POST',
    body: { id: crypto.randomUUID(), channel: 'MESA', table: 'Mesa 1', customer: 'Lucia', items: [{ menuId: 'm1', qty: 1 }] },
  });
  assert.equal(monOrder.status, 403);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS cnt FROM cash_shifts').get().cnt, 0);
});

test('midnight 00:00 Lima auto-closes active shift and preserves historical day/week/month/year reports', async t => {
  const { sqlite, call, signInAdmin } = createSqliteFixture(t);
  // Thursday 2026-11-26 17:00 Lima (UTC-5) = 22:00Z
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-26T22:00:00.000Z') });
  const admin = await signInAdmin();

  const openRes = await call('/api/shifts/open', {
    method: 'POST',
    cookie: admin,
    body: { openingAmount: 100 },
  });
  assert.equal(openRes.status, 200);
  assert.equal((await openRes.json()).shift.opening, 100);

  // Create one Mesa order (cash later) and one Delivery order (Yape on approve)
  const mesaId = crypto.randomUUID();
  const delId = crypto.randomUUID();
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: { id: mesaId, channel: 'MESA', table: 'Mesa 3', customer: 'Pedro', items: [{ menuId: 'm1', qty: 2 }] },
  })).status, 201);
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: {
      id: delId, channel: 'DELIVERY', customer: 'Ana', phone: '999888777',
      address: 'Av. Lima 10', payRef: 'OP-11', paymentMethod: 'Yape',
      tapers: 1, items: [{ menuId: 'm18', qty: 1 }],
    },
  })).status, 201);

  // Approve both -> deducts recipes into D1 + delivery emits boleta/cash movement
  assert.equal((await call(`/api/orders/${mesaId}/approve`, { method: 'POST', cookie: admin, body: {} })).status, 200);
  const approveDel = await call(`/api/orders/${delId}/approve`, {
    method: 'POST',
    cookie: admin,
    body: { verifiedPayment: true },
  });
  assert.equal(approveDel.status, 200);
  const approvedDelJson = await approveDel.json();
  assert.equal(approvedDelJson.order.boletaNum, 'BI-001-00001');

  // Record purchase to verify incremental inventory/purchase updates
  assert.equal((await call('/api/purchases', {
    method: 'POST',
    cookie: admin,
    body: { supplier: 'Distribuidora', ingredientId: 'ing_pan', quantity: 20, total: 30, doc: 'F001-10' },
  })).status, 201);

  // Complete Mesa order in Kitchen and pay in Cash
  assert.equal((await call('/api/kitchen/complete', {
    method: 'POST',
    cookie: admin,
    body: { id: mesaId, station: 'COCINA' },
  })).status, 200);
  const payMesa = await call(`/api/orders/${mesaId}/pay`, {
    method: 'POST',
    cookie: admin,
    body: { paymentMethod: 'Efectivo' },
  });
  assert.equal(payMesa.status, 200);
  assert.equal((await payMesa.json()).boletaNum, 'BI-001-00002');

  // Record cash expense S/ 12.00
  assert.equal((await call('/api/caja/expense', {
    method: 'POST',
    cookie: admin,
    body: { desc: 'Hielo', amount: 12 },
  })).status, 200);

  // Verify pan stock deducted by 2 (2x m1) and incremented by 20 (purchase) = 18
  const panStock = sqlite.prepare("SELECT stock FROM ingredients WHERE id = 'ing_pan'").get().stock;
  assert.equal(panStock, 18);

  // Cross midnight to Friday 2026-11-27 00:05 Lima (05:05Z) -> auto-close Thu shift!
  t.mock.timers.setTime(Date.parse('2026-11-27T05:05:00.000Z'));
  const nextDayState = await (await call('/api/state', { cookie: admin })).json();
  assert.equal(nextDayState.businessStatus.businessDate, '2026-11-27');
  assert.equal(nextDayState.activeShift, null);
  assert.equal(nextDayState.lastClosedShift.businessDate, '2026-11-26');
  assert.equal(nextDayState.lastClosedShift.status, 'AUTO_CLOSED');
  assert.equal(nextDayState.lastClosedShift.closedAt, '2026-11-27T05:00:00.000Z');
  // Cash: 2 * m1 (28.00) + opening (100) - expense (12) = 116.00; Yape: 12 + 1 taper = 13.00
  assert.equal(nextDayState.lastClosedShift.cashSales, 28);
  assert.equal(nextDayState.lastClosedShift.digitalSales, 13);
  assert.equal(nextDayState.lastClosedShift.expensesTotal, 12);
  assert.equal(nextDayState.lastClosedShift.expectedCash, 116);
  assert.equal(nextDayState.lastClosedShift.boletasCount, 2);

  // Add a sale on Friday 2026-11-27 and verify week / month / year reports aggregate both days cleanly.
  const friId = crypto.randomUUID();
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: { id: friId, channel: 'MESA', table: 'Mesa 4', customer: 'Elena', items: [{ menuId: 'm24', qty: 2 }] },
  })).status, 201);
  assert.equal((await call(`/api/orders/${friId}/approve`, { method: 'POST', cookie: admin, body: {} })).status, 200);
  assert.equal((await call('/api/kitchen/complete', {
    method: 'POST',
    cookie: admin,
    body: { id: friId, station: 'BARRA' },
  })).status, 200);
  assert.equal((await call(`/api/orders/${friId}/pay`, {
    method: 'POST',
    cookie: admin,
    body: { paymentMethod: 'Plin' },
  })).status, 200);
  assert.equal((await call('/api/shifts/close', {
    method: 'POST',
    cookie: admin,
    body: { countedCash: 0, notes: 'Cierre viernes' },
  })).status, 200);

  const yearReport = await (await call('/api/reports?period=year&date=2026-11-27', { cookie: admin })).json();
  assert.equal(yearReport.summary.openDays, 2);
  assert.equal(yearReport.summary.totalSales, 51); // 28 + 13 + 10
  assert.equal(yearReport.summary.expensesTotal, 12);
  assert.equal(yearReport.summary.boletasCount, 3);
  assert.equal(yearReport.byMethod.Efectivo, 28);
  assert.equal(yearReport.byMethod.Yape, 13);
  assert.equal(yearReport.byMethod.Plin, 10);
  assert.equal(yearReport.months[0].month, '2026-11');

  // Verify pos_state no longer accumulates historical JSON payload
  const payloadLen = sqlite.prepare('SELECT LENGTH(payload) AS len FROM pos_state WHERE id = 1').get().len;
  assert.ok(payloadLen <= 10, `expected compact pos_state payload, got ${payloadLen} bytes`);
});

test('legacy single-row pos_state data migrates cleanly once 0005 schema runs', async t => {
  const { sqlite, applyRemainingMigrations, call, signInAdmin } = createSqliteFixture(t, {
    stopBefore: '0005_'
  });
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-26T20:00:00.000Z') });

  const legacyOrderId = crypto.randomUUID();
  const legacyPayload = {
    counters: { order: 1, boleta: 1, kardex: 1 },
    ingredients: [
      { id: 'ing_carne', code: 'IN-01', name: 'Carne Asado de Tira', station: 'COCINA', unit: 'g', stock: 5000, minStock: 1000, cost: 0.03 }
    ],
    suppliers: [{ id: 's1', ruc: '20111111111', name: 'Carnes SAC', category: 'Carnes', contact: '999000111' }],
    purchases: [{ id: 'p1', date: '26/11/26, 10:00', doc: 'F-01', supplier: 'Carnes SAC', item: 'Carne (1000 g)', total: 30 }],
    orders: [{
      id: legacyOrderId, num: 'LEG1', code: 'BB-LEG1', channel: 'MESA', table: 'Mesa 2',
      customer: 'Luis', paymentStatus: 'PAGADO', paymentMethod: 'Efectivo',
      status: 'ENTREGADO', boletaNum: 'BI-001-00001', total: 14,
      items: [{ menuId: 'm1', name: 'Burger Classic', station: 'COCINA', qty: 1, basePrice: 14, unitPrice: 14, extras: [], flavors: [], note: '' }],
      createdAt: '26/11/26, 14:00', approvedAt: '26/11/26, 14:02', completedAt: '2026-11-26T19:10:00.000Z'
    }],
    kardex: [{ id: 'k1', date: '26/11/26, 14:02', ingName: 'Carne Asado de Tira', ingredientId: 'ing_carne', orderId: legacyOrderId, type: 'SALIDA', doc: 'Aprobación BB-LEG1', prev: 5150, qty: -150, next: 5000, unit: 'g' }],
    caja: { opening: 50, movements: [{ id: 'cm1', time: '14:15', desc: 'Mesa 2 BB-LEG1 (BI-001-00001)', method: 'Efectivo', amount: 14, type: 'VENTA' }] },
    boletas: [{ boletaNum: 'BI-001-00001', code: 'BB-LEG1', orderId: legacyOrderId, customer: 'Luis', paymentMethod: 'Efectivo', total: 14, date: '26/11/26, 14:15' }]
  };
  sqlite.prepare("INSERT INTO pos_state (id, payload, revision) VALUES (1, ?, 'legacy-rev-1')").run(JSON.stringify(legacyPayload));

  applyRemainingMigrations();
  const admin = await signInAdmin();
  const stateRes = await call('/api/state', { cookie: admin });
  assert.equal(stateRes.status, 200);
  const { state, activeShift } = await stateRes.json();
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].code, 'BB-LEG1');
  assert.equal(state.kardex.length, 1);
  assert.equal(state.boletas.length, 1);
  assert.equal(state.suppliers.length, 1);
  assert.equal(state.purchases.length, 1);
  assert.equal(activeShift.opening, 50);
  assert.equal(activeShift.cashSales, 14);
  assert.equal(activeShift.expectedCash, 64);
  assert.equal(sqlite.prepare("SELECT payload FROM pos_state WHERE id = 1").get().payload, '{}');
});

test('incremental edits, cancel, ml/MERMA/CONTEO/recipes/suppliers, and post-close 409 guards', async t => {
  const { call, signInAdmin } = createSqliteFixture(t);
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-26T16:00:00.000Z') }); // Thu 11:00 Lima
  const admin = await signInAdmin();

  assert.equal((await call('/api/shifts/open', {
    method: 'POST',
    cookie: admin,
    body: { openingAmount: 100 },
  })).status, 200);

  // Create liquid ml ingredient, adjust CONTEO + MERMA, create supplier, set recipe
  const ingRes = await call('/api/inventory/ingredients', {
    method: 'POST',
    cookie: admin,
    body: { name: 'Aceite Vegetal', station: 'COCINA', unit: 'ml', minStock: 500 },
  });
  assert.equal(ingRes.status, 201);
  let stateBody = await (await call('/api/state', { cookie: admin })).json();
  const aceite = stateBody.state.ingredients.find(i => i.name === 'Aceite Vegetal');
  assert.ok(aceite);
  assert.equal(aceite.unit, 'ml');

  const countRes = await call('/api/inventory/adjust', {
    method: 'POST',
    cookie: admin,
    body: { ingredientId: aceite.id, type: 'CONTEO', quantity: 2000, reason: 'Conteo inicial' },
  });
  assert.equal(countRes.status, 200);
  assert.equal((await countRes.json()).nextStock, 2000);

  const mermaRes = await call('/api/inventory/adjust', {
    method: 'POST',
    cookie: admin,
    body: { ingredientId: aceite.id, type: 'MERMA', quantity: 150, reason: 'Merma fritura' },
  });
  assert.equal(mermaRes.status, 200);
  assert.equal((await mermaRes.json()).nextStock, 1850);

  assert.equal((await call('/api/suppliers', {
    method: 'POST',
    cookie: admin,
    body: { name: 'Distribuidora Lima', ruc: '20555666777', category: 'Abarrotes', contact: '999888777' },
  })).status, 201);

  assert.equal((await call('/api/inventory/recipes', {
    method: 'PUT',
    cookie: admin,
    body: { productId: 'm17', ingredientId: 'ing_nuggets', quantity: 6 },
  })).status, 200);

  // Create order -> approve -> complete kitchen -> edit adding m17 & taper -> verify reopened & deducted -> stale 409 check
  const ord1Id = crypto.randomUUID();
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: { id: ord1Id, channel: 'MESA', table: 'Mesa 2', customer: 'Mario', items: [{ menuId: 'm1', qty: 1 }] },
  })).status, 201);
  assert.equal((await call(`/api/orders/${ord1Id}/approve`, {
    method: 'POST',
    cookie: admin,
    body: { verifiedPayment: false },
  })).status, 200);
  assert.equal((await call('/api/kitchen/complete', {
    method: 'POST',
    cookie: admin,
    body: { id: ord1Id, station: 'COCINA' },
  })).status, 200);

  stateBody = await (await call('/api/state', { cookie: admin })).json();
  const nuggetsBefore = stateBody.state.ingredients.find(i => i.id === 'ing_nuggets').stock;
  const staleEdit = await call(`/api/orders/${ord1Id}/edit`, {
    method: 'POST',
    cookie: admin,
    headers: { 'If-Match': 'stale-revision-value' },
    body: {
      items: [{ menuId: 'm1', qty: 1 }, { menuId: 'm17', qty: 1 }],
      addedItems: [{ menuId: 'm17', qty: 1 }],
      takeaway: true,
      tapers: 1,
      note: 'Bien cocido',
    },
  });
  assert.equal(staleEdit.status, 409);

  const editRes = await call(`/api/orders/${ord1Id}/edit`, {
    method: 'POST',
    cookie: admin,
    headers: { 'If-Match': stateBody.revision },
    body: {
      items: [{ menuId: 'm1', qty: 1 }, { menuId: 'm17', qty: 1 }],
      addedItems: [{ menuId: 'm17', qty: 1 }],
      takeaway: true,
      tapers: 1,
      note: 'Bien cocido',
    },
  });
  assert.equal(editRes.status, 200);
  const edited = (await editRes.json()).order;
  assert.equal(edited.status, 'EN_COCINA');
  assert.equal(edited.takeaway, true);
  assert.ok(edited.items.some(i => i.menuId === 'taper' && i.qty === 1));

  const trackedOrderRes = await call(`/api/orders/${ord1Id}`);
  assert.equal(trackedOrderRes.status, 200);
  const trackedPayload = await trackedOrderRes.json();
  assert.equal(trackedPayload.status, 'EN_COCINA');
  assert.equal(trackedPayload.total, edited.total);

  stateBody = await (await call('/api/state', { cookie: admin })).json();
  assert.equal(stateBody.state.ingredients.find(i => i.id === 'ing_nuggets').stock, nuggetsBefore - 6);
  assert.equal(stateBody.state.suppliers.some(s => s.name === 'Distribuidora Lima'), true);

  // Create second order and cancel it cleanly
  const ord2Id = crypto.randomUUID();
  assert.equal((await call('/api/orders', {
    method: 'POST',
    body: { id: ord2Id, channel: 'MESA', table: 'Mesa 5', customer: 'Sofia', items: [{ menuId: 'm1', qty: 1 }] },
  })).status, 201);
  assert.equal((await call(`/api/orders/${ord2Id}/cancel`, {
    method: 'POST',
    cookie: admin,
    body: {},
  })).status, 200);

  // Close shift and verify post-close 409 guards and null activeShift
  assert.equal((await call('/api/shifts/close', {
    method: 'POST',
    cookie: admin,
    body: { countedCash: 100, notes: 'Fin' },
  })).status, 200);
  const postCloseState = await (await call('/api/state', { cookie: admin })).json();
  assert.equal(postCloseState.activeShift, null);
  assert.equal(postCloseState.lastClosedShift.status, 'CLOSED');
  assert.equal((await call('/api/shifts/open', {
    method: 'POST',
    cookie: admin,
    body: { openingAmount: 100 },
  })).status, 409);
  assert.equal((await call('/api/caja/expense', {
    method: 'POST',
    cookie: admin,
    body: { desc: 'Tardío', amount: 5 },
  })).status, 409);
  assert.equal((await call('/api/kitchen/complete', {
    method: 'POST',
    cookie: admin,
    body: { id: ord1Id, station: 'COCINA' },
  })).status, 200);
  assert.equal((await call(`/api/orders/${ord1Id}/pay`, {
    method: 'POST',
    cookie: admin,
    body: { paymentMethod: 'Efectivo' },
  })).status, 409);
});
