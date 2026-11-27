import { STATIONS, orderStations, stationReady } from '../../public/preparation.js';
import { MENU, EXTRAS, WING_FLAVORS } from '../../public/catalog.js';
import { priceOrder } from '../../public/order-pricing.js';
import { limaClock } from '../business-calendar.js';
import {
  ORDER_COLUMNS,
  buildOrderDeductions,
  computeShiftStats,
  dbRowToOrder,
  dbRowToShift,
  ensureInitialized,
  ensureTodayOpenShift,
  getBusinessStatus,
  loadKitchenOrders,
  loadStateSnapshot,
  orderToDbValues,
  padNum,
  reconcileOpenShifts,
  revisionBumpStatement,
  roundMoney,
  stockQty,
  buildPeriodReport
} from '../pos-store.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sessionName = '__Host-pos_session';
const sessionSeconds = 8 * 60 * 60;
const encoder = new TextEncoder();
const menuById = new Map(MENU.map(product => [product.id, product]));

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function reject(error, status, extra = {}) {
  return json({ ok: false, error, ...extra }, status);
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

function validateOrderItems(rawItems, { allowEmpty = false } = {}) {
  if (!Array.isArray(rawItems) || (!allowEmpty && !rawItems.length) || rawItems.length > 40) {
    throw new RangeError('Revisa los productos del pedido.');
  }
  return rawItems.map(item => {
    const product = menuById.get(item?.menuId);
    if (!product || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
      throw new RangeError('Uno de los productos o sus cantidades no son válidos.');
    }
    const extraIds = Array.isArray(item.extras) ? item.extras.map(ex => typeof ex === 'string' ? ex : ex?.id) : [];
    const extras = EXTRAS.filter(extra => extraIds.includes(extra.id));
    const flavors = WING_FLAVORS.filter(flavor => Array.isArray(item.flavors) && item.flavors.includes(flavor));
    if (flavors.length !== (product.flavorsRequired || 0) ||
        extras.length !== extraIds.length || (extras.length && product.station !== 'COCINA')) {
      throw new RangeError('Revisa los extras y sabores del pedido.');
    }
    return {
      menuId: product.id,
      name: product.name,
      station: product.station,
      qty: item.qty,
      basePrice: product.price,
      unitPrice: product.price + extras.reduce((sum, extra) => sum + extra.price, 0),
      extras,
      flavors,
      note: clean(item.note, 240)
    };
  });
}

function formatDeliveryAddress(draft) {
  if (draft.location && draft.location.mode === 'gps') {
    const lat = Number(draft.location.lat);
    const lng = Number(draft.location.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new RangeError('Comparte una ubicación GPS válida o ingresa tu dirección manualmente.');
    }
    const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const mapUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
    const ref = clean(draft.location.reference ?? draft.reference ?? '', 120);
    const suffix = ` (${coords}) · ${mapUrl}`;
    const maxRef = Math.max(0, 240 - suffix.length - 6);
    return ref && maxRef > 0 ? `GPS: ${ref.slice(0, maxRef)}${suffix}` : `GPS${suffix}`;
  }
  return clean(draft.address, 240);
}

function orderDraft(draft, clock) {
  if (!draft || typeof draft.id !== 'string' || !uuid.test(draft.id) ||
      !['MESA', 'DELIVERY', 'RECOJO'].includes(draft.channel)) {
    throw new RangeError('Revisa los datos y los productos del pedido.');
  }
  const delivery = draft.channel === 'DELIVERY';
  const recojo = draft.channel === 'RECOJO';
  const takeaway = recojo || (draft.channel === 'MESA' && draft.takeaway === true);
  const tapers = draft.tapers ?? 0;
  if (!Number.isInteger(tapers) || tapers < 0 || tapers > 99 || (tapers && !delivery && !takeaway)) {
    throw new RangeError('Revisa la cantidad de táperes.');
  }
  if (draft.channel === 'MESA' && !/^Mesa [1-6]$/.test(draft.table)) {
    throw new RangeError('Selecciona una mesa válida.');
  }
  const table = draft.channel === 'MESA' ? draft.table : (recojo ? 'Para llevar' : '-');
  const customer = clean(draft.customer, 100);
  if (!customer) {
    throw new RangeError('Ingresa tu nombre para realizar el pedido.');
  }
  const phone = (delivery || recojo) ? clean(draft.phone, 40) : '';
  const address = delivery ? formatDeliveryAddress(draft) : '';
  const paymentRef = delivery ? clean(draft.payRef, 80) : '';
  if (delivery && !phone) {
    throw new RangeError('Ingresa tu teléfono o WhatsApp para el delivery.');
  }
  if (delivery && !address) {
    throw new RangeError('Ingresa tu ubicación o dirección de entrega.');
  }
  if (delivery && (!paymentRef || !['Yape', 'Plin', 'Tarjeta'].includes(draft.paymentMethod))) {
    throw new RangeError('Completa los datos de pago previo para delivery.');
  }

  const items = validateOrderItems(draft.items);
  const num = draft.id.replace(/-/g, '').slice(0, 12).toUpperCase();
  return {
    id: draft.id,
    num,
    code: `BB-${num}`,
    channel: draft.channel,
    table,
    customer,
    phone,
    address,
    paymentStatus: 'PENDIENTE',
    paymentMethod: delivery ? draft.paymentMethod : 'Por cobrar',
    paymentRef,
    status: 'POR_APROBAR',
    boletaNum: null,
    createdAt: clock.dateTimeLabel,
    approvedAt: null,
    completedAt: null,
    note: clean(draft.note, 350),
    takeaway,
    ...priceOrder(items, { tapers, channel: draft.channel, paymentMethod: draft.paymentMethod })
  };
}

function publicOrder(row) {
  return {
    id: row.id,
    code: row.code,
    channel: row.channel,
    table: row.table_name,
    customer: row.customer,
    total: row.total,
    status: row.status
  };
}

function revisionCasStatement(db, expected, next) {
  if (!expected) return revisionBumpStatement(db, next);
  return expected === 'none'
    ? db.prepare("INSERT INTO pos_state (id, payload, revision, updated_at) VALUES (1, '{}', ?, datetime('now')) ON CONFLICT(id) DO NOTHING").bind(next)
    : db.prepare("UPDATE pos_state SET revision = ?, updated_at = datetime('now') WHERE id = 1 AND revision = ?").bind(next, expected);
}

async function currentRevision(db) {
  const row = await db.prepare('SELECT revision, updated_at FROM pos_state WHERE id = 1').first();
  return { revision: row?.revision || null, updatedAt: row?.updated_at || null };
}

async function createOrder(db, draft, now = new Date()) {
  const clock = limaClock(now);
  const businessStatus = await getBusinessStatus(db, now);
  if (!businessStatus.open) {
    return reject(businessStatus.message, 403, { closed: true, businessStatus });
  }
  const order = orderDraft(draft, clock);
  const shift = await ensureTodayOpenShift(db, clock.businessDate, clock.iso);
  const nextRevision = crypto.randomUUID();

  await db.batch([
    db.prepare(
      `INSERT INTO pos_orders (${ORDER_COLUMNS})
       VALUES (${'?,'.repeat(26)}(SELECT COALESCE(MAX(sort_order), 0) + 1 FROM pos_orders))
       ON CONFLICT(id) DO NOTHING`
    ).bind(...orderToDbValues(order, {
      businessDate: clock.businessDate,
      shiftId: shift.id,
      createdIso: clock.iso,
      sortOrder: 0
    }).slice(0, 26)),
    revisionBumpStatement(db, nextRevision)
  ]);

  const row = await db.prepare('SELECT id, code, channel, table_name, customer, total, status FROM pos_orders WHERE id = ?').bind(order.id).first();
  return json({ ok: true, order: publicOrder(row) }, 201);
}

async function saveState(db, body, expected, now = new Date()) {
  const state = body?.state;
  if (!state || !Array.isArray(state.orders) || !Array.isArray(state.ingredients) ||
      !state.counters || !state.caja || !Array.isArray(state.boletas) || !Array.isArray(state.kardex)) {
    return reject('Estado inválido.', 400);
  }
  if (!expected) return reject('Falta la versión del estado.', 428);

  const clock = limaClock(now);
  const next = crypto.randomUUID();
  const payload = JSON.stringify(state);
  const casStmt = expected === 'none'
    ? db.prepare("INSERT INTO pos_state (id, payload, revision, updated_at) VALUES (1, '{}', ?, datetime('now')) ON CONFLICT(id) DO NOTHING").bind(next)
    : db.prepare("UPDATE pos_state SET revision = ?, updated_at = datetime('now') WHERE id = 1 AND revision = ?").bind(next, expected);

  const guardSql = '(SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)';
  const statements = [
    casStmt,
    db.prepare(`INSERT INTO pos_orders (${ORDER_COLUMNS})
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
        NULLIF(json_extract(value, '$.completedAt'), ''),
        COALESCE(NULLIF(json_extract(value, '$.businessDate'), ''), ?),
        json_extract(value, '$.shiftId'),
        CASE WHEN json_extract(value, '$.takeaway') THEN 1 ELSE 0 END,
        NULLIF(json_extract(value, '$.preparationStartedAt'), ''),
        json_extract(value, '$.stationCompletedAt'),
        COALESCE(CAST(json_extract(value, '$.fee') AS REAL), 0),
        COALESCE(NULLIF(json_extract(value, '$.num'), ''), substr(json_extract(value, '$.code'), 4)),
        ?,
        0
      FROM json_each(?, '$.orders')
      WHERE EXISTS ${guardSql}
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, payment_status = excluded.payment_status,
        payment_method = excluded.payment_method, boleta_num = excluded.boleta_num, total = excluded.total,
        items_json = excluded.items_json, note = excluded.note, approved_at = excluded.approved_at,
        completed_at = excluded.completed_at, takeaway = excluded.takeaway,
        preparation_started_at = excluded.preparation_started_at,
        station_completed_json = excluded.station_completed_json, fee = excluded.fee
      WHERE pos_orders.status IS NOT excluded.status OR pos_orders.payment_status IS NOT excluded.payment_status
        OR pos_orders.payment_method IS NOT excluded.payment_method OR pos_orders.boleta_num IS NOT excluded.boleta_num
        OR pos_orders.total IS NOT excluded.total OR pos_orders.items_json IS NOT excluded.items_json
        OR pos_orders.note IS NOT excluded.note OR pos_orders.approved_at IS NOT excluded.approved_at
        OR pos_orders.completed_at IS NOT excluded.completed_at
        OR pos_orders.station_completed_json IS NOT excluded.station_completed_json`).bind(clock.businessDate, clock.iso, payload, next),
    db.prepare(`INSERT INTO ingredients (id, code, name, station, unit, stock, min_stock, cost)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.code'), json_extract(value, '$.name'),
        json_extract(value, '$.station'), json_extract(value, '$.unit'),
        COALESCE(CAST(json_extract(value, '$.stock') AS REAL), 0),
        COALESCE(CAST(json_extract(value, '$.minStock') AS REAL), 0),
        COALESCE(CAST(json_extract(value, '$.cost') AS REAL), 0)
      FROM json_each(?, '$.ingredients')
      WHERE EXISTS ${guardSql}
      ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, cost = excluded.cost
      WHERE ingredients.stock IS NOT excluded.stock OR ingredients.cost IS NOT excluded.cost`).bind(payload, next)
  ];

  const [result] = await db.batch(statements);
  if (!result.meta.changes) return reject('El estado cambió. Actualiza el panel antes de reintentar.', 409);
  return json({ ok: true, revision: next });
}

async function readStaffETag(db, request, scope, extraKey = '') {
  const validator = request.headers.get('If-None-Match')?.trim() || '';
  const prefix = '"' + scope + '-';
  const known = (validator.match(/"[^"]*"/g) || []).filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length, -1));
  const { revision: rawRev, updatedAt } = await currentRevision(db);
  const revision = rawRev || 'empty';
  const tagValue = extraKey && rawRev ? `${revision}-${extraKey}` : revision;
  const headers = { ETag: `${prefix}${tagValue}"`, 'Cache-Control': 'private, no-store' };
  const notModified = validator === '*' || known.includes(tagValue);
  return { rawRev, updatedAt, headers, notModified };
}

async function getNextBoletaNum(db) {
  const row = await db.prepare("SELECT val FROM pos_counters WHERE name = 'boleta'").first();
  const nextVal = (Number(row?.val) || 0) + 1;
  return { nextVal, boletaNum: `BI-001-${padNum(nextVal, 5)}` };
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

    const now = new Date();
    const clock = limaClock(now);
    await ensureInitialized(db, now);
    await reconcileOpenShifts(db, now);

    if (path === '/api/status' && method === 'GET') {
      const businessStatus = await getBusinessStatus(db, now);
      return json({ ok: true, businessStatus });
    }

    if (path === '/api/orders' && method === 'POST') {
      return await createOrder(db, await input(request, 24000), now);
    }

    const trackedId = path.startsWith('/api/orders/') && !path.slice('/api/orders/'.length).includes('/')
      ? path.slice('/api/orders/'.length)
      : '';
    if (method === 'GET' && uuid.test(trackedId)) {
      const row = await db.prepare('SELECT status, total FROM pos_orders WHERE id = ?').bind(trackedId).first();
      return row ? json({ ok: true, status: row.status, total: roundMoney(row.total) }) : reject('Pedido no encontrado.', 404);
    }

    const role = await signedRole(request, env.STAFF_PASSWORD, db);
    if (!role) return reject('Inicia sesión para continuar.', 401);

    if (path === '/api/kitchen' && method === 'GET') {
      const { rawRev, headers, notModified } = await readStaffETag(db, request, 'kitchen-v1-' + role);
      if (notModified) return new Response(null, { status: 304, headers });
      const orders = await loadKitchenOrders(db, now);
      return json({ ok: true, role, revision: rawRev, orders }, 200, headers);
    }

    if (path === '/api/kitchen/complete' && method === 'POST') {
      const { id, station } = await input(request, 1024) || {};
      if (typeof id !== 'string' || !STATIONS.includes(station)) return reject('Selecciona una estación válida.', 400);
      for (let attempt = 0; attempt < 3; attempt++) {
        const [{ revision }, row] = await Promise.all([
          currentRevision(db),
          db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(id).first()
        ]);
        if (!row) return reject('Pedido no encontrado.', 404);
        const order = dbRowToOrder(row);
        if (!orderStations(order).includes(station)) return reject('El pedido no corresponde a esta estación.', 404);
        if (['EN_COCINA', 'LISTO_CHEF'].includes(order.status) && stationReady(order, station)) {
          return json({ ok: true, ready: order.status === 'LISTO_CHEF' });
        }
        if (order.status !== 'EN_COCINA') return reject('El pedido ya no está en preparación.', 409);

        const completedAt = now.toISOString();
        const nextStations = { ...(order.stationCompletedAt || {}), [station]: completedAt };
        const ready = orderStations(order).every(area => Boolean(nextStations[area]));
        const nextRev = crypto.randomUUID();
        const [casResult, orderResult] = await db.batch([
          revisionCasStatement(db, revision, nextRev),
          db.prepare(
            `UPDATE pos_orders
             SET station_completed_json = ?,
                 status = ?,
                 completed_at = ?
             WHERE id = ? AND status = 'EN_COCINA'
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(
            JSON.stringify(nextStations),
            ready ? 'LISTO_CHEF' : 'EN_COCINA',
            ready ? completedAt : order.completedAt,
            order.id,
            nextRev
          )
        ]);
        if (casResult.meta.changes && orderResult.meta.changes) {
          return json({ ok: true, ready, revision: nextRev });
        }
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
      const { rawRev, updatedAt, headers, notModified } = await readStaffETag(db, request, 'state-v1-' + role, clock.businessDate);
      if (notModified) return new Response(null, { status: 304, headers });
      const snapshot = await loadStateSnapshot(db, now);
      return json({
        ok: true,
        role,
        revision: rawRev,
        updatedAt,
        businessStatus: snapshot.businessStatus,
        activeShift: snapshot.activeShift,
        lastClosedShift: snapshot.lastClosedShift,
        state: snapshot.state
      }, 200, headers);
    }

    if (path === '/api/state' && method === 'PUT') {
      return await saveState(db, await input(request, 1_500_000), request.headers.get('If-Match'), now);
    }

    if (path === '/api/orders' && method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM pos_orders ORDER BY sort_order DESC, rowid DESC LIMIT 100').all();
      return json({ ok: true, orders: results });
    }

    // ---- SHIFT LIFECYCLE & BUSINESS DAY STATUS ----
    if (path === '/api/shifts/open' && method === 'POST') {
      const body = await input(request, 1024) || {};
      const openingAmount = roundMoney(body.openingAmount);
      if (!Number.isFinite(openingAmount) || openingAmount < 0 || openingAmount > 100000) {
        return reject('Ingresa un fondo inicial válido.', 400);
      }
      const businessStatus = await getBusinessStatus(db, now);
      if (!businessStatus.open) {
        return reject(businessStatus.message, 409, { closed: true });
      }
      const existing = await db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(clock.businessDate).first();
      if (existing && existing.status !== 'OPEN') {
        return reject('La jornada de hoy ya fue cerrada.', 409);
      }
      const shiftId = existing?.id || `shift_${clock.businessDate}`;
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare(
          `INSERT INTO cash_shifts (id, business_date, status, opening_amount, opened_at, notes)
           VALUES (?, ?, 'OPEN', ?, ?, '')
           ON CONFLICT(business_date) DO UPDATE SET
             opening_amount = excluded.opening_amount
           WHERE cash_shifts.status = 'OPEN'`
        ).bind(shiftId, clock.businessDate, openingAmount, clock.iso),
        revisionBumpStatement(db, nextRev)
      ]);
      const updated = await db.prepare('SELECT * FROM cash_shifts WHERE id = ?').bind(shiftId).first();
      const liveStats = await computeShiftStats(db, updated);
      return json({ ok: true, revision: nextRev, shift: { ...dbRowToShift(updated), ...liveStats } });
    }

    if (path === '/api/shifts/close' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const shift = await db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(clock.businessDate).first();
      if (!shift) return reject('Aún no se abrió ninguna jornada hoy.', 409);
      if (shift.status !== 'OPEN') return reject('La jornada de hoy ya está cerrada.', 409);

      const countedCash = body.countedCash === '' || body.countedCash == null ? null : roundMoney(body.countedCash);
      if (countedCash !== null && (!Number.isFinite(countedCash) || countedCash < 0 || countedCash > 1000000)) {
        return reject('Ingresa un arqueo en efectivo válido.', 400);
      }
      const notes = clean(body.notes || '', 250);
      const stats = await computeShiftStats(db, shift);
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare(
          `UPDATE cash_shifts
           SET status = 'CLOSED',
               closed_at = ?,
               close_reason = 'Cierre manual de jornada',
               cash_sales = ?,
               digital_sales = ?,
               expenses_total = ?,
               expected_cash = ?,
               counted_cash = ?,
               orders_count = ?,
               boletas_count = ?,
               notes = ?
           WHERE id = ? AND status = 'OPEN'`
        ).bind(
          clock.iso,
          stats.cashSales,
          stats.digitalSales,
          stats.expensesTotal,
          stats.expectedCash,
          countedCash,
          stats.ordersCount,
          stats.boletasCount,
          notes,
          shift.id
        ),
        revisionBumpStatement(db, nextRev)
      ]);
      const closed = await db.prepare('SELECT * FROM cash_shifts WHERE id = ?').bind(shift.id).first();
      return json({ ok: true, revision: nextRev, shift: dbRowToShift(closed) });
    }

    if (path === '/api/business/day-status' && method === 'POST') {
      const body = await input(request, 1024) || {};
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(body.businessDate || '') ? body.businessDate : clock.businessDate;
      const closed = body.closed === true ? 1 : 0;
      const reason = clean(body.reason || '', 160);
      if (closed) {
        const openShift = await db.prepare("SELECT id FROM cash_shifts WHERE business_date = ? AND status = 'OPEN'").bind(targetDate).first();
        if (openShift) {
          return reject('Cierra primero la jornada abierta de hoy antes de marcar el día como cerrado.', 409);
        }
      }
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare(
          `INSERT INTO pos_closed_days (business_date, closed, reason, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(business_date) DO UPDATE SET
             closed = excluded.closed, reason = excluded.reason, updated_at = excluded.updated_at`
        ).bind(targetDate, closed, reason, clock.iso),
        revisionBumpStatement(db, nextRev)
      ]);
      const businessStatus = await getBusinessStatus(db, now);
      return json({ ok: true, revision: nextRev, businessStatus });
    }

    // ---- INCREMENTAL ORDER LIFECYCLE ENDPOINTS ----
    const orderActionMatch = path.match(/^\/api\/orders\/([a-f0-9-]{36})\/(approve|pay|deliver|cancel|edit)$/);
    if (orderActionMatch && method === 'POST') {
      const [, orderId, action] = orderActionMatch;
      if (!uuid.test(orderId)) return reject('Pedido inválido.', 400);
      const body = await input(request, 24000).catch(() => ({}));
      const expected = request.headers.get('If-Match') || null;
      const row = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(orderId).first();
      if (!row) return reject('Pedido no encontrado.', 404);
      const order = dbRowToOrder(row);
      const { revision } = await currentRevision(db);
      if (expected && revision && expected !== revision) {
        return reject('El estado cambió en otro equipo. Actualiza antes de reintentar.', 409);
      }

      const businessStatus = await getBusinessStatus(db, now);
      const activeShift = await db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(clock.businessDate).first();
      const nextRev = crypto.randomUUID();
      const statements = [revisionCasStatement(db, expected || revision, nextRev)];

      if (action === 'approve') {
        if (order.status !== 'POR_APROBAR') return reject('El pedido ya no está pendiente de aprobación.', 409);
        const delivery = order.channel === 'DELIVERY';
        let paymentStatus = order.paymentStatus;
        let boletaNum = order.boletaNum;
        if (delivery && paymentStatus !== 'PAGADO') {
          if (body.verifiedPayment !== true) return reject('Confirma la verificación del pago de delivery.', 400);
          paymentStatus = 'PAGADO';
        }
        const approvedAt = clock.dateTimeLabel;
        const prepStarted = clock.iso;
        const shift = activeShift || (businessStatus.open ? await ensureTodayOpenShift(db, clock.businessDate, clock.iso) : null);

        if (delivery && paymentStatus === 'PAGADO') {
          if (activeShift && activeShift.status !== 'OPEN') {
            return reject('La caja de hoy ya fue cerrada.', 409);
          }
          const nextBol = await getNextBoletaNum(db);
          boletaNum = nextBol.boletaNum;
          statements.push(
            db.prepare("INSERT OR REPLACE INTO pos_counters (name, val) VALUES ('boleta', ?)").bind(nextBol.nextVal),
            db.prepare(
              `INSERT INTO pos_boletas (boleta_num, code, order_id, shift_id, business_date, customer, payment_method, total, date_label, created_iso)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(boletaNum, order.code, order.id, shift?.id || null, clock.businessDate, order.customer, order.paymentMethod, order.total, approvedAt, clock.iso),
            db.prepare(
              `INSERT INTO cash_movements (id, time, desc, method, amount, type, shift_id, business_date, order_id, boleta_num, created_iso)
               VALUES (?, ?, ?, ?, ?, 'VENTA', ?, ?, ?, ?, ?)`
            ).bind('cm_' + crypto.randomUUID().slice(0, 12), clock.timeLabel, `Delivery ${order.code} (${boletaNum})`, order.paymentMethod, order.total, shift?.id || null, clock.businessDate, order.id, boletaNum, clock.iso)
          );
        }

        const deductions = await buildOrderDeductions(db, order.items, {
          orderId: order.id,
          code: order.code,
          action: 'Aprobación',
          dateLabel: approvedAt,
          businessDate: clock.businessDate,
          createdIso: clock.iso
        });
        statements.push(
          db.prepare(
            `UPDATE pos_orders
             SET status = 'EN_COCINA',
                 payment_status = ?,
                 approved_at = ?,
                 preparation_started_at = ?,
                 boleta_num = COALESCE(?, boleta_num)
             WHERE id = ? AND status = 'POR_APROBAR'
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(paymentStatus, approvedAt, prepStarted, boletaNum, order.id, nextRev),
          ...deductions
        );

        const [casRes, ordRes] = await db.batch(statements);
        if (!casRes.meta.changes || !ordRes.meta.changes) {
          return reject('El pedido cambió en otro equipo. Actualiza el panel.', 409);
        }
        const savedRow = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(order.id).first();
        return json({ ok: true, revision: nextRev, order: dbRowToOrder(savedRow) });
      }

      if (action === 'pay') {
        if (order.status !== 'LISTO_CHEF' || order.paymentStatus === 'PAGADO') {
          return reject('Este pedido ya no está pendiente de cobro.', 409);
        }
        const methodName = body.paymentMethod;
        if (!['Efectivo', 'Yape', 'Plin', 'Tarjeta'].includes(methodName)) {
          return reject('Selecciona un método de pago válido.', 400);
        }
        if (activeShift && activeShift.status !== 'OPEN') {
          return reject('La caja de hoy ya fue cerrada.', 409);
        }
        const shift = activeShift || await ensureTodayOpenShift(db, clock.businessDate, clock.iso);
        const nextBol = await getNextBoletaNum(db);
        const boletaNum = nextBol.boletaNum;
        const paidLabel = clock.dateTimeLabel;

        statements.push(
          db.prepare("INSERT OR REPLACE INTO pos_counters (name, val) VALUES ('boleta', ?)").bind(nextBol.nextVal),
          db.prepare(
            `UPDATE pos_orders
             SET status = 'ENTREGADO',
                 payment_status = 'PAGADO',
                 payment_method = ?,
                 boleta_num = ?
             WHERE id = ? AND status = 'LISTO_CHEF' AND payment_status != 'PAGADO'
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(methodName, boletaNum, order.id, nextRev),
          db.prepare(
            `INSERT INTO pos_boletas (boleta_num, code, order_id, shift_id, business_date, customer, payment_method, total, date_label, created_iso)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(boletaNum, order.code, order.id, shift.id, clock.businessDate, order.customer, methodName, order.total, paidLabel, clock.iso),
          db.prepare(
            `INSERT INTO cash_movements (id, time, desc, method, amount, type, shift_id, business_date, order_id, boleta_num, created_iso)
             VALUES (?, ?, ?, ?, ?, 'VENTA', ?, ?, ?, ?, ?)`
          ).bind('cm_' + crypto.randomUUID().slice(0, 12), clock.timeLabel, `${order.table} ${order.code} (${boletaNum})`, methodName, order.total, shift.id, clock.businessDate, order.id, boletaNum, clock.iso)
        );
        const [casRes, ordRes] = await db.batch(statements);
        if (!casRes.meta.changes || !ordRes.meta.changes) return reject('El pedido cambió en otro equipo.', 409);
        const savedRow = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(order.id).first();
        return json({ ok: true, revision: nextRev, order: dbRowToOrder(savedRow), boletaNum });
      }

      if (action === 'deliver') {
        if (order.status !== 'LISTO_CHEF') return reject('El pedido aún no está listo para entrega.', 409);
        statements.push(
          db.prepare(
            `UPDATE pos_orders SET status = 'ENTREGADO'
             WHERE id = ? AND status = 'LISTO_CHEF'
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(order.id, nextRev)
        );
        const [casRes, ordRes] = await db.batch(statements);
        if (!casRes.meta.changes || !ordRes.meta.changes) return reject('El pedido cambió.', 409);
        const savedRow = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(order.id).first();
        return json({ ok: true, revision: nextRev, order: dbRowToOrder(savedRow) });
      }

      if (action === 'cancel') {
        if (!['POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF'].includes(order.status) || order.boletaNum || order.paymentStatus === 'PAGADO') {
          return reject('Este pedido ya no se puede cancelar.', 409);
        }
        statements.push(
          db.prepare(
            `UPDATE pos_orders SET status = 'CANCELADO'
             WHERE id = ? AND status IN ('POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF')
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(order.id, nextRev)
        );
        const [casRes, ordRes] = await db.batch(statements);
        if (!casRes.meta.changes || !ordRes.meta.changes) return reject('El pedido cambió.', 409);
        const savedRow = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(order.id).first();
        return json({ ok: true, revision: nextRev, order: dbRowToOrder(savedRow) });
      }

      if (action === 'edit') {
        if (!['POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF'].includes(order.status)) {
          return reject('Este pedido ya fue finalizado.', 409);
        }
        const paid = order.paymentStatus === 'PAGADO' || Boolean(order.boletaNum);
        const takeaway = order.channel === 'RECOJO' || (order.channel === 'MESA' && Boolean(body.takeaway));
        const showTapers = order.channel === 'DELIVERY' || takeaway;
        const tapers = showTapers ? Number(body.tapers) : 0;
        if (!Number.isInteger(tapers) || tapers < 0 || tapers > 99) {
          return reject('Cantidad de táperes inválida.', 400);
        }
        const note = clean(body.note ?? '', 350);
        const currentProductItems = order.items.filter(item => item.menuId !== 'taper' && item.menuId !== 'delivery-card-fee');
        const nextProducts = Array.isArray(body.items) ? validateOrderItems(body.items) : currentProductItems;
        const addedItems = Array.isArray(body.addedItems) && body.addedItems.length && !paid
          ? validateOrderItems(body.addedItems)
          : [];

        const combinedProducts = nextProducts;
        if (!combinedProducts.length) return reject('Conserva al menos un producto en el pedido.', 400);
        const currentTapers = order.items.find(i => i.menuId === 'taper')?.qty || 0;
        const pricesChanged = addedItems.length > 0 || tapers !== currentTapers ||
          JSON.stringify(currentProductItems.map(i => [i.menuId, i.qty])) !== JSON.stringify(combinedProducts.map(i => [i.menuId, i.qty]));
        if (paid && pricesChanged) return reject('No puedes modificar importes de un pedido ya pagado.', 409);

        const priced = pricesChanged
          ? priceOrder(combinedProducts, { tapers, channel: order.channel, paymentMethod: order.paymentMethod })
          : { items: order.items, total: order.total, fee: order.fee || 0 };

        let nextStatus = order.status;
        let nextCompletedAt = order.completedAt;
        let nextStations = order.stationCompletedAt ? { ...order.stationCompletedAt } : null;
        let deductions = [];

        if (addedItems.length && order.status !== 'POR_APROBAR') {
          deductions = await buildOrderDeductions(db, addedItems, {
            orderId: order.id,
            code: order.code,
            action: 'Adición',
            dateLabel: clock.dateTimeLabel,
            businessDate: clock.businessDate,
            createdIso: clock.iso
          });
          nextStatus = 'EN_COCINA';
          nextCompletedAt = null;
          nextStations ||= {};
          if (order.status === 'LISTO_CHEF') {
            for (const area of orderStations(order)) {
              nextStations[area] ||= order.completedAt || clock.iso;
            }
          }
          for (const area of orderStations({ items: addedItems })) delete nextStations[area];
        }

        statements.push(
          db.prepare(
            `UPDATE pos_orders
             SET items_json = ?,
                 total = ?,
                 fee = ?,
                 takeaway = ?,
                 note = ?,
                 status = ?,
                 completed_at = ?,
                 station_completed_json = ?
             WHERE id = ? AND status IN ('POR_APROBAR', 'EN_COCINA', 'LISTO_CHEF')
               AND EXISTS (SELECT 1 FROM pos_state WHERE id = 1 AND revision = ?)`
          ).bind(
            JSON.stringify(priced.items),
            priced.total,
            priced.fee || 0,
            takeaway ? 1 : 0,
            note,
            nextStatus,
            nextCompletedAt,
            nextStations ? JSON.stringify(nextStations) : null,
            order.id,
            nextRev
          ),
          ...deductions
        );
        const [casRes, ordRes] = await db.batch(statements);
        if (!casRes.meta.changes || !ordRes.meta.changes) return reject('La comanda cambió en otro equipo.', 409);
        const savedRow = await db.prepare('SELECT * FROM pos_orders WHERE id = ?').bind(order.id).first();
        return json({ ok: true, revision: nextRev, order: dbRowToOrder(savedRow) });
      }
    }

    // ---- INCREMENTAL CAJA, INVENTORY, SUPPLIERS, PURCHASES ----
    if (path === '/api/caja/expense' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const desc = clean(body.desc || '', 160);
      const amount = roundMoney(body.amount);
      if (!desc || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        return reject('Ingresa concepto y monto válido para el egreso.', 400);
      }
      const businessStatus = await getBusinessStatus(db, now);
      if (!businessStatus.open) return reject(businessStatus.message, 409);
      const existing = await db.prepare('SELECT * FROM cash_shifts WHERE business_date = ?').bind(clock.businessDate).first();
      if (existing && existing.status !== 'OPEN') return reject('La jornada de hoy ya está cerrada.', 409);
      const shift = existing || await ensureTodayOpenShift(db, clock.businessDate, clock.iso);
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare(
          `INSERT INTO cash_movements (id, time, desc, method, amount, type, shift_id, business_date, created_iso)
           VALUES (?, ?, ?, 'Efectivo', ?, 'EGRESO', ?, ?, ?)`
        ).bind('cm_' + crypto.randomUUID().slice(0, 12), clock.timeLabel, desc, -amount, shift.id, clock.businessDate, clock.iso),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev });
    }

    if (path === '/api/inventory/ingredients' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const name = clean(body.name || '', 100);
      const station = ['COCINA', 'BARRA'].includes(body.station) ? body.station : null;
      const unit = ['und', 'bot', 'g', 'ml', 'porc', 'oz', 'kg', 'lt'].includes(body.unit) ? body.unit : null;
      const minStock = stockQty(body.minStock);
      if (!name || !station || !unit || !Number.isFinite(minStock) || minStock < 0) {
        return reject('Revisa los datos del insumo.', 400);
      }
      const { results: existing } = await db.prepare('SELECT code, name FROM ingredients').all();
      if (existing.some(row => row.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
        return reject('Ya existe un insumo con ese nombre.', 409);
      }
      const usedCodes = new Set(existing.map(row => row.code));
      let number = existing.length + 1;
      while (usedCodes.has('IN-' + padNum(number, 2))) number++;
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare(
          `INSERT INTO ingredients (id, code, name, station, unit, stock, min_stock, cost)
           VALUES (?, ?, ?, ?, ?, 0, ?, 0)`
        ).bind('ing_' + crypto.randomUUID(), 'IN-' + padNum(number, 2), name, station, unit, minStock),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev }, 201);
    }

    if (path === '/api/inventory/adjust' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const type = ['ENTRADA', 'SALIDA', 'MERMA', 'CONTEO'].includes(body.type) ? body.type : null;
      const quantity = stockQty(body.quantity);
      const reason = clean(body.reason || '', 160);
      if (!body.ingredientId || !type || !reason || !Number.isFinite(quantity) || quantity < 0 || (type !== 'CONTEO' && quantity <= 0)) {
        return reject('Revisa los datos del ajuste de stock.', 400);
      }
      const ing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.ingredientId).first();
      if (!ing) return reject('Insumo no encontrado.', 404);
      const prev = stockQty(ing.stock);
      const next = type === 'CONTEO' ? quantity : stockQty(prev + (type === 'ENTRADA' ? quantity : -quantity));
      const delta = stockQty(next - prev);
      const counterRow = await db.prepare("SELECT val FROM pos_counters WHERE name = 'kardex'").first();
      const nextKardex = (Number(counterRow?.val) || 0) + 1;
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare('UPDATE ingredients SET stock = ? WHERE id = ?').bind(next, ing.id),
        db.prepare(
          `INSERT INTO kardex_movements
            (id, date, ing_name, type, doc, prev_stock, qty, next_stock, unit, ingredient_id, business_date, created_iso)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`k${nextKardex}`, clock.dateTimeLabel, ing.name, type, reason, prev, delta, next, ing.unit, ing.id, clock.businessDate, clock.iso),
        db.prepare("INSERT OR REPLACE INTO pos_counters (name, val) VALUES ('kardex', ?)").bind(nextKardex),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev, nextStock: next });
    }

    if (path === '/api/inventory/recipes' && method === 'PUT') {
      const body = await input(request, 1024) || {};
      const product = menuById.get(body.productId);
      const ing = await db.prepare('SELECT id FROM ingredients WHERE id = ?').bind(body.ingredientId || '').first();
      const quantity = stockQty(body.quantity);
      if (!product || !ing || !Number.isFinite(quantity) || quantity < 0) {
        return reject('Datos de receta inválidos.', 400);
      }
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT OR REPLACE INTO pos_recipes (product_id, ingredient_id, qty) VALUES (?, ?, ?)').bind(product.id, ing.id, quantity),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev });
    }

    if (path === '/api/suppliers' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const name = clean(body.name || '', 100);
      const ruc = clean(body.ruc || '', 20);
      const category = clean(body.category || '', 80);
      const contact = clean(body.contact || '', 100);
      if (!name) return reject('Ingresa el nombre o razón social del proveedor.', 400);
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO pos_suppliers (id, ruc, name, category, contact) VALUES (?, ?, ?, ?, ?)')
          .bind('sup_' + crypto.randomUUID().slice(0, 12), ruc || '-', name, category || 'Insumos', contact || '-'),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev }, 201);
    }

    if (path === '/api/purchases' && method === 'POST') {
      const body = await input(request, 2048) || {};
      const supplier = clean(body.supplier || '', 120) || 'Proveedor directo';
      const doc = clean(body.doc || '', 80);
      const qty = stockQty(body.quantity);
      const total = roundMoney(body.total);
      if (!body.ingredientId || !doc || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(total) || total < 0) {
        return reject('Revisa los datos de la compra.', 400);
      }
      const ing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.ingredientId).first();
      if (!ing) return reject('Insumo no encontrado.', 404);
      const prev = stockQty(ing.stock);
      const next = stockQty(prev + qty);
      const unitCost = qty > 0 && total > 0 ? roundMoney(total / qty) : roundMoney(ing.cost);
      const counterRow = await db.prepare("SELECT val FROM pos_counters WHERE name = 'kardex'").first();
      const nextKardex = (Number(counterRow?.val) || 0) + 1;
      const nextRev = crypto.randomUUID();
      await db.batch([
        db.prepare('UPDATE ingredients SET stock = ?, cost = ? WHERE id = ?').bind(next, unitCost, ing.id),
        db.prepare(
          `INSERT INTO kardex_movements
            (id, date, ing_name, type, doc, prev_stock, qty, next_stock, unit, ingredient_id, business_date, created_iso)
           VALUES (?, ?, ?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`k${nextKardex}`, clock.dateTimeLabel, ing.name, `Compra ${doc}`, prev, qty, next, ing.unit, ing.id, clock.businessDate, clock.iso),
        db.prepare(
          `INSERT INTO pos_purchases (id, business_date, date_label, doc, supplier, item, ingredient_id, qty, total, created_iso)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind('pur_' + crypto.randomUUID().slice(0, 12), clock.businessDate, clock.dateTimeLabel, doc, supplier, `${ing.name} (${qty} ${ing.unit})`, ing.id, qty, total, clock.iso),
        db.prepare("INSERT OR REPLACE INTO pos_counters (name, val) VALUES ('kardex', ?)").bind(nextKardex),
        revisionBumpStatement(db, nextRev)
      ]);
      return json({ ok: true, revision: nextRev }, 201);
    }

    if (path === '/api/reports' && method === 'GET') {
      const period = ['day', 'week', 'month', 'year'].includes(url.searchParams.get('period'))
        ? url.searchParams.get('period')
        : 'day';
      const anchorDate = url.searchParams.get('date') || clock.businessDate;
      const report = await buildPeriodReport(db, { period, anchorDate, now });
      return json({ ok: true, ...report });
    }

    return reject('Ruta no encontrada.', 404);
  } catch (error) {
    if (error instanceof RangeError) return reject(error.message, 400);
    console.error('POS API request failed', method, error.name);
    return reject('No se pudo completar la solicitud.', 500);
  }
}
