// Cloudflare Pages Function backed by Cloudflare D1 (binding: DB)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!env || !env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: 'D1 binding DB not configured. Bind D1 database "DB" in Cloudflare Pages Settings.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    // GET /api/health
    if (path === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'the-burgers-brother-d1', ts: new Date().toISOString() }), { headers: corsHeaders });
    }

    // GET /api/state -> returns synchronized state from Cloudflare D1
    if (path === '/api/state' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT payload, updated_at FROM app_state WHERE id = 1').first();
      if (!row) {
        return new Response(JSON.stringify({ ok: true, state: null }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: true, state: JSON.parse(row.payload), updatedAt: row.updated_at }), { headers: corsHeaders });
    }

    // PUT /api/state -> persists full state + mirrors orders/kardex/caja into relational D1 tables
    if (path === '/api/state' && request.method === 'PUT') {
      const body = await request.json();
      if (!body || !body.state) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing state payload' }), { status: 400, headers: corsHeaders });
      }
      const st = body.state;
      const serialized = JSON.stringify(st);

      const statements = [
        env.DB.prepare(
          `INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`
        ).bind(serialized)
      ];

      if (Array.isArray(st.orders)) {
        for (const o of st.orders.slice(0, 50)) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO orders (id, code, channel, table_name, customer, phone, address, payment_status, payment_method, payment_ref, status, boleta_num, total, items_json, note, created_at, approved_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 status = excluded.status,
                 payment_status = excluded.payment_status,
                 payment_method = excluded.payment_method,
                 boleta_num = excluded.boleta_num,
                 approved_at = excluded.approved_at,
                 completed_at = excluded.completed_at`
            ).bind(
              o.id, o.code, o.channel, o.table || '-', o.customer || '', o.phone || '', o.address || '',
              o.paymentStatus || 'PENDIENTE', o.paymentMethod || '', o.paymentRef || '',
              o.status, o.boletaNum || null, Number(o.total) || 0, JSON.stringify(o.items || []),
              o.note || '', o.createdAt || '', o.approvedAt || null, o.completedAt || null
            )
          );
        }
      }

      if (Array.isArray(st.ingredients)) {
        for (const i of st.ingredients) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO ingredients (id, code, name, station, unit, stock, min_stock, cost)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, cost = excluded.cost`
            ).bind(i.id, i.code, i.name, i.station, i.unit, Number(i.stock) || 0, Number(i.minStock) || 0, Number(i.cost) || 0)
          );
        }
      }

      await env.DB.batch(statements);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // GET /api/orders -> relational query for reporting/integrations
    if (path === '/api/orders' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all();
      return new Response(JSON.stringify({ ok: true, orders: results }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Route not found' }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), { status: 500, headers: corsHeaders });
  }
}
