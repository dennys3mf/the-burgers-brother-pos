/**
 * Dedicated Tablet-First Split View presentation for "Nuevo pedido" (#nuevo-pedido).
 * Completely decoupled visually from Public Carta QR while sharing catalog, customization, and checkout services.
 */

import { escapeHtml, money } from './views.js?v=20261127i';

export const NP_CATEGORIES = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Hamburguesas', label: 'Hamburguesas' },
  { id: 'Alitas y Combos', label: 'Alitas' },
  { id: 'Bebidas y Frappes', label: 'Bebidas' },
  { id: 'Salchipapas y Broster', label: 'Salchipapas' },
  { id: 'Cocteles (Barra)', label: 'Cócteles' }
];

/**
 * Returns non-retired catalog products filtered consistently by single category source + search text.
 */
export function filterPosProducts(menu, { category = 'Todos', search = '' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  return (menu || []).filter(item => {
    if (!item || item.retired) return false;
    const catOk = category === 'Todos' || item.cat === category;
    if (!catOk) return false;
    if (!q) return true;
    return (
      String(item.name || '').toLowerCase().includes(q)
      || String(item.desc || '').toLowerCase().includes(q)
      || String(item.cat || '').toLowerCase().includes(q)
    );
  });
}

/**
 * Returns the static shell scaffold for Nuevo pedido so live inputs keep focus across partial re-renders.
 */
export function renderNuevoPedidoShellHtml({ mode = 'MESA', mesa = 'Mesa 4', category = 'Todos', search = '' } = {}) {
  const tableOptions = [1, 2, 3, 4, 5, 6]
    .map(n => `<option value="Mesa ${n}" ${mesa === `Mesa ${n}` ? 'selected' : ''}>Mesa ${n}</option>`)
    .join('');
  const categoryOptions = NP_CATEGORIES
    .map(cat => `<option value="${escapeHtml(cat.id)}" ${category === cat.id ? 'selected' : ''}>Categoría: ${escapeHtml(cat.label)}</option>`)
    .join('');

  return `
    <div class="pos-np-shell">
      <div class="pos-np-modebar">
        <div class="pos-np-modebar-left">
          <div class="pos-mode-pills" role="group" aria-label="Modalidad del pedido">
            <button type="button" data-np-mode="MESA" class="pos-mode-pill" aria-pressed="${mode === 'MESA'}">En mesa</button>
            <button type="button" data-np-mode="RECOJO" class="pos-mode-pill" aria-pressed="${mode === 'RECOJO'}">Para llevar</button>
            <button type="button" data-np-mode="DELIVERY" class="pos-mode-pill" aria-pressed="${mode === 'DELIVERY'}">Delivery</button>
          </div>
          <label for="np-mesa-select" class="sr-only">Mesa asignada</label>
          <select id="np-mesa-select" class="pos-mesa-select" aria-label="Número de mesa" ${mode === 'MESA' ? '' : 'hidden disabled'}>
            ${tableOptions}
          </select>
        </div>
        <button type="button" id="np-open-pdf-btn" class="pos-btn pos-btn-subtle pos-btn-sm">
          <i data-lucide="book-open" aria-hidden="true"></i><span>Ver carta PDF</span>
        </button>
      </div>

      <div class="pos-np-split">
        <section class="pos-np-catalog-pane" aria-label="Catálogo de productos">
          <div class="pos-np-controls">
            <div class="pos-search-input-wrap pos-np-search-wrap">
              <i data-lucide="search" aria-hidden="true"></i>
              <input id="np-search" type="search" enterkeyhint="search" value="${escapeHtml(search)}" placeholder="Buscar productos..." aria-label="Buscar productos del catálogo">
            </div>
            <div id="np-cat-tabs" class="pos-np-cat-tabs" role="group" aria-label="Categorías del catálogo">
              ${renderNuevoPedidoCategoryTabsHtml(category)}
            </div>
            <div class="pos-np-cat-mobile-wrap">
              <label for="np-category-select" class="sr-only">Seleccionar categoría</label>
              <select id="np-category-select" class="pos-filter-select pos-np-cat-select" aria-label="Categoría del catálogo">
                ${categoryOptions}
              </select>
            </div>
          </div>

          <div class="pos-np-catalog-scroll">
            <div id="np-product-grid" class="pos-np-grid"></div>
          </div>
        </section>

        <div id="np-cart-backdrop" class="pos-drawer-backdrop pos-np-cart-backdrop" hidden></div>
        <aside id="np-cart-pane" class="pos-np-cart-pane" aria-labelledby="np-cart-title">
          <header class="pos-np-cart-head">
            <div class="pos-np-cart-titlewrap">
              <h2 id="np-cart-title">Pedido actual</h2>
              <p id="np-cart-subtitle" class="pos-np-cart-sub"></p>
            </div>
            <div class="pos-np-cart-head-actions">
              <button type="button" id="np-cart-clear" class="pos-btn pos-btn-danger pos-btn-sm" hidden>
                <i data-lucide="trash-2" aria-hidden="true"></i><span>Vaciar</span>
              </button>
              <button type="button" id="np-cart-close" class="pos-more-close pos-np-cart-close" aria-label="Cerrar resumen del pedido">
                <i data-lucide="x" aria-hidden="true"></i>
              </button>
            </div>
          </header>

          <form id="np-checkout" class="pos-np-checkout-form" novalidate>
            <div class="pos-np-cart-body">
              <div id="np-cart-items" class="pos-np-cart-items"></div>

              <div id="np-checkout-fields" class="pos-np-fields" hidden>
                <div class="pos-np-field">
                  <label for="np-name">
                    <span>Nombre del cliente</span>
                    <span class="checkout-badge-req">Requerido</span>
                  </label>
                  <input id="np-name" type="text" required autocomplete="off" maxlength="100" placeholder="Nombre del cliente">
                </div>

                <label id="np-takeaway-wrap" class="checkout-option pos-np-check-row">
                  <input id="np-takeaway" type="checkbox">
                  <span>Para llevar (táper)</span>
                </label>

                <div id="np-tapers-wrap" class="checkout-tapers" hidden>
                  <div class="checkout-tapers-info">
                    <label for="np-tapers">Táperes</label>
                    <span>S/ 1.00 c/u</span>
                  </div>
                  <div class="checkout-taper-stepper">
                    <button type="button" data-np-taper-step="-1" aria-label="Reducir táperes">−</button>
                    <input id="np-tapers" type="number" min="0" max="99" step="1" value="0" inputmode="numeric">
                    <button type="button" data-np-taper-step="1" aria-label="Aumentar táperes">+</button>
                  </div>
                </div>

                <div id="np-recojo-box" class="checkout-recojo-card" hidden>
                  <div class="checkout-recojo-head">
                    <i data-lucide="shopping-bag" aria-hidden="true"></i>
                    <div>
                      <p class="checkout-recojo-title">Para llevar · Recoger en local</p>
                      <p class="checkout-recojo-sub">No requiere dirección. Se cobra al recoger o al aprobar.</p>
                    </div>
                  </div>
                  <div class="pos-np-field">
                    <label for="np-pickup-phone"><span>Teléfono o WhatsApp</span><span class="checkout-badge-opt">Opcional</span></label>
                    <input id="np-pickup-phone" type="tel" inputmode="tel" maxlength="40" placeholder="Para avisar cuando esté listo">
                  </div>
                </div>

                <div id="np-delivery-box" class="pos-np-delivery-box" hidden>
                  <div class="checkout-delivery-head">
                    <i data-lucide="bike" aria-hidden="true"></i>
                    <span>Datos de Delivery y pago previo</span>
                  </div>
                  <div class="pos-np-field">
                    <label for="np-phone"><span>Teléfono o WhatsApp</span><span class="checkout-badge-req">Requerido</span></label>
                    <input id="np-phone" type="tel" inputmode="tel" maxlength="40" placeholder="Ej. 958 123 456">
                  </div>
                  <div class="checkout-field checkout-location-field">
                    <div class="checkout-location-head">
                      <span>Ubicación de entrega</span>
                      <span class="checkout-badge-req">Requerido</span>
                    </div>
                    <div class="checkout-location-modes pos-np-loc-modes" role="group" aria-label="Método para indicar ubicación">
                      <button type="button" id="np-btn-loc-gps" data-np-loc-mode="gps" class="checkout-loc-btn" aria-pressed="false">
                        <i data-lucide="locate-fixed" aria-hidden="true"></i>
                        <span>Ubicación GPS</span>
                      </button>
                      <button type="button" id="np-btn-loc-manual" data-np-loc-mode="manual" class="checkout-loc-btn" aria-pressed="false">
                        <i data-lucide="map-pin" aria-hidden="true"></i>
                        <span>Dirección manual</span>
                      </button>
                    </div>
                    <div id="np-loc-gps-panel" class="checkout-loc-panel" hidden>
                      <div id="np-gps-status" class="checkout-gps-status" role="status" aria-live="polite">
                        <span id="np-gps-text">Comparte tu ubicación GPS o ingrésala manualmente.</span>
                        <button type="button" id="np-btn-gps-retry" class="checkout-gps-action">Obtener GPS</button>
                      </div>
                      <a id="np-gps-preview" href="#" target="_blank" rel="noopener noreferrer" class="checkout-gps-link" hidden>
                        <i data-lucide="external-link" aria-hidden="true"></i>
                        <span>Ver en Google Maps</span>
                      </a>
                      <div class="pos-np-field">
                        <label for="np-address-ref"><span>Referencia adicional</span><span class="checkout-badge-opt">Opcional</span></label>
                        <input id="np-address-ref" type="text" maxlength="120" placeholder="Ej. Portón negro, piso 2">
                      </div>
                    </div>
                    <div id="np-loc-manual-panel" class="checkout-loc-panel" hidden>
                      <div class="pos-np-field">
                        <label for="np-address"><span>Dirección exacta</span><span class="checkout-badge-req">Requerido</span></label>
                        <input id="np-address" type="text" maxlength="240" placeholder="Calle, número, distrito y referencia">
                      </div>
                    </div>
                  </div>
                  <fieldset class="checkout-payment">
                    <legend>Método de pago previo</legend>
                    <div class="checkout-methods">
                      <button type="button" data-np-del-pay="Yape" class="del-pay-btn" aria-pressed="true">Yape</button>
                      <button type="button" data-np-del-pay="Plin" class="del-pay-btn" aria-pressed="false">Plin</button>
                      <button type="button" data-np-del-pay="Tarjeta" class="del-pay-btn" aria-pressed="false">Tarjeta <span>+5 %</span></button>
                    </div>
                    <div class="pos-np-field">
                      <label for="np-pay-ref"><span>N° de operación o código</span><span class="checkout-badge-req">Requerido</span></label>
                      <input id="np-pay-ref" type="text" maxlength="80" autocomplete="off" placeholder="Ej. 123456">
                    </div>
                  </fieldset>
                </div>

                <div class="pos-np-field">
                  <label for="np-order-note"><span>Observaciones</span><span class="checkout-badge-opt">Opcional</span></label>
                  <input id="np-order-note" type="text" maxlength="350" placeholder="Ej. Cremas aparte">
                </div>
              </div>
            </div>

            <footer class="pos-np-cart-foot">
              <dl id="np-order-breakdown" class="pos-np-breakdown" hidden>
                <div><dt>Productos</dt><dd id="np-subtotal">S/ 0.00</dd></div>
                <div id="np-taper-charge" hidden><dt>Táperes</dt><dd>S/ 0.00</dd></div>
                <div id="np-card-charge" hidden><dt>Recargo tarjeta (5 %)</dt><dd>S/ 0.00</dd></div>
              </dl>
              <div class="pos-np-total-row">
                <span>Total</span>
                <output id="np-cart-total">S/ 0.00</output>
              </div>
              <p id="np-checkout-error" class="pos-np-checkout-error" role="alert"></p>
              <button type="submit" id="np-submit-order" class="pos-btn pos-btn-primary pos-btn-lg pos-np-submit-btn" disabled>
                <i data-lucide="check-circle-2" aria-hidden="true"></i>
                <span id="np-submit-label">Confirmar pedido</span>
              </button>
            </footer>
          </form>
        </aside>
      </div>

      <div id="np-mobile-bar" class="pos-np-mobile-bar" hidden>
        <div class="pos-np-mobile-bar-copy">
          <strong id="np-mobile-count">0 productos</strong>
          <span id="np-mobile-total">S/ 0.00</span>
        </div>
        <button type="button" id="np-open-cart-drawer" class="pos-btn pos-btn-primary pos-btn-sm">
          <i data-lucide="shopping-bag" aria-hidden="true"></i><span>Ver pedido</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the single-row/wrapping category pills synchronized to activeCategory.
 */
export function renderNuevoPedidoCategoryTabsHtml(activeCategory = 'Todos') {
  return NP_CATEGORIES.map(cat => `
    <button type="button" data-np-cat="${escapeHtml(cat.id)}" class="pos-np-cat-btn" aria-pressed="${activeCategory === cat.id}">${escapeHtml(cat.label)}</button>
  `).join('');
}

/**
 * Renders operational light POS product cards without photos or dark Carta styling.
 */
export function renderNuevoPedidoProductsHtml(items) {
  if (!items.length) {
    return `
      <div class="pos-empty-state pos-np-empty-catalog">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="search-x"></i></span>
        <h3>Sin coincidencias en el catálogo</h3>
        <p>Prueba otra palabra clave o cambia la categoría seleccionada.</p>
      </div>
    `;
  }

  return items.map(item => `
    <article class="pos-np-card">
      <div class="pos-np-card-top">
        <h3 class="pos-np-card-title">${escapeHtml(item.name)}</h3>
        <span class="pos-station-chip" data-station="${escapeHtml(item.station)}">${item.station === 'BARRA' ? 'Barra' : 'Cocina'}</span>
      </div>
      ${item.desc ? `
        <details class="pos-np-details">
          <summary>Ver ingredientes</summary>
          <p>${escapeHtml(item.desc)}</p>
        </details>
      ` : ''}
      <div class="pos-np-card-foot">
        <strong class="pos-np-card-price">${money(item.price)}</strong>
        <button type="button" data-open-cust="${escapeHtml(item.id)}" class="pos-btn pos-btn-primary pos-btn-sm">
          <i data-lucide="plus" aria-hidden="true"></i><span>Agregar</span>
        </button>
      </div>
    </article>
  `).join('');
}

/**
 * Renders cart lines inside Nuevo pedido with customization edit triggers and quantity steppers.
 */
export function renderNuevoPedidoCartItemsHtml(cart) {
  if (!cart || cart.length === 0) {
    return `
      <div class="pos-np-cart-empty">
        <span class="pos-empty-icon" aria-hidden="true"><i data-lucide="shopping-bag"></i></span>
        <h3>Pedido vacío</h3>
        <p>Selecciona productos del catálogo para agregarlos y confirmar la orden.</p>
      </div>
    `;
  }

  return cart.map((item, idx) => {
    const safeName = escapeHtml(item.name);
    const mods = [
      item.flavors?.length ? `Sabores: ${item.flavors.join(', ')}` : '',
      item.extras?.length ? `Extras: ${item.extras.map(e => e.name).join(', ')}` : '',
      item.note || ''
    ].filter(Boolean);

    return `
      <div class="pos-np-cart-item">
        <div class="pos-np-cart-item-head">
          <div class="pos-np-cart-item-titlewrap">
            <strong>${safeName}</strong>
            ${item.qty > 1 ? `<span class="pos-np-cart-unit">${money(item.unitPrice)} c/u</span>` : ''}
          </div>
          <strong class="pos-np-cart-line-total">${money(item.qty * item.unitPrice)}</strong>
        </div>
        ${mods.length ? `<p class="pos-np-cart-mods">${escapeHtml(mods.join(' · '))}</p>` : ''}
        <div class="pos-np-cart-item-controls">
          <div class="checkout-stepper pos-np-stepper" role="group" aria-label="Cantidad de ${safeName}">
            <button type="button" data-cc-dec="${idx}" aria-label="Reducir cantidad de ${safeName}">−</button>
            <span class="checkout-qty-num">${item.qty}</span>
            <button type="button" data-cc-inc="${idx}" aria-label="Aumentar cantidad de ${safeName}">+</button>
          </div>
          <div class="pos-np-cart-item-links">
            <button type="button" data-np-edit-item="${idx}" class="pos-text-link pos-np-edit-link">Editar personalización</button>
            <button type="button" data-cc-del="${idx}" class="pos-np-remove-btn" aria-label="Quitar ${safeName}">Quitar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
