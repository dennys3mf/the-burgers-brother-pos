import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { onRequest } from '../functions/api/[[route]].js';

const migrations = new URL('../migrations/', import.meta.url);
const origin = 'https://pos.example';
const adminPassword = 'local-admin-fixture-only';
const chefPassword = 'local-chef-fixture-only';

// Workers provides this Web Crypto extension; Node exposes it through node:crypto.
crypto.subtle.timingSafeEqual ??= timingSafeEqual;

function createFixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
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

  async function signIn(password, role) {
    const response = await call('/api/session', { method: 'POST', body: { password, role } });
    assert.equal(response.status, 200);
    return response.headers.get('Set-Cookie').split(';')[0];
  }

  return { sqlite, call, signIn };
}

function mesaDraft() {
  return {
    id: crypto.randomUUID(),
    channel: 'MESA',
    table: 'Mesa 1',
    customer: 'Cliente prueba',
    items: [{ menuId: 'm1', qty: 1 }],
  };
}

test('an edit to an order outside the latest 50 updates its SQL projection atomically', async t => {
  const { sqlite, call, signIn } = createFixture(t);
  const cookie = await signIn(adminPassword, 'admin');
  const original = mesaDraft();
  let response = await call('/api/orders', { method: 'POST', body: original });
  assert.equal(response.status, 201);
  response = await call('/api/orders', { method: 'POST', body: original });
  assert.equal(response.status, 201);
  for (let index = 0; index < 69; index++) {
    response = await call('/api/orders', { method: 'POST', body: mesaDraft() });
    assert.equal(response.status, 201);
  }

  response = await call('/api/state', { cookie });
  const { revision, state } = await response.json();
  assert.equal(state.orders.length, 70);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM pos_orders').get().count, 70);
  const oldOrder = state.orders.at(-1);
  assert.equal(oldOrder.id, original.id);
  oldOrder.status = 'ENTREGADO';
  oldOrder.completedAt = '2026-11-26T15:01:00.000Z';
  oldOrder.stationCompletedAt = { COCINA: oldOrder.completedAt };
  oldOrder.note = 'Nota de prueba';
  const put = () => call('/api/state', {
    method: 'PUT',
    cookie,
    headers: { 'If-Match': revision },
    body: { state },
  });

  assert.equal((await put()).status, 200);
  const readSql = sqlite.prepare('SELECT status, completed_at, note FROM pos_orders WHERE id = ?');
  const expected = { status: 'ENTREGADO', completed_at: oldOrder.completedAt, note: oldOrder.note };
  assert.deepEqual({ ...readSql.get(original.id) }, expected);

  oldOrder.status = 'EN_COCINA';
  assert.equal((await put()).status, 409);
  assert.deepEqual({ ...readSql.get(original.id) }, expected);

  response = await call('/api/kitchen', { cookie });
  const { orders } = await response.json();
  const delivered = orders.find(order => order.id === original.id);
  assert.equal(delivered.status, 'ENTREGADO');
  assert.equal(delivered.completedAt, expected.completed_at);
  assert.deepEqual(delivered.stationCompletedAt, oldOrder.stationCompletedAt);
  assert.equal(delivered.note, expected.note);
  for (const field of ['customer', 'phone', 'address']) assert.ok(!(field in delivered));
});

test('a large inventory projects only changed stocks and costs for an accepted revision', async t => {
  const { sqlite, call, signIn } = createFixture(t);
  const admin = await signIn(adminPassword, 'admin');
  const { state } = await (await call('/api/state', { cookie: admin })).json();
  state.ingredients.push(...Array.from({ length: 65 }, (_, index) => ({
    id: 'fixture-' + index,
    code: 'F-' + index,
    name: 'Prueba ' + index,
    station: 'COCINA',
    unit: 'und',
    stock: 50,
    minStock: 10,
    cost: 1.5,
  })));
  const put = revision => call('/api/state', {
    method: 'PUT',
    cookie: admin,
    headers: { 'If-Match': revision },
    body: { state },
  });
  const firstWrite = await put('none');
  assert.equal(firstWrite.status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM ingredients').get().count, state.ingredients.length);

  sqlite.exec(`CREATE TABLE stock_update_probe (id TEXT NOT NULL);
    CREATE TRIGGER record_stock_update AFTER UPDATE ON ingredients
    BEGIN INSERT INTO stock_update_probe VALUES (NEW.id); END`);
  const ingredient = state.ingredients.at(-1);
  ingredient.stock = 43;
  ingredient.cost = 1.75;
  const { revision } = await firstWrite.json();
  assert.equal((await put(revision)).status, 200);
  const findIngredient = sqlite.prepare('SELECT stock, cost, min_stock FROM ingredients WHERE id = ?');
  assert.deepEqual({ ...findIngredient.get(ingredient.id) }, { stock: 43, cost: 1.75, min_stock: 10 });
  ingredient.stock = 39;
  assert.equal((await put(revision)).status, 409);
  assert.equal(findIngredient.get(ingredient.id).stock, 43);
  assert.deepEqual(sqlite.prepare('SELECT id FROM stock_update_probe').all().map(row => row.id), [ingredient.id]);
});

test('staff validators are scoped to their endpoint and role after authorization', async t => {
  const { call, signIn } = createFixture(t);
  const admin = await signIn(adminPassword, 'admin');
  const chefSetup = await call('/api/access/chef', {
    method: 'PUT',
    cookie: admin,
    body: { password: chefPassword },
  });
  assert.equal(chefSetup.status, 200);
  const chef = await signIn(chefPassword, 'chef');
  const withTag = tag => ({ 'If-None-Match': tag });

  let response = await call('/api/state', { cookie: admin });
  assert.equal(response.status, 200);
  const emptyTag = response.headers.get('ETag');
  response = await call('/api/state', { cookie: admin, headers: withTag(emptyTag) });
  assert.equal(response.status, 304);
  assert.equal(await response.text(), '');
  assert.equal((await call('/api/state', { headers: withTag('*') })).status, 401);
  assert.equal((await call('/api/state', { cookie: chef, headers: withTag('*') })).status, 403);

  assert.equal((await call('/api/orders', { method: 'POST', body: mesaDraft() })).status, 201);
  response = await call('/api/state', { cookie: admin, headers: withTag(emptyTag) });
  assert.equal(response.status, 200);
  const stateTag = response.headers.get('ETag');
  assert.notEqual(stateTag, emptyTag);
  const matchingList = '"unrelated", W/' + stateTag;
  response = await call('/api/state', { cookie: admin, headers: withTag(matchingList) });
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('ETag'), stateTag);

  response = await call('/api/kitchen', { cookie: admin, headers: withTag(stateTag) });
  assert.equal(response.status, 200);
  const adminKitchenTag = response.headers.get('ETag');
  response = await call('/api/kitchen', { cookie: chef, headers: withTag(adminKitchenTag) });
  assert.equal(response.status, 200);
  const chefKitchenTag = response.headers.get('ETag');
  assert.notEqual(chefKitchenTag, adminKitchenTag);
  assert.equal((await call('/api/kitchen', { cookie: chef, headers: withTag(chefKitchenTag) })).status, 304);
  assert.equal((await call('/api/kitchen', { headers: withTag(chefKitchenTag) })).status, 401);
});
