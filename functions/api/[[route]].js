import { STATIONS, orderStations, stationReady } from '../../public/preparation.js';
import { MENU, EXTRAS, WING_FLAVORS } from '../../public/catalog.js';
import { priceOrder } from '../../public/order-pricing.js';
import { initialState, withInventoryCatalog } from '../initial-state.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sessionName = '__Host-pos_session';
const sessionSeconds = 8 * 60 * 60;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function reject(error, status) {
  return json({ ok: false, error }, status);
}

async function signature(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function equal(a, b) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  return left.byteLength === right.byteLength && crypto.subtle.timingSafeEqual(left, right);
}

async function chefCredential(db) {
  return db.prepare('SELECT salt, digest FROM pos_chef_access WHERE id = 1').first();
}

async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const digest = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function signedRole(request, secret, db) {
  if (!secret) return null;
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find(value => value.startsWith(sessionName + '='));
  const [role, expires, token] = (cookie?.split('=')[1] || '').split('.');
  if (!['admin', 'chef'].includes(role) || !/^\d{10}$/.test(expires) || Number(expires) <= Date.now() / 1000 || !token) return null;
  const credential = role === 'chef' ? await chefCredential(db) : null;
  if (role === 'chef' && !credential) return null;
  const signed = await signature(secret, [role, expires, credential?.digest || ''].join('.'));
  return equal(token, signed) ? role : null;
}

function sessionCookie(value, maxAge) {
  return { 'Set-Cookie': `${sessionName}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict` };
}

async function input(request, limit) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    throw new RangeError('Envía los datos en JSON.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError('Faltan los datos.');
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new RangeError('La solicitud supera el tamaño permitido.');
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(raw + decoder.decode());
  } catch {
    throw new RangeError('Los datos enviados no son válidos.');
  }
}

function clean(value, limit) {
  // Existing staff screens interpolate these strings into HTML and print tickets.
  return typeof value === 'string' ? value.trim().slice(0, limit)
    .replace(/[<>&"'\x60]/g, char => ({ '<': '‹', '>': '›', '&': '＆', '"': '”', "'": '’', '\x60': '’' })[char]) : '';
}

function orderDraft(draft) {
  if (!draft || typeof draft.id !== 'string' || !uuid.test(draft.id) ||
      !['MESA', 'DELIVERY'].includes(draft.channel) ||
      !Array.isArray(draft.items) || !draft.items.length || draft.items.length > 40) {
    throw new RangeError('Revisa los datos y los productos del pedido.');
  }
  const delivery = draft.channel === 'DELIVERY';
  const takeaway = !delivery && draft.takeaway === true;
  const tapers = draft.tapers ?? 0;
  if (!Number.isInteger(tapers) || tapers < 0 || tapers > 99 || (tapers && !delivery && !takeaway)) {
    throw new RangeError('Revisa la cantidad de táperes.');
  }
  if (!delivery && !/^Mesa [1-6]$/.test(draft.table)) throw new RangeError('Selecciona una mesa válida.');
  const table = delivery ? '-' : draft.table;
  const customer = clean(draft.customer, 100) || (!delivery ? `Cliente ${table}` : '');
  const phone = delivery ? clean(draft.phone, 40) : '';
  const address = delivery ? clean(draft.address, 240) : '';
  const paymentRef = delivery ? clean(draft.payRef, 80) : '';
  if (delivery && (!customer || !phone || !address || !paymentRef ||
      !['Yape', 'Plin', 'Tarjeta'].includes(draft.paymentMethod))) {
    throw new RangeError('Completa los datos de entrega y la referencia del pago.');
  }

  const items = draft.items.map(item => {
    const product = MENU.find(entry => entry.id === item?.menuId);
    if (!product || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
      throw new RangeError('Uno de los productos o sus cantidades no son válidos.');
    }
    const extras = EXTRAS.filter(extra => Array.isArray(item.extras) && item.extras.includes(extra.id));
    const flavors = WING_FLAVORS.filter(flavor => Array.isArray(item.flavors) && item.flavors.includes(flavor));
    if (flavors.length !== (product.flavorsRequired || 0) ||
        extras.length !== (item.extras?.length || 0) || (extras.length && product.station !== 'COCINA')) {
      throw new RangeError('Revisa los extras y sabores del pedido.');
    }
    return {
      menuId: product.id, name: product.name, station: product.station, qty: item.qty,
      basePrice: product.price, unitPrice: product.price + extras.reduce((sum, extra) => sum + extra.price, 0),
      extras, flavors, note: clean(item.note, 240)
    };
  });

  const num = draft.id.replace(/-/g, '').slice(0, 12).toUpperCase();
  return {
    id: draft.id, num, code: `BB-${num}`, channel: draft.channel, table, customer, phone, address,
    paymentStatus: 'PENDIENTE', paymentMethod: delivery ? draft.paymentMethod : 'Por cobrar', paymentRef,
    status: 'POR_APROBAR', boletaNum: null,
    createdAt: new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short'
    }).format(new Date()),
    approvedAt: null, completedAt: null,
    note: clean(draft.note, 350),
    takeaway,
    ...priceOrder(items, { tapers, channel: draft.channel, paymentMethod: draft.paymentMethod })
  };
}

const orderColumns = 'id, code, channel, table_name, customer, phone, address, payment_status, payment_method, payment_ref, status, boleta_num, total, items_json, note, created_at, approved_at, completed_at';

function orderValues(order) {
  return [
    order.id, order.code, order.channel, order.table || '-', order.customer || '', order.phone || '', order.address || '',
    order.paymentStatus || 'PENDIENTE', order.paymentMethod || '', order.paymentRef || '', order.status, order.boletaNum || null,
    Number(order.total) || 0, JSON.stringify(order.items || []), order.note || '', order.createdAt || '',
    order.approvedAt || null, order.completedAt || null
  ];
}

function publicOrder(row) {
  return {
    id: row.id, code: row.code, channel: row.channel, table: row.table_name,
    customer: row.customer, total: row.total, status: row.status
  };
}

async function createOrder(db, draft) {
  const order = orderDraft(draft);
  await db.batch([
    db.prepare(`INSERT INTO pos_orders (${orderColumns}) VALUES (${'?,'.repeat(17)}?) ON CONFLICT(id) DO NOTHING`)
      .bind(...orderValues(order)),
    db.prepare(`INSERT INTO pos_state (id, payload, revision)
      VALUES (1, json_insert(?, '$.orders[#]', json(?)), ?)
      ON CONFLICT(id) DO UPDATE SET
        payload = json_set(pos_state.payload, '$.orders', json('[' || json(?) ||
          CASE WHEN json_array_length(pos_state.payload, '$.orders') > 0
            THEN ',' || substr(json_extract(pos_state.payload, '$.orders'), 2)
            ELSE ']' END)),
        updated_at = datetime('now'), revision = excluded.revision
      WHERE NOT EXISTS (SELECT 1 FROM json_each(pos_state.payload, '$.orders') WHERE json_extract(value, '$.id') = ?)`)
      .bind(JSON.stringify(initialState()), JSON.stringify(order), crypto.randomUUID(), JSON.stringify(order), order.id)
  ]);
  const row = await db.prepare('SELECT id, code, channel, table_name, customer, total, status FROM pos_orders WHERE id = ?').bind(order.id).first();
  return json({ ok: true, order: publicOrder(row) }, 201);
}

async function saveState(db, body, expected) {
  const state = body?.state;
  if (!state || !Array.isArray(state.orders) || !Array.isArray(state.ingredients) ||
      !state.counters || !state.caja || !Array.isArray(state.boletas) || !Array.isArray(state.kardex)) {
    return reject('Estado inválido.', 400);
  }
  if (!expected) return reject('Falta la versión del estado.', 428);
  const next = crypto.randomUUID();
  const payload = JSON.stringify(state);
  const statements = [expected === 'none'
    ? db.prepare('INSERT INTO pos_state (id, payload, revision) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(payload, next)
    : db.prepare("UPDATE pos_state SET payload = ?, revision = ?, updated_at = datetime('now') WHERE id = 1 AND revision = ?")
      .bind(payload, next, expected)
  ];
  // Project the accepted revision, including edits to orders outside the most recent page.
  statements.push(db.prepare(`INSERT INTO pos_orders (${orderColumns})
    SELECT json_extract(value, '$.id'), json_extract(value, '$.code'), json_extract(value, '$.channel'),
      COALESCE(NULLIF(json_extract(value, '$.table'), ''), '-'),
      COALESCE(json_extract(value, '$.customer'), ''),
      COALESCE(json_extract(value, '$.phone'), ''), COALESCE(json_extract(value, '$.address'), ''),
      COALESCE(NULLIF(json_extract(value, '$.paymentStatus'), ''), 'PENDIENTE'),
      COALESCE(json_extract(value, '$.paymentMethod'), ''), COALESCE(json_extract(value, '$.paymentRef'), ''),
      json_extract(value, '$.status'), NULLIF(json_extract(value, '$.boletaNum'), ''),
      COALESCE(CAST(json_extract(value, '$.total') AS REAL), 0),
      COALESCE(json_extract(value, '$.items'), '[]'), COALESCE(json_extract(value, '$.note'), ''),
      COALESCE(json_extract(value, '$.createdAt'), ''), NULLIF(json_extract(value, '$.approvedAt'), ''),
      NULLIF(json_extract(value, '$.completedAt'), '')
    FROM pos_state, json_each(pos_state.payload, '$.orders')
    WHERE pos_state.id = 1 AND pos_state.revision = ?
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, payment_status = excluded.payment_status,
      payment_method = excluded.payment_method, boleta_num = excluded.boleta_num, total = excluded.total,
      items_json = excluded.items_json, note = excluded.note, approved_at = excluded.approved_at,
      completed_at = excluded.completed_at
    WHERE pos_orders.status IS NOT excluded.status OR pos_orders.payment_status IS NOT excluded.payment_status
      OR pos_orders.payment_method IS NOT excluded.payment_method OR pos_orders.boleta_num IS NOT excluded.boleta_num
      OR pos_orders.total IS NOT excluded.total OR pos_orders.items_json IS NOT excluded.items_json
      OR pos_orders.note IS NOT excluded.note OR pos_orders.approved_at IS NOT excluded.approved_at
      OR pos_orders.completed_at IS NOT excluded.completed_at`).bind(next));
  statements.push(db.prepare(`INSERT INTO ingredients (id, code, name, station, unit, stock, min_stock, cost)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.code'), json_extract(value, '$.name'),
      json_extract(value, '$.station'), json_extract(value, '$.unit'),
      COALESCE(CAST(json_extract(value, '$.stock') AS REAL), 0),
      COALESCE(CAST(json_extract(value, '$.minStock') AS REAL), 0),
      COALESCE(CAST(json_extract(value, '$.cost') AS REAL), 0)
    FROM pos_state, json_each(pos_state.payload, '$.ingredients')
    WHERE pos_state.id = 1 AND pos_state.revision = ?
    ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, cost = excluded.cost
    WHERE ingredients.stock IS NOT excluded.stock OR ingredients.cost IS NOT excluded.cost`).bind(next));
  const [result] = await db.batch(statements);
  if (!result.meta.changes) return reject('El estado cambió. Actualiza el panel antes de reintentar.', 409);
  return json({ ok: true, revision: next });
}

async function readStaffState(db, request, scope) {
  const validator = request.headers.get('If-None-Match')?.trim() || '';
  const prefix = '"' + scope + '-';
  const known = (validator.match(/"[^"]*"/g) || []).filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length, -1));
  const row = await db.prepare(`SELECT revision, updated_at,
    CASE WHEN ? OR revision IN (SELECT value FROM json_each(?)) THEN NULL ELSE payload END AS payload
    FROM pos_state WHERE id = 1`).bind(Number(validator === '*'), JSON.stringify(known)).first();
  const revision = row?.revision || 'empty';
  const headers = { ETag: prefix + revision + '"', 'Cache-Control': 'private, no-store' };
  const notModified = validator === '*' || known.includes(revision);
  return { row, headers, notModified };
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const { pathname: path } = url;
  const { method } = request;
  if (!['GET', 'HEAD'].includes(method) && request.headers.get('Origin') !== url.origin) {
    return reject('Origen no autorizado.', 403);
  }
  try {
    const db = env.DB;
    if (!db) return reject('La base de datos no está disponible.', 503);

    if (path === '/api/health' && method === 'GET') {
      await db.prepare('SELECT revision FROM pos_state LIMIT 1').first();
      return json({ ok: true, service: 'the-burgers-brother-d1' });
    }
    if (path === '/api/session' && method === 'POST') {
      if (!env.STAFF_PASSWORD) return reject('El acceso del personal aún no está configurado.', 503);
      const { password, role = 'admin' } = await input(request, 1024) || {};
      if (typeof password !== 'string' || !['admin', 'chef'].includes(role)) return reject('Acceso inválido.', 400);
      const credential = role === 'chef' ? await chefCredential(db) : null;
      if (role === 'chef' && !credential) return reject('Nicol aún debe configurar la clave de cocina.', 403);
      const valid = credential ? equal(await passwordDigest(password, credential.salt), credential.digest) : equal(password, env.STAFF_PASSWORD);
      if (!valid) return reject('Clave incorrecta.', 401);
      const expires = String(Math.floor(Date.now() / 1000) + sessionSeconds);
      const token = await signature(env.STAFF_PASSWORD, [role, expires, credential?.digest || ''].join('.'));
      return json({ ok: true, role }, 200, sessionCookie(`${role}.${expires}.${token}`, sessionSeconds));
    }
    if (path === '/api/session' && method === 'DELETE') return json({ ok: true }, 200, sessionCookie('', 0));
    if (path === '/api/orders' && method === 'POST') return await createOrder(db, await input(request, 24000));

    const id = path.startsWith('/api/orders/') ? path.slice('/api/orders/'.length) : '';
    if (method === 'GET' && uuid.test(id)) {
      const row = await db.prepare(`SELECT json_extract(value, '$.status') AS status
        FROM pos_state, json_each(pos_state.payload, '$.orders')
        WHERE pos_state.id = 1 AND json_extract(value, '$.id') = ?`).bind(id).first();
      return row ? json({ ok: true, status: row.status }) : reject('Pedido no encontrado.', 404);
    }

    const role = await signedRole(request, env.STAFF_PASSWORD, db);
    if (!role) return reject('Inicia sesión para continuar.', 401);
    if (path === '/api/kitchen' && method === 'GET') {
      const { row, headers, notModified } = await readStaffState(db, request, 'kitchen-v1-' + role);
      if (notModified) return new Response(null, { status: 304, headers });
      const orders = row ? JSON.parse(row.payload).orders : [];
      return json({ ok: true, role, orders: orders.filter(order => ['POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF', 'ENTREGADO'].includes(order.status))
        .map(({ id, code, num, table, channel, status, takeaway, items, note, approvedAt, preparationStartedAt, stationCompletedAt, completedAt }) => ({
          id, code, num, table, channel, status, takeaway, approvedAt, preparationStartedAt, stationCompletedAt, completedAt,
          note: status === 'POR_APROBAR' ? '' : note,
          items: status === 'POR_APROBAR' ? [] : items.filter(item => item.menuId !== 'delivery-card-fee').map(({ name, qty, station, menuId, flavors, extras, note }) => ({
            name, qty, station, menuId, flavors: flavors || [], extras: (extras || []).map(({ name }) => ({ name })), note
          }))
        })) }, 200, headers);
    }
    if (path === '/api/kitchen/complete' && method === 'POST') {
      const { id, station } = await input(request, 1024) || {};
      if (typeof id !== 'string' || !STATIONS.includes(station)) return reject('Selecciona una estación válida.', 400);
      for (let attempt = 0; attempt < 3; attempt++) {
        const row = await db.prepare('SELECT payload, revision FROM pos_state WHERE id = 1').first();
        if (!row) return reject('Pedido no encontrado.', 404);
        const state = JSON.parse(row.payload);
        const order = state.orders.find(entry => entry.id === id);
        if (!order || !orderStations(order).includes(station)) return reject('El pedido no corresponde a esta estación.', 404);
        if (['EN_COCINA', 'LISTO_CHEF'].includes(order.status) && stationReady(order, station)) {
          return json({ ok: true, ready: order.status === 'LISTO_CHEF' });
        }
        if (order.status !== 'EN_COCINA') return reject('El pedido ya no está en preparación.', 409);
        const completedAt = new Date().toISOString();
        order.stationCompletedAt = { ...order.stationCompletedAt, [station]: completedAt };
        const ready = orderStations(order).every(area => stationReady(order, area));
        const next = crypto.randomUUID();
        const statements = [];
        if (ready) {
          order.status = 'LISTO_CHEF';
          order.completedAt = completedAt;
        }
        statements.push(db.prepare("UPDATE pos_state SET payload = ?, revision = ?, updated_at = datetime('now') WHERE id = 1 AND revision = ?")
          .bind(JSON.stringify(state), next, row.revision));
        if (ready) {
          statements.push(db.prepare("UPDATE pos_orders SET status = 'LISTO_CHEF', completed_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)")
            .bind(order.completedAt, order.id, next));
        }
        const [result] = await db.batch(statements);
        if (result.meta.changes) return json({ ok: true, ready });
      }
      return reject('El pedido cambió. Vuelve a intentarlo.', 409);
    }
    if (role !== 'admin') return reject('Solo Admin puede acceder a esta sección.', 403);
    if (path === '/api/access/chef' && method === 'PUT') {
      const { password } = await input(request, 1024) || {};
      if (typeof password !== 'string' || password.length < 8 || password.length > 100 ||
          equal(password, env.STAFF_PASSWORD)) return reject('Usa una clave distinta a la de Admin, de 8 a 100 caracteres.', 400);
      const salt = crypto.randomUUID();
      const digest = await passwordDigest(password, salt);
      await db.prepare('INSERT INTO pos_chef_access (id, salt, digest) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET salt = excluded.salt, digest = excluded.digest')
        .bind(salt, digest).run();
      return json({ ok: true });
    }
    if (path === '/api/state' && method === 'GET') {
      const { row, headers, notModified } = await readStaffState(db, request, 'state-v1-' + role);
      if (notModified) return new Response(null, { status: 304, headers });
      return json({ ok: true, role, state: row ? withInventoryCatalog(JSON.parse(row.payload)) : initialState(),
        revision: row?.revision || null, updatedAt: row?.updated_at || null }, 200, headers);
    }
    if (path === '/api/state' && method === 'PUT') {
      return await saveState(db, await input(request, 1_500_000), request.headers.get('If-Match'));
    }
    if (path === '/api/orders' && method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM pos_orders ORDER BY rowid DESC LIMIT 100').all();
      return json({ ok: true, orders: results });
    }

    return reject('Ruta no encontrada.', 404);
  } catch (error) {
    if (error instanceof RangeError) return reject(error.message, 400);
    console.error('POS API request failed', method, error.name);
    return reject('No se pudo completar la solicitud.', 500);
  }
}
