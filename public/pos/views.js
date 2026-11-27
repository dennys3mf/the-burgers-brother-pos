/**
 * Pure presentation helpers and responsive view builders for The Burgers Brother POS V2.0.
 * Zero direct mutations to business state, API contracts, or public menu state.
 */

import {
  orderStations,
  stationReady,
  preparationStartedAt,
  parseLimaDateTime,
  formatElapsedMinutesLabel
} from '../preparation.js?v=20261127i';

export const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const money = value => `S/ ${(Number(value) || 0).toFixed(2)}`;

export const ORDER_STATUS_META = {
  POR_APROBAR: { label: 'Por aprobar', tone: 'error', icon: 'bell-ring' },
  EN_COCINA: { label: 'En cocina', tone: 'warning', icon: 'chef-hat' },
  LISTO_CHEF: { label: 'Listo', tone: 'success', icon: 'check-circle-2' },
  ENTREGADO: { label: 'Entregado', tone: 'neutral', icon: 'receipt' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral', icon: 'x-circle' },
  RECHAZADO: { label: 'Rechazado', tone: 'neutral', icon: 'ban' }
};

export function orderOriginText(order) {
  if (!order) return '-';
  if (order.channel === 'DELIVERY') return 'Delivery';
  if (order.channel === 'RECOJO') return 'Para llevar (Recoger)';
  return `${order.table || 'Mesa'}${order.takeaway ? ' · Para llevar' : ''}`;
}

export function extractMapsUrl(address) {
  const match = String(address || '').match(/https:\/\/maps\.google\.com\/\?q=-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

export function stripMapsUrl(address) {
  return String(address || '')
    .replace(/\s*·?\s*https:\/\/maps\.google\.com\/\?q=-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g, '')
    .trim();
}

/**
 * Resolves exact epoch ms reference for an order timer (preparation start when cooking/ready, otherwise creation).
 */
export function orderElapsedRefMs(order) {
  const prepMs = preparationStartedAt(order);
  if (Number.isFinite(prepMs)) return prepMs;
  const isoMs = Date.parse(order?.createdIso || '');
  if (Number.isFinite(isoMs)) return isoMs;
  return parseLimaDateTime(order?.createdAt);
}

/**
 * Formats elapsed time since approval/creation without modifying persisted timestamps.
 */
export function formatElapsedFromOrder(order, nowMs = Date.now()) {
  return formatElapsedMinutesLabel(orderElapsedRefMs(order), nowMs);
}

/**
 * Computes real operational counts and prioritized active orders from current POS state.
 */
export function computeDashboardModel(state, { staffArea, activeShift, businessStatus, nowMs = Date.now() } = {}) {
  const orders = state?.orders || [];
  const pendingOrders = orders.filter(o => o.status === 'POR_APROBAR');
  const cookingOrders = orders.filter(o => o.status === 'EN_COCINA');
  const readyOrders = orders.filter(o => o.status === 'LISTO_CHEF');
  const cocinaPending = orders.filter(o =>
    ['EN_COCINA', 'LISTO_CHEF'].includes(o.status) && orderStations(o).includes('COCINA') && !stationReady(o, 'COCINA')
  ).length;
  const barraPending = orders.filter(o =>
    ['EN_COCINA', 'LISTO_CHEF'].includes(o.status) && orderStations(o).includes('BARRA') && !stationReady(o, 'BARRA')
  ).length;

  const activePriority = { POR_APROBAR: 0, LISTO_CHEF: 1, EN_COCINA: 2 };
  const activeOrders = [...pendingOrders, ...readyOrders, ...cookingOrders]
    .filter(o => staffArea === 'admin' || o.status === 'EN_COCINA')
    .sort((a, b) => (activePriority[a.status] ?? 9) - (activePriority[b.status] ?? 9));

  const ingredients = state?.ingredients || [];
  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock).length;

  const movements = state?.caja?.movements || [];
  let cashIn = 0;
  let expOut = 0;
  for (const m of movements) {
    if (m.type === 'EGRESO') expOut += Math.abs(m.amount);
    else if (m.type === 'VENTA' && m.method === 'Efectivo') cashIn += m.amount;
  }
  const opening = Number(activeShift?.opening ?? state?.caja?.opening ?? 0);
  const expectedCash = Number.isFinite(activeShift?.expectedCash) ? activeShift.expectedCash : (opening + cashIn - expOut);

  return {
    pendingCount: pendingOrders.length,
    cookingCount: cookingOrders.length,
    cocinaPending,
    barraPending,
    readyCount: readyOrders.length,
    activeOrders,
    lowStockCount,
    totalIngredients: ingredients.length,
    expectedCash,
    shiftOpen: activeShift?.status === 'OPEN',
    businessOpen: businessStatus ? Boolean(businessStatus.open) : true,
    nowMs
  };
}

export function renderDashboardHtml(model, { staffArea }) {
  const isAdmin = staffArea === 'admin';
  const kpiCards = isAdmin
    ? [
        { id: 'por-aprobar', label: 'Por aprobar', count: model.pendingCount, tone: model.pendingCount > 0 ? 'error' : 'neutral', icon: 'bell-ring', action: 'nav-pedidos-por-aprobar' },
        { id: 'en-cocina', label: 'En cocina', count: model.cocinaPending, tone: model.cocinaPending > 0 ? 'warning' : 'neutral', icon: 'cooking-pot', action: 'nav-cocina' },
        { id: 'en-barra', label: 'En barra', count: model.barraPending, tone: model.barraPending > 0 ? 'warning' : 'neutral', icon: 'cup-soda', action: 'nav-barra' },
        { id: 'listos', label: 'Listos', count: model.readyCount, tone: model.readyCount > 0 ? 'success' : 'neutral', icon: 'check-circle-2', action: 'nav-pedidos-listos' }
      ]
    : [
        { id: 'en-cocina', label: 'En Cocina', count: model.cocinaPending, tone: model.cocinaPending > 0 ? 'warning' : 'neutral', icon: 'cooking-pot', action: 'nav-cocina' },
        { id: 'en-barra', label: 'En Barra', count: model.barraPending, tone: model.barraPending > 0 ? 'warning' : 'neutral', icon: 'cup-soda', action: 'nav-barra' }
      ];

  const primaryCta = isAdmin
    ? `<button type="button" data-dash-action="new-order" class="pos-btn pos-btn-primary pos-btn-lg"><i data-lucide="plus" aria-hidden="true"></i><span>Nuevo pedido</span></button>`
    : `<button type="button" data-dash-action="nav-cocina" class="pos-btn pos-btn-primary pos-btn-lg"><i data-lucide="cooking-pot" aria-hidden="true"></i><span>Abrir comandas</span></button>`;

  const secondaryCta = !isAdmin
    ? `<button type="button" data-dash-action="prep-code" class="pos-btn pos-btn-secondary"><i data-lucide="scan-line" aria-hidden="true"></i><span>Código BB-…</span></button>`
    : '';

  const kpiHtml = kpiCards.map(card => `
    <button type="button" class="pos-kpi-card" data-tone="${card.tone}" data-dash-action="${card.action}">
      <div class="pos-kpi-head">
        <span class="pos-kpi-label">${escapeHtml(card.label)}</span>
        <span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="${card.icon}"></i></span>
      </div>
      <div class="pos-kpi-foot">
        <strong class="pos-kpi-value">${card.count}</strong>
        <i data-lucide="chevron-right" class="pos-kpi-arrow" aria-hidden="true"></i>
      </div>
    </button>
  `).join('');

  const visibleOrders = model.activeOrders.slice(0, 8);
  const activeOrdersBody = visibleOrders.length
    ? `
      <div class="pos-table-wrap pos-dash-table-desktop">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Cliente / Pedido</th>
              <th>Canal</th>
              <th>Estado</th>
              <th class="text-right">Total</th>
              <th>Tiempo</th>
              <th class="text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${visibleOrders.map(order => {
              const st = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.POR_APROBAR;
              const refMs = orderElapsedRefMs(order);
              const elapsed = formatElapsedMinutesLabel(refMs, model.nowMs) || '—';
              const quickLabel = isAdmin
                ? (order.status === 'POR_APROBAR' ? 'Revisar' : order.status === 'LISTO_CHEF' ? (order.paymentStatus === 'PAGADO' ? 'Despachar' : 'Cobrar') : 'Ver')
                : 'Preparar';
              const quickAction = isAdmin ? `open-order:${escapeHtml(order.id)}` : `open-station:${orderStations(order)[0] || 'COCINA'}`;
              return `
                <tr>
                  <td>
                    <div class="pos-cell-title">${escapeHtml(order.customer || 'Cliente')}</div>
                    <div class="pos-cell-code font-mono-ticket">${escapeHtml(order.code)}</div>
                  </td>
                  <td><span class="pos-cell-meta">${escapeHtml(orderOriginText(order))}</span></td>
                  <td><span class="pos-badge" data-tone="${st.tone}"><i data-lucide="${st.icon}" aria-hidden="true"></i>${st.label}</span></td>
                  <td class="text-right pos-num-cell">${money(order.total)}</td>
                  <td class="pos-num-cell pos-muted-cell"><span ${Number.isFinite(refMs) ? `data-order-elapsed-ref="${refMs}"` : ''}>${escapeHtml(elapsed)}</span></td>
                  <td class="text-right">
                    <button type="button" class="pos-btn pos-btn-subtle pos-btn-sm" data-dash-action="${quickAction}">${quickLabel}</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="pos-dash-list-mobile">
        ${visibleOrders.map(order => {
          const st = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.POR_APROBAR;
          const refMs = orderElapsedRefMs(order);
          const elapsed = formatElapsedMinutesLabel(refMs, model.nowMs);
          const quickAction = isAdmin ? `open-order:${escapeHtml(order.id)}` : `open-station:${orderStations(order)[0] || 'COCINA'}`;
          return `
            <button type="button" class="pos-mobile-row-btn" data-dash-action="${quickAction}">
              <div class="pos-mobile-row-top">
                <div>
                  <span class="pos-cell-title">${escapeHtml(orderOriginText(order))} · ${escapeHtml(order.customer || 'Cliente')}</span>
                  <span class="pos-cell-code font-mono-ticket">${escapeHtml(order.code)}${elapsed ? ` · <span ${Number.isFinite(refMs) ? `data-order-elapsed-ref="${refMs}"` : ''}>${escapeHtml(elapsed)}</span>` : ''}</span>
                </div>
                <strong class="pos-num-cell">${money(order.total)}</strong>
              </div>
              <div class="pos-mobile-row-bottom">
                <span class="pos-badge" data-tone="${st.tone}"><i data-lucide="${st.icon}" aria-hidden="true"></i>${st.label}</span>
                <span class="pos-link-hint">Abrir <i data-lucide="chevron-right" aria-hidden="true"></i></span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `
    : `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="check-circle-2"></i></span>
        <h3>Sin pedidos activos en curso</h3>
        <p>${isAdmin ? 'Los pedidos de mesas QR, Delivery, Para llevar o mostrador aparecerán aquí.' : 'No hay comandas pendientes en Cocina o Barra en este momento.'}</p>
        ${isAdmin ? `<button type="button" class="pos-btn pos-btn-secondary" data-dash-action="new-order"><i data-lucide="plus" aria-hidden="true"></i>Tomar pedido</button>` : ''}
      </div>
    `;

  const sideWidgets = isAdmin
    ? `
      <div class="pos-dash-aside">
        <button type="button" class="pos-summary-card" data-dash-action="nav-inventario" data-tone="${model.lowStockCount > 0 ? 'warning' : 'success'}">
          <div class="pos-summary-head">
            <span class="pos-summary-title">Alertas de inventario</span>
            <span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="package"></i></span>
          </div>
          <strong class="pos-summary-metric">${model.lowStockCount}</strong>
          <p class="pos-summary-sub">${model.lowStockCount > 0 ? `Insumos con stock bajo de ${model.totalIngredients}` : `Stock al día (${model.totalIngredients} insumos)`}</p>
          <span class="pos-summary-link">Revisar inventario <i data-lucide="arrow-right" aria-hidden="true"></i></span>
        </button>

        <button type="button" class="pos-summary-card" data-dash-action="nav-caja" data-tone="${model.shiftOpen ? 'success' : 'neutral'}">
          <div class="pos-summary-head">
            <span class="pos-summary-title">Caja del día</span>
            <span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="wallet"></i></span>
          </div>
          <strong class="pos-summary-metric">${money(model.expectedCash)}</strong>
          <p class="pos-summary-sub">${model.shiftOpen ? 'Efectivo esperado · Jornada abierta' : model.businessOpen ? 'Jornada pendiente por abrir' : 'Local cerrado hoy'}</p>
          <span class="pos-summary-link">Consultar caja <i data-lucide="arrow-right" aria-hidden="true"></i></span>
        </button>
      </div>
    `
    : `
      <div class="pos-dash-aside">
        <button type="button" class="pos-summary-card" data-dash-action="nav-terminados" data-tone="success">
          <div class="pos-summary-head">
            <span class="pos-summary-title">Comandas terminadas</span>
            <span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="check-circle-2"></i></span>
          </div>
          <p class="pos-summary-sub">Consulta el historial de Cocina y Barra marcado como listo.</p>
          <span class="pos-summary-link">Ver terminados <i data-lucide="arrow-right" aria-hidden="true"></i></span>
        </button>

        <button type="button" class="pos-summary-card" data-dash-action="nav-carta" data-tone="neutral">
          <div class="pos-summary-head">
            <span class="pos-summary-title">Carta de platos</span>
            <span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="book-open"></i></span>
          </div>
          <p class="pos-summary-sub">Consulta ingredientes, combos y bebidas de la carta.</p>
          <span class="pos-summary-link">Abrir carta <i data-lucide="arrow-right" aria-hidden="true"></i></span>
        </button>
      </div>
    `;

  return `
    <div class="pos-dash-top">
      <div>
        <h2 class="pos-section-heading">Operación en vivo</h2>
      </div>
      <div class="pos-dash-cta-group">
        ${secondaryCta}
        ${primaryCta}
      </div>
    </div>

    <div class="pos-kpi-grid ${isAdmin ? 'is-4' : 'is-2'}" role="region" aria-label="Indicadores operativos en vivo">
      ${kpiHtml}
    </div>

    <div class="pos-dash-split">
      <section class="pos-card pos-dash-orders" aria-labelledby="dash-active-orders-title">
        <div class="pos-card-header">
          <h3 id="dash-active-orders-title">Pedidos activos (${model.activeOrders.length})</h3>
          <button type="button" class="pos-text-link" data-dash-action="${isAdmin ? 'nav-pedidos' : 'nav-cocina'}">
            Ver todos <i data-lucide="arrow-right" aria-hidden="true"></i>
          </button>
        </div>
        ${activeOrdersBody}
      </section>
      ${sideWidgets}
    </div>
  `;
}

/**
 * Renders the Master list and Detail pane for Pedidos (#admin).
 */
export function renderAdminOrderListHtml(filtered, selectedId, nowMs = Date.now()) {
  if (!filtered.length) {
    return `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="clipboard-list"></i></span>
        <h3>Sin pedidos en esta vista</h3>
        <p>Cambia de bandeja o limpia la búsqueda para ver otros pedidos.</p>
      </div>
    `;
  }

  return filtered.map(order => {
    const isDel = order.channel === 'DELIVERY';
    const isRecojo = order.channel === 'RECOJO';
    const icon = isDel ? 'bike' : isRecojo || order.takeaway ? 'shopping-bag' : 'utensils';
    const st = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.POR_APROBAR;
    const refMs = orderElapsedRefMs(order);
    const elapsed = formatElapsedMinutesLabel(refMs, nowMs) || order.createdAt || '';
    const selected = order.id === selectedId;
    return `
      <button type="button" class="pos-master-item ${selected ? 'is-selected' : ''}" data-select-order="${escapeHtml(order.id)}" aria-current="${selected ? 'true' : 'false'}">
        <div class="pos-master-row-top">
          <span class="pos-master-origin"><i data-lucide="${icon}" aria-hidden="true"></i>${escapeHtml(orderOriginText(order))}</span>
          <strong class="pos-master-total">${money(order.total)}</strong>
        </div>
        <div class="pos-master-row-mid">
          <span class="pos-master-customer">${escapeHtml(order.customer)}</span>
          <span class="pos-master-time" ${Number.isFinite(refMs) ? `data-order-elapsed-ref="${refMs}"` : ''}>${escapeHtml(elapsed)}</span>
        </div>
        <div class="pos-master-row-bot">
          <span class="pos-badge pos-badge-sm" data-tone="${st.tone}">${st.label}</span>
          <span class="pos-master-code font-mono-ticket">${escapeHtml(order.code)}</span>
        </div>
      </button>
    `;
  }).join('');
}

export function renderAdminOrderDetailHtml(order, { canEdit, canCancel, stationLabelFn, stationReadyFn, orderStationsFn, nowMs = Date.now() }) {
  if (!order) {
    return `
      <div class="pos-empty-state pos-detail-empty">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="mouse-pointer-click"></i></span>
        <h3>Selecciona un pedido</h3>
        <p>Toca cualquier pedido de la lista para revisar productos, personalizar, aprobar, cobrar o imprimir.</p>
      </div>
    `;
  }

  const isDel = order.channel === 'DELIVERY';
  const isRecojo = order.channel === 'RECOJO';
  const st = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.POR_APROBAR;
  const mapsUrl = isDel ? extractMapsUrl(order.address) : '';
  const cleanAddr = isDel ? (stripMapsUrl(order.address) || order.address) : '';
  const payHint = order.paymentStatus === 'PAGADO'
    ? `${order.paymentMethod} pagado`
    : (isDel ? 'Pago por verificar' : isRecojo ? 'Pago al recoger' : 'Pago en mesa');
  const refMs = orderElapsedRefMs(order);
  const elapsed = formatElapsedMinutesLabel(refMs, nowMs);

  const itemsHtml = (order.items || []).map(it => `
    <li class="pos-detail-item">
      <div class="pos-detail-item-main">
        <span class="pos-detail-qty">${escapeHtml(it.qty)}×</span>
        <div class="pos-detail-item-body">
          <div class="pos-detail-item-name">
            <strong>${escapeHtml(it.name)}</strong>
            <span class="pos-station-chip" data-station="${escapeHtml(it.station)}">${escapeHtml(it.station || 'COCINA')}</span>
          </div>
          ${it.flavors?.length ? `<p class="pos-detail-meta">Sabores: ${escapeHtml(it.flavors.join(', '))}</p>` : ''}
          ${it.extras?.length ? `<p class="pos-detail-meta">Extras: ${escapeHtml(it.extras.map(e => e.name).join(', '))}</p>` : ''}
          ${it.note ? `<p class="pos-detail-note">${escapeHtml(it.note)}</p>` : ''}
        </div>
        <span class="pos-detail-price">${money(it.qty * it.unitPrice)}</span>
      </div>
    </li>
  `).join('');

  let primaryAction = '';
  if (order.status === 'POR_APROBAR') {
    primaryAction = `<button type="button" data-admin-approve="${escapeHtml(order.id)}" class="pos-btn pos-btn-primary pos-btn-lg pos-action-main"><i data-lucide="printer" aria-hidden="true"></i><span>Aprobar e imprimir</span></button>`;
  } else if (order.status === 'LISTO_CHEF') {
    primaryAction = order.paymentStatus !== 'PAGADO'
      ? `<button type="button" data-admin-pay-mesa="${escapeHtml(order.id)}" class="pos-btn pos-btn-success pos-btn-lg pos-action-main"><i data-lucide="banknote" aria-hidden="true"></i><span>Cobrar y Emitir Boleta</span></button>`
      : `<button type="button" data-admin-deliver="${escapeHtml(order.id)}" class="pos-btn pos-btn-success pos-btn-lg pos-action-main"><i data-lucide="check-circle-2" aria-hidden="true"></i><span>Despachar + Boleta Interna</span></button>`;
  } else if (order.status === 'ENTREGADO') {
    primaryAction = `<button type="button" data-admin-reprint-boleta="${escapeHtml(order.id)}" class="pos-btn pos-btn-dark pos-btn-lg pos-action-main"><i data-lucide="receipt" aria-hidden="true"></i><span>Ver Boleta ${escapeHtml(order.boletaNum || '')}</span></button>`;
  }

  return `
    <div class="pos-detail-card">
      <div class="pos-detail-mobile-back">
        <button type="button" id="btn-mobile-back-orders" class="pos-btn pos-btn-subtle pos-btn-sm">
          <i data-lucide="arrow-left" aria-hidden="true"></i><span>Volver a pedidos</span>
        </button>
      </div>

      <header class="pos-detail-header">
        <div>
          <div class="pos-detail-badges">
            <span class="pos-badge" data-tone="${st.tone}"><i data-lucide="${st.icon}" aria-hidden="true"></i>${st.label}</span>
            ${elapsed ? `<span class="pos-time-pill" ${Number.isFinite(refMs) ? `data-order-elapsed-ref="${refMs}"` : ''}>${escapeHtml(elapsed)}</span>` : ''}
          </div>
          <h2 class="pos-detail-title">${escapeHtml(order.customer)}</h2>
          <p class="pos-detail-subtitle">
            <span>${escapeHtml(orderOriginText(order))}</span>
            <span>·</span>
            <span class="font-mono-ticket">${escapeHtml(order.code)}</span>
            ${order.boletaNum ? `<span>·</span><span class="font-mono-ticket">${escapeHtml(order.boletaNum)}</span>` : ''}
          </p>
        </div>
        <div class="pos-detail-payment-box">
          <strong class="pos-detail-total">${money(order.total)}</strong>
          <span class="pos-pay-pill" data-paid="${order.paymentStatus === 'PAGADO'}">${escapeHtml(payHint)}</span>
        </div>
      </header>

      ${order.status === 'EN_COCINA' ? `
        <div class="pos-station-progress">
          ${orderStationsFn(order).map(area => `
            <span class="pos-badge" data-tone="${stationReadyFn(order, area) ? 'success' : 'warning'}">
              <i data-lucide="${area === 'BARRA' ? 'cup-soda' : 'cooking-pot'}" aria-hidden="true"></i>
              ${escapeHtml(stationLabelFn(area))}: ${stationReadyFn(order, area) ? 'lista' : 'en preparación'}
            </span>
          `).join('')}
        </div>
      ` : ''}

      ${(isDel || order.phone || cleanAddr || order.paymentRef) ? `
        <div class="pos-detail-logistics">
          ${order.phone ? `<div><strong>Teléfono:</strong> ${escapeHtml(order.phone)}</div>` : ''}
          ${cleanAddr ? `<div><strong>Entrega:</strong> ${escapeHtml(cleanAddr)}</div>` : ''}
          ${mapsUrl ? `<div><a class="pos-inline-map-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="map-pin" aria-hidden="true"></i>Abrir ubicación exacta en Google Maps</a></div>` : ''}
          ${order.paymentRef ? `<div><strong>Operación (${escapeHtml(order.paymentMethod)}):</strong> <span class="font-mono-ticket">${escapeHtml(order.paymentRef)}</span></div>` : ''}
        </div>
      ` : ''}

      <div class="pos-detail-section">
        <h3>Productos de la comanda</h3>
        <ul class="pos-detail-items">${itemsHtml}</ul>
        ${order.note ? `<div class="pos-detail-order-note"><strong>Nota del pedido:</strong> ${escapeHtml(order.note)}</div>` : ''}
      </div>

      <footer class="pos-detail-footer">
        <div class="pos-detail-secondary-actions">
          <button type="button" data-admin-reprint="${escapeHtml(order.id)}" class="pos-btn pos-btn-secondary">
            <i data-lucide="printer" aria-hidden="true"></i><span>Ver comanda</span>
          </button>
          ${canEdit ? `<button type="button" data-admin-edit="${escapeHtml(order.id)}" class="pos-btn pos-btn-secondary"><i data-lucide="pencil" aria-hidden="true"></i><span>Editar comanda</span></button>` : ''}
          ${canCancel ? `<button type="button" data-admin-cancel="${escapeHtml(order.id)}" class="pos-btn pos-btn-danger"><i data-lucide="x-circle" aria-hidden="true"></i><span>Cancelar pedido</span></button>` : ''}
        </div>
        ${primaryAction ? `<div class="pos-detail-primary-action">${primaryAction}</div>` : ''}
      </footer>
    </div>
  `;
}

/**
 * Pure inventory filter & semantic status helper (respects real negative balances without hiding them).
 */
export function ingredientStatusMeta(item) {
  if (item.stock < 0) return { label: 'Faltante', tone: 'error', key: 'faltante' };
  if (item.stock <= item.minStock) return { label: 'Stock bajo', tone: 'warning', key: 'bajo' };
  return { label: 'Óptimo', tone: 'success', key: 'optimo' };
}

export function filterIngredients(ingredients, { search = '', station = 'ALL', status = 'ALL' } = {}) {
  const q = String(search || '').trim().toLocaleLowerCase('es');
  return (ingredients || []).filter(item => {
    if (station !== 'ALL' && item.station !== station) return false;
    const st = ingredientStatusMeta(item);
    if (status !== 'ALL' && st.key !== status) return false;
    if (!q) return true;
    return [item.code, item.name, item.station, item.unit].some(v => String(v || '').toLocaleLowerCase('es').includes(q));
  });
}

export function renderInventoryKpisHtml(ingredients) {
  const list = ingredients || [];
  const lowCount = list.filter(i => i.stock <= i.minStock).length;
  const deficitCount = list.filter(i => i.stock < 0).length;
  const valTotal = list.reduce((sum, i) => sum + i.stock * i.cost, 0);
  const negativeVal = valTotal < 0;

  return `
    <div class="pos-kpi-card" data-tone="neutral">
      <div class="pos-kpi-head"><span class="pos-kpi-label">Insumos controlados</span><span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="package"></i></span></div>
      <strong class="pos-kpi-value">${list.length}</strong>
    </div>
    <div class="pos-kpi-card" data-tone="${lowCount > 0 ? 'warning' : 'success'}">
      <div class="pos-kpi-head"><span class="pos-kpi-label">Stock bajo / Faltante</span><span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="alert-triangle"></i></span></div>
      <div class="pos-kpi-foot"><strong class="pos-kpi-value">${lowCount}</strong><span class="pos-kpi-sub">${deficitCount ? `${deficitCount} negativos` : 'mínimo'}</span></div>
    </div>
    <div class="pos-kpi-card" data-tone="${negativeVal ? 'error' : 'success'}">
      <div class="pos-kpi-head"><span class="pos-kpi-label">Valor del almacén</span><span class="pos-kpi-icon" aria-hidden="true"><i data-lucide="${negativeVal ? 'alert-octagon' : 'circle-dollar-sign'}"></i></span></div>
      <div class="pos-kpi-foot">
        <strong class="pos-kpi-value pos-money-val" data-negative="${negativeVal}">${money(valTotal)}</strong>
        ${negativeVal ? '<span class="pos-badge pos-badge-sm" data-tone="error">Déficit real</span>' : ''}
      </div>
    </div>
  `;
}

export function renderInventoryRowsAndCards(filtered) {
  if (!filtered.length) {
    const empty = `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="package-search"></i></span>
        <h3>No se encontraron insumos</h3>
        <p>Ajusta los filtros o crea un nuevo insumo.</p>
      </div>`;
    return { tbodyHtml: `<tr><td colspan="7">${empty}</td></tr>`, mobileHtml: empty };
  }

  const tbodyHtml = filtered.map(item => {
    const st = ingredientStatusMeta(item);
    return `
      <tr>
        <td class="font-mono-ticket pos-muted-cell">${escapeHtml(item.code)}</td>
        <td><strong class="pos-cell-title">${escapeHtml(item.name)}</strong></td>
        <td><span class="pos-station-chip" data-station="${escapeHtml(item.station)}">${escapeHtml(item.station)}</span></td>
        <td class="text-right pos-num-cell" data-tone="${item.stock <= item.minStock ? st.tone : 'normal'}">${item.stock} ${escapeHtml(item.unit)}</td>
        <td class="text-right pos-num-cell pos-muted-cell">${item.minStock} ${escapeHtml(item.unit)}</td>
        <td class="text-right pos-num-cell">${money(item.cost)}</td>
        <td class="text-center"><span class="pos-badge" data-tone="${st.tone}">${st.label}</span></td>
      </tr>
    `;
  }).join('');

  const mobileHtml = filtered.map(item => {
    const st = ingredientStatusMeta(item);
    return `
      <article class="pos-mobile-card">
        <div class="pos-mobile-card-top">
          <div>
            <strong class="pos-cell-title">${escapeHtml(item.name)}</strong>
            <div class="pos-mobile-card-meta">
              <span class="font-mono-ticket">${escapeHtml(item.code)}</span>
              <span class="pos-station-chip" data-station="${escapeHtml(item.station)}">${escapeHtml(item.station)}</span>
            </div>
          </div>
          <span class="pos-badge" data-tone="${st.tone}">${st.label}</span>
        </div>
        <div class="pos-mobile-card-main">
          <span>Stock actual</span>
          <strong class="pos-num-cell" data-tone="${item.stock <= item.minStock ? st.tone : 'normal'}">${item.stock} ${escapeHtml(item.unit)}</strong>
        </div>
        <details class="pos-mobile-details">
          <summary>Ver mínimo, costo y valoración</summary>
          <dl class="pos-mobile-dl">
            <div><dt>Stock mínimo</dt><dd>${item.minStock} ${escapeHtml(item.unit)}</dd></div>
            <div><dt>Costo unitario</dt><dd>${money(item.cost)}</dd></div>
            <div><dt>Valorización</dt><dd>${money(item.stock * item.cost)}</dd></div>
          </dl>
        </details>
      </article>
    `;
  }).join('');

  return { tbodyHtml, mobileHtml };
}

/**
 * Pure Kardex filter using existing movement fields plus ingredient station map.
 */
export function normalizeKardexDate(dateStr) {
  const iso = String(dateStr || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = String(dateStr || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!dmy) return '';
  const yyyy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
  return `${yyyy}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
}

export function filterKardexMovements(kardex, ingredients, { search = '', station = 'ALL', type = 'ALL', date = '' } = {}) {
  const q = String(search || '').trim().toLocaleLowerCase('es');
  const stationByIngId = new Map((ingredients || []).map(i => [i.id, i.station]));
  const stationByIngName = new Map((ingredients || []).map(i => [String(i.name || '').toLocaleLowerCase('es'), i.station]));

  return (kardex || []).filter(k => {
    const ingStation = stationByIngId.get(k.ingId) || stationByIngName.get(String(k.ingName || '').toLocaleLowerCase('es')) || '';
    if (station !== 'ALL' && ingStation !== station) return false;
    if (type === 'ENTRADA' && k.qty < 0) return false;
    if (type === 'SALIDA' && k.qty >= 0) return false;
    if (date && normalizeKardexDate(k.date) !== date) return false;
    if (!q) return true;
    return [k.ingName, k.doc, k.type, k.date].some(v => String(v || '').toLocaleLowerCase('es').includes(q));
  });
}

export function renderKardexRowsAndCards(movements, ingredients) {
  if (!movements.length) {
    const empty = `
      <div class="pos-empty-state">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="list-restart"></i></span>
        <h3>No se encontraron movimientos</h3>
        <p>Prueba cambiando el filtro de fecha, estación o búsqueda.</p>
      </div>`;
    return { tbodyHtml: `<tr><td colspan="8">${empty}</td></tr>`, mobileHtml: empty };
  }

  const stationByIngId = new Map((ingredients || []).map(i => [i.id, i.station]));
  const tbodyHtml = movements.map(k => {
    const isEntry = k.qty >= 0;
    const stName = stationByIngId.get(k.ingId) || '—';
    return `
      <tr>
        <td class="pos-muted-cell whitespace-nowrap">${escapeHtml(k.date)}</td>
        <td><strong class="pos-cell-title">${escapeHtml(k.ingName)}</strong></td>
        <td><span class="pos-station-chip" data-station="${escapeHtml(stName)}">${escapeHtml(stName)}</span></td>
        <td><span class="pos-badge" data-tone="${isEntry ? 'success' : 'warning'}">${escapeHtml(k.type)}</span></td>
        <td class="pos-cell-meta">${escapeHtml(k.doc)}</td>
        <td class="text-right pos-num-cell pos-muted-cell">${k.prev} ${escapeHtml(k.unit)}</td>
        <td class="text-right pos-num-cell" data-tone="${isEntry ? 'success' : 'error'}">${isEntry ? `+${k.qty}` : k.qty} ${escapeHtml(k.unit)}</td>
        <td class="text-right pos-num-cell"><strong>${k.next} ${escapeHtml(k.unit)}</strong></td>
      </tr>
    `;
  }).join('');

  const mobileHtml = movements.map(k => {
    const isEntry = k.qty >= 0;
    const stName = stationByIngId.get(k.ingId) || '—';
    return `
      <article class="pos-mobile-card">
        <div class="pos-mobile-card-top">
          <div>
            <strong class="pos-cell-title">${escapeHtml(k.ingName)}</strong>
            <div class="pos-mobile-card-meta">
              <span>${escapeHtml(k.date)}</span>
              <span class="pos-station-chip" data-station="${escapeHtml(stName)}">${escapeHtml(stName)}</span>
            </div>
          </div>
          <span class="pos-badge" data-tone="${isEntry ? 'success' : 'warning'}">${escapeHtml(k.type)}</span>
        </div>
        <div class="pos-mobile-card-main">
          <span class="pos-truncate-doc">${escapeHtml(k.doc)}</span>
          <strong class="pos-num-cell" data-tone="${isEntry ? 'success' : 'error'}">${isEntry ? `+${k.qty}` : k.qty} ${escapeHtml(k.unit)}</strong>
        </div>
        <details class="pos-mobile-details">
          <summary>Ver trazabilidad completa</summary>
          <dl class="pos-mobile-dl">
            <div><dt>Stock anterior</dt><dd>${k.prev} ${escapeHtml(k.unit)}</dd></div>
            <div><dt>Saldo resultante</dt><dd>${k.next} ${escapeHtml(k.unit)}</dd></div>
            <div><dt>Documento</dt><dd>${escapeHtml(k.doc)}</dd></div>
          </dl>
        </details>
      </article>
    `;
  }).join('');

  return { tbodyHtml, mobileHtml };
}
