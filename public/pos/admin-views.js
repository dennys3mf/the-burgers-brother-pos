/**
 * Pure Back-Office & Administration view builders for The Burgers Brother POS V2.0.
 * Covers Proveedores/Compras, Caja/Boletas/Reportes, Códigos QR, Configuración, and Roles.
 */

import { escapeHtml, money } from './views.js?v=20261127g';

export function renderSuppliersDirectoryHtml(suppliers) {
  if (!suppliers?.length) {
    const empty = `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="truck"></i></span>
        <h3>Sin proveedores registrados</h3>
        <p>Registra tus proveedores habituales para asociar compras e ingresar mercadería al Kardex.</p>
        <button type="button" data-trigger-supplier class="pos-btn pos-btn-primary">
          <i data-lucide="user-plus" aria-hidden="true"></i><span>Nuevo proveedor</span>
        </button>
      </div>`;
    return { tableHtml: empty, mobileHtml: empty };
  }

  const tableHtml = `
    <div class="pos-table-wrap">
      <table class="pos-table">
        <thead>
          <tr>
            <th>Razón social / RUC</th>
            <th>Rubro</th>
            <th>Contacto</th>
          </tr>
        </thead>
        <tbody>
          ${suppliers.map(s => `
            <tr>
              <td>
                <strong class="pos-cell-title">${escapeHtml(s.name)}</strong>
                <div class="pos-cell-code font-mono-ticket">RUC: ${escapeHtml(s.ruc || '—')}</div>
              </td>
              <td><span class="pos-badge" data-tone="neutral">${escapeHtml(s.category || 'General')}</span></td>
              <td class="pos-cell-meta">${escapeHtml(s.contact || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  const mobileHtml = `
    <div class="pos-mobile-cards">
      ${suppliers.map(s => `
        <article class="pos-mobile-card">
          <div class="pos-mobile-card-top">
            <div>
              <strong class="pos-cell-title">${escapeHtml(s.name)}</strong>
              <div class="pos-cell-code font-mono-ticket">RUC: ${escapeHtml(s.ruc || '—')}</div>
            </div>
            <span class="pos-badge pos-badge-sm" data-tone="neutral">${escapeHtml(s.category || 'General')}</span>
          </div>
          <div class="pos-mobile-card-main">
            <span>Contacto</span>
            <strong>${escapeHtml(s.contact || '—')}</strong>
          </div>
        </article>
      `).join('')}
    </div>`;

  return { tableHtml, mobileHtml };
}

export function renderPurchasesViewHtml(purchases) {
  if (!purchases?.length) {
    const empty = `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="shopping-cart"></i></span>
        <h3>Sin compras registradas aún</h3>
        <p>Al registrar una compra se actualiza el stock del insumo y queda trazabilidad en el Kardex.</p>
        <button type="button" data-trigger-purchase class="pos-btn pos-btn-primary">
          <i data-lucide="plus" aria-hidden="true"></i><span>Registrar compra</span>
        </button>
      </div>`;
    return { tableHtml: empty, mobileHtml: empty };
  }

  const tableHtml = `
    <div class="pos-table-wrap">
      <table class="pos-table">
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Proveedor</th>
            <th>Documento / Factura</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${purchases.map(p => `
            <tr>
              <td><strong class="pos-cell-title">${escapeHtml(p.item)}</strong></td>
              <td class="pos-cell-meta">${escapeHtml(p.supplier)}</td>
              <td class="font-mono-ticket pos-muted-cell">${escapeHtml(p.doc)}</td>
              <td class="text-right pos-num-cell"><strong>${money(p.total)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  const mobileHtml = `
    <div class="pos-mobile-cards">
      ${purchases.map(p => `
        <article class="pos-mobile-card">
          <div class="pos-mobile-card-top">
            <div>
              <strong class="pos-cell-title">${escapeHtml(p.item)}</strong>
              <div class="pos-cell-meta">${escapeHtml(p.supplier)}</div>
            </div>
            <strong class="pos-num-cell">${money(p.total)}</strong>
          </div>
          <div class="pos-mobile-card-meta">
            <span class="font-mono-ticket">${escapeHtml(p.doc)}</span>
          </div>
        </article>
      `).join('')}
    </div>`;

  return { tableHtml, mobileHtml };
}

export function renderCajaMovementsHtml(movements) {
  if (!movements?.length) {
    const empty = `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="wallet"></i></span>
        <h3>Sin movimientos en esta jornada</h3>
        <p>Las ventas cobradas y egresos registrados durante el turno aparecerán aquí.</p>
      </div>`;
    return { tableHtml: `<tr><td colspan="4">${empty}</td></tr>`, mobileHtml: empty };
  }

  const tableHtml = movements.map(m => `
    <tr>
      <td class="pos-muted-cell whitespace-nowrap">${escapeHtml(m.time)}</td>
      <td><strong class="pos-cell-title">${escapeHtml(m.desc)}</strong></td>
      <td><span class="pos-badge pos-badge-sm" data-tone="neutral">${escapeHtml(m.method)}</span></td>
      <td class="text-right pos-num-cell" data-tone="${m.amount >= 0 ? 'success' : 'error'}"><strong>${m.amount >= 0 ? '+' : ''}${money(m.amount)}</strong></td>
    </tr>
  `).join('');

  const mobileHtml = movements.map(m => `
    <article class="pos-mobile-card">
      <div class="pos-mobile-card-top">
        <div>
          <strong class="pos-cell-title">${escapeHtml(m.desc)}</strong>
          <div class="pos-mobile-card-meta">
            <span>${escapeHtml(m.time)}</span>
            <span class="pos-badge pos-badge-sm" data-tone="neutral">${escapeHtml(m.method)}</span>
          </div>
        </div>
        <strong class="pos-num-cell" data-tone="${m.amount >= 0 ? 'success' : 'error'}">${m.amount >= 0 ? '+' : ''}${money(m.amount)}</strong>
      </div>
    </article>
  `).join('');

  return { tableHtml, mobileHtml };
}

export function renderBoletasListHtml(boletas, emptyMessage = 'Aún no se emitieron boletas internas en este turno.') {
  if (!boletas?.length) {
    return `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="receipt"></i></span>
        <h3>Sin boletas internas</h3>
        <p>${escapeHtml(emptyMessage)}</p>
      </div>`;
  }

  return boletas.map(b => `
    <div class="pos-boleta-row">
      <div class="pos-boleta-info">
        <div class="pos-boleta-num font-mono-ticket">${escapeHtml(b.boletaNum)} <span>(${escapeHtml(b.code)})</span></div>
        <div class="pos-boleta-meta">${escapeHtml(b.customer)} · ${escapeHtml(b.paymentMethod)} · ${escapeHtml(b.businessDate || b.date)}</div>
      </div>
      <div class="pos-boleta-actions">
        <strong class="pos-num-cell">${money(b.total)}</strong>
        <button type="button" data-admin-reprint-boleta="${escapeHtml(b.orderId)}" class="pos-btn pos-btn-secondary pos-btn-sm">
          <i data-lucide="printer" aria-hidden="true"></i><span>Imprimir</span>
        </button>
      </div>
    </div>
  `).join('');
}

export function renderReportsMobileHtml({ range, shifts = [], months = [] }) {
  if (range?.period === 'year') {
    if (!months.length) return '<div class="pos-empty-state"><h3>Sin jornadas registradas este año</h3></div>';
    return months.map(m => `
      <article class="pos-mobile-card">
        <div class="pos-mobile-card-top">
          <strong class="font-mono-ticket pos-cell-title">${escapeHtml(m.month)}</strong>
          <strong class="pos-num-cell">${money(m.totalSales)}</strong>
        </div>
        <dl class="pos-mobile-dl">
          <div><dt>Jornadas</dt><dd>${m.openDays}</dd></div>
          <div><dt>Efectivo</dt><dd data-tone="success">${money(m.cashSales)}</dd></div>
          <div><dt>Digital</dt><dd>${money(m.digitalSales)}</dd></div>
          <div><dt>Egresos</dt><dd data-tone="error">${money(m.expensesTotal)}</dd></div>
        </dl>
      </article>
    `).join('');
  }

  if (!shifts.length) return '<div class="pos-empty-state"><h3>Sin jornadas en este periodo</h3></div>';
  return shifts.map(s => {
    const stText = s.status === 'OPEN' ? 'Abierta' : s.status === 'AUTO_CLOSED' ? 'Auto 00:00' : 'Cerrada';
    const stTone = s.status === 'OPEN' ? 'success' : s.status === 'AUTO_CLOSED' ? 'warning' : 'neutral';
    const total = (s.cashSales || 0) + (s.digitalSales || 0);
    return `
      <article class="pos-mobile-card">
        <div class="pos-mobile-card-top">
          <div>
            <strong class="font-mono-ticket pos-cell-title">${escapeHtml(s.businessDate)}</strong>
          </div>
          <span class="pos-badge pos-badge-sm" data-tone="${stTone}">${stText}</span>
        </div>
        <div class="pos-mobile-card-main">
          <span>Total ventas</span>
          <strong class="pos-num-cell">${money(total)}</strong>
        </div>
        <dl class="pos-mobile-dl">
          <div><dt>Efectivo</dt><dd data-tone="success">${money(s.cashSales)}</dd></div>
          <div><dt>Digital</dt><dd>${money(s.digitalSales)}</dd></div>
          <div><dt>Egresos</dt><dd data-tone="error">${money(s.expensesTotal)}</dd></div>
        </dl>
      </article>
    `;
  }).join('');
}

export function renderQrTablesGridHtml({ baseUrl, makeQrSvgFn }) {
  const tables = [1, 2, 3, 4, 5, 6];
  const normalizedBase = String(baseUrl || '').trim().replace(/#.*$/, '');
  const tableCards = tables.map(num => {
    const payload = normalizedBase ? `${normalizedBase}#mesa=${num}` : `THE_BURGERS_BROTHER::mesa=${num}`;
    return `
      <article class="pos-qr-card" data-qr-table="${num}">
        <header class="pos-qr-card-head">
          <h3>Mesa ${num}</h3>
          <span class="pos-badge pos-badge-sm" data-tone="neutral">QR exclusivo</span>
        </header>
        <div class="pos-qr-preview">${makeQrSvgFn(payload, 4, 4)}</div>
        <p class="pos-qr-url font-mono-ticket" title="${escapeHtml(payload)}">${escapeHtml(payload)}</p>
        <div class="pos-qr-card-actions">
          <button type="button" data-qr-download="${num}" class="pos-btn pos-btn-dark pos-btn-sm">
            <i data-lucide="download" aria-hidden="true"></i><span>PNG</span>
          </button>
          <button type="button" data-qr-copy="${num}" class="pos-btn pos-btn-secondary pos-btn-sm">
            <i data-lucide="copy" aria-hidden="true"></i><span>Copiar</span>
          </button>
          <button type="button" data-qr-test="${num}" class="pos-btn pos-btn-subtle pos-btn-sm">
            <i data-lucide="scan-line" aria-hidden="true"></i><span>Probar</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  const deliveryUrl = normalizedBase ? `${normalizedBase}#delivery=1` : 'THE_BURGERS_BROTHER::delivery=1';
  const isLocalHost = !/^https?:\/\//i.test(normalizedBase) || /^http:\/\/(127\.|localhost)/i.test(normalizedBase);

  return `
    <div class="pos-qr-top-panel pos-card">
      <div class="pos-qr-config-row">
        <div class="pos-qr-url-field">
          <label for="qr-page-base-url">URL pública del POS</label>
          <input id="qr-page-base-url" type="url" value="${escapeHtml(normalizedBase)}" placeholder="https://theburgersbrother.com" autocomplete="url">
        </div>
        <p class="pos-qr-hint">
          ${isLocalHost
            ? 'Entorno local detectado: en producción se usa automáticamente https://theburgersbrother.com para que cada QR abra la mesa exacta.'
            : 'Dominio público activo: todos los QR de las mesas apuntan directamente a este sitio.'}
        </p>
      </div>
    </div>

    <div class="pos-qr-grid" aria-label="Códigos QR por mesa">${tableCards}</div>

    <section class="pos-card pos-qr-delivery-section" aria-labelledby="qr-delivery-title">
      <div class="pos-qr-delivery-head">
        <div>
          <span class="pos-badge pos-badge-sm" data-tone="warning">Sin QR · Enlace web público</span>
          <h3 id="qr-delivery-title">Carta web para Delivery y Para llevar</h3>
          <p>Enlace único para redes sociales y WhatsApp. Permite elegir Delivery (con GPS o dirección manual) o Para llevar (Recoger en local).</p>
        </div>
      </div>
      <div class="pos-qr-delivery-body">
        <div class="pos-qr-delivery-url font-mono-ticket" id="qr-page-delivery-url">${escapeHtml(deliveryUrl)}</div>
        <div class="pos-qr-delivery-actions">
          <button type="button" id="btn-page-copy-delivery" class="pos-btn pos-btn-secondary">
            <i data-lucide="copy" aria-hidden="true"></i><span>Copiar enlace Delivery</span>
          </button>
          <button type="button" id="btn-page-open-delivery" class="pos-btn pos-btn-primary">
            <i data-lucide="bike" aria-hidden="true"></i><span>Abrir Carta Delivery</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

export function renderRolesCardsHtml() {
  return `
    <div class="pos-roles-grid">
      <article class="pos-card pos-role-card">
        <div class="pos-role-head">
          <span class="pos-role-icon" data-tone="error" aria-hidden="true"><i data-lucide="shield-check"></i></span>
          <div>
            <h3>Admin · Nicol</h3>
            <span class="pos-badge pos-badge-sm" data-tone="error">Control total autorizado</span>
          </div>
        </div>
        <ul class="pos-role-list">
          <li>Aprueba, edita, cobra, imprime y despacha pedidos.</li>
          <li>Crea pedidos de mostrador (En mesa, Para llevar o Delivery).</li>
          <li>Supervisa Cocina y Barra en vivo.</li>
          <li>Gestiona Inventario, Kardex, Proveedores, Caja, Boletas y Reportes.</li>
          <li>Administra códigos QR y la clave de acceso de Cocina.</li>
        </ul>
      </article>

      <article class="pos-card pos-role-card">
        <div class="pos-role-head">
          <span class="pos-role-icon" data-tone="warning" aria-hidden="true"><i data-lucide="chef-hat"></i></span>
          <div>
            <h3>Cocina</h3>
            <span class="pos-badge pos-badge-sm" data-tone="warning">Estaciones de preparación</span>
          </div>
        </div>
        <ul class="pos-role-list">
          <li>Consulta comandas aprobadas de Cocina y Barra.</li>
          <li>Marca cada estación como lista o escanea código de comanda BB-….</li>
          <li>Revisa historial de Terminados y ajusta preferencias KDS.</li>
          <li>Consulta la carta de platos y sus avisos sonoros.</li>
          <li>Sin acceso a Caja, Inventario, Proveedores, QR ni edición financiera.</li>
        </ul>
      </article>

      <article class="pos-card pos-role-card">
        <div class="pos-role-head">
          <span class="pos-role-icon" data-tone="success" aria-hidden="true"><i data-lucide="qr-code"></i></span>
          <div>
            <h3>Cliente</h3>
            <span class="pos-badge pos-badge-sm" data-tone="success">Carta pública autónoma</span>
          </div>
        </div>
        <ul class="pos-role-list">
          <li>Escanea el QR fijo de Mesa 1–6 o entra al enlace web de Delivery.</li>
          <li>Explora el PDF original o lista, personaliza cremas, extras y sabores.</li>
          <li>Envía su pedido validado y consulta su estado en vivo.</li>
        </ul>
      </article>
    </div>
  `;
}
