import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  preparationStartedAt,
  parseLimaDateTime,
  formatElapsedMinutesLabel
} from '../public/preparation.js';
import { createPosSounds } from '../public/pos-sounds.js';
import {
  NP_CATEGORIES,
  filterPosProducts,
  renderNuevoPedidoShellHtml,
  renderNuevoPedidoProductsHtml,
  renderNuevoPedidoCartItemsHtml
} from '../public/pos/order-entry.js';
import { MENU } from '../public/catalog.js';

import {
  resolveActiveNavId,
  getRailItems,
  getMobileBottomItems,
  getDesktopSidebarGroups,
  getMoreDrawerGroups,
  getHeaderMeta,
  renderNavBadgeText
} from '../public/pos/shell.js';

import {
  computeDashboardModel,
  renderDashboardHtml,
  renderAdminOrderListHtml,
  renderAdminOrderDetailHtml,
  filterIngredients,
  renderInventoryKpisHtml,
  filterKardexMovements,
  formatElapsedFromOrder
} from '../public/pos/views.js';

import {
  renderSuppliersDirectoryHtml,
  renderPurchasesViewHtml,
  renderCajaMovementsHtml,
  renderBoletasListHtml,
  renderQrTablesGridHtml,
  renderRolesCardsHtml
} from '../public/pos/admin-views.js';

test('navigation shell strictly enforces Admin vs Cocina role permissions without leaking admin modules', () => {
  const adminRail = getRailItems('admin').map(i => i.id);
  assert.deepEqual(adminRail, ['inicio', 'pedidos', 'cocina', 'barra', 'caja']);

  const chefRail = getRailItems('chef').map(i => i.id);
  assert.deepEqual(chefRail, ['inicio', 'cocina', 'barra', 'carta', 'configuracion']);
  assert.ok(!chefRail.includes('pedidos') && !chefRail.includes('caja'));

  const chefBottom = getMobileBottomItems('chef').map(i => i.id);
  assert.deepEqual(chefBottom, ['inicio', 'cocina', 'barra']);

  const chefSidebarIds = getDesktopSidebarGroups('chef').flatMap(g => g.items.map(i => i.id));
  for (const forbidden of ['pedidos', 'nuevo-pedido', 'caja', 'inventario', 'kardex', 'proveedores', 'qr', 'roles']) {
    assert.ok(!chefSidebarIds.includes(forbidden), `chef sidebar must not expose ${forbidden}`);
  }

  const adminMoreIds = getMoreDrawerGroups('admin').flatMap(g => g.items.map(i => i.id));
  assert.ok(adminMoreIds.includes('inventario') && adminMoreIds.includes('qr') && adminMoreIds.includes('roles'));

  assert.equal(resolveActiveNavId({ role: 'admin' }), 'pedidos');
  assert.equal(resolveActiveNavId({ role: 'nuevo-pedido' }), 'nuevo-pedido');
  assert.equal(resolveActiveNavId({ role: 'cliente', staffOrderEntry: true }), 'nuevo-pedido');
  assert.equal(resolveActiveNavId({ role: 'cliente', staffOrderEntry: false }), 'carta');
  assert.equal(resolveActiveNavId({ role: 'chef', prepStation: 'BARRA', prepFilter: 'pending' }), 'barra');
  assert.equal(resolveActiveNavId({ role: 'gestion', gestionSubtab: 'kardex' }), 'kardex');
  assert.equal(resolveActiveNavId({ role: 'qr' }), 'qr');
  assert.equal(renderNavBadgeText('pedidos', { pendingCount: 3 }), '3');
  assert.equal(getHeaderMeta('cocina', { prepFilter: 'ready' }).title, 'Cocina · Terminados');
});

test('dashboard model orders real queue accurately and scopes financial cards strictly to Admin', () => {
  const sampleState = {
    orders: [
      { id: '1', code: 'BB-1', status: 'EN_COCINA', channel: 'MESA', table: 'Mesa 1', customer: 'Ana', total: 20, items: [{ station: 'COCINA', menuId: 'm1', qty: 1 }], approvedAt: '27/11/2026 10:00' },
      { id: '2', code: 'BB-2', status: 'POR_APROBAR', channel: 'DELIVERY', table: '-', customer: 'Luis', total: 35, items: [{ station: 'BARRA', menuId: 'm8', qty: 1 }] },
      { id: '3', code: 'BB-3', status: 'LISTO_CHEF', channel: 'RECOJO', table: 'Para llevar', customer: 'Eva', total: 15, items: [{ station: 'COCINA', menuId: 'm2', qty: 1 }], stationCompletedAt: { COCINA: '2026-11-27T15:00:00Z' } }
    ],
    ingredients: [
      { id: 'i1', code: 'IN-01', name: 'Carne', station: 'COCINA', unit: 'g', stock: -250, minStock: 2000, cost: 0.03 }
    ],
    caja: { opening: 100, movements: [{ type: 'VENTA', method: 'Efectivo', amount: 25 }, { type: 'EGRESO', method: 'Efectivo', amount: -10 }] }
  };

  const adminModel = computeDashboardModel(sampleState, { staffArea: 'admin', activeShift: { status: 'OPEN', expectedCash: 115 } });
  assert.equal(adminModel.pendingCount, 1);
  assert.equal(adminModel.cocinaPending, 1);
  assert.equal(adminModel.barraPending, 0);
  assert.equal(adminModel.readyCount, 1);
  assert.equal(adminModel.lowStockCount, 1);
  assert.equal(adminModel.expectedCash, 115);
  assert.deepEqual(adminModel.activeOrders.map(o => o.status), ['POR_APROBAR', 'LISTO_CHEF', 'EN_COCINA']);

  const adminHtml = renderDashboardHtml(adminModel, { staffArea: 'admin' });
  assert.match(adminHtml, /Caja del día/);
  assert.match(adminHtml, /Alertas de inventario/);

  const chefModel = computeDashboardModel(sampleState, { staffArea: 'chef' });
  const chefHtml = renderDashboardHtml(chefModel, { staffArea: 'chef' });
  assert.ok(!chefHtml.includes('Caja del día'));
  assert.ok(!chefHtml.includes('Alertas de inventario'));
  assert.ok(!chefHtml.includes('Por aprobar'));
});

test('inventory KPI preserves negative valuation S/ -35.60 with semantic error styling (never green) and filters work', () => {
  const prodLikeIngredients = [
    { id: 'ing_carne', code: 'IN-01', name: 'Carne Asado de Tira', station: 'COCINA', unit: 'g', stock: -250, minStock: 2000, cost: 0.03 },
    { id: 'ing_pan', code: 'IN-02', name: 'Pan Brioche', station: 'COCINA', unit: 'und', stock: -1, minStock: 15, cost: 1.5 },
    { id: 'ing_papas', code: 'IN-03', name: 'Papas Nativas', station: 'COCINA', unit: 'porc', stock: -3, minStock: 18, cost: 2.2 },
    { id: 'ing_alitas', code: 'IN-04', name: 'Alitas de Pollo', station: 'COCINA', unit: 'und', stock: -6, minStock: 36, cost: 1.1 },
    { id: 'ing_salchicha', code: 'IN-05', name: 'Salchicha Ahumada', station: 'COCINA', unit: 'porc', stock: -1, minStock: 12, cost: 2.8 },
    { id: 'ing_cheddar', code: 'IN-06', name: 'Queso Cheddar', station: 'COCINA', unit: 'und', stock: -5, minStock: 15, cost: 1.2 },
    { id: 'ing_tocino', code: 'IN-07', name: 'Tocino Ahumado', station: 'COCINA', unit: 'porc', stock: -2, minStock: 10, cost: 2.0 },
    { id: 'ing_huevo', code: 'IN-08', name: 'Huevo', station: 'COCINA', unit: 'und', stock: -1, minStock: 12, cost: 0.6 },
    { id: 'ing_gaseosa', code: 'IN-10', name: 'Gaseosas / Agua', station: 'BARRA', unit: 'bot', stock: 0, minStock: 18, cost: 2.3 }
  ];

  const kpiHtml = renderInventoryKpisHtml(prodLikeIngredients);
  assert.match(kpiHtml, /S\/\s*-35\.60/);
  assert.match(kpiHtml, /data-tone="error"/);
  assert.match(kpiHtml, /data-negative="true"/);
  assert.ok(!kpiHtml.includes('text-emerald-600'));

  assert.equal(filterIngredients(prodLikeIngredients, { station: 'BARRA' }).length, 1);
  assert.equal(filterIngredients(prodLikeIngredients, { status: 'faltante' }).length, 8);
  assert.equal(filterIngredients(prodLikeIngredients, { status: 'bajo' }).length, 1);
  assert.equal(filterIngredients(prodLikeIngredients, { search: 'cheddar' }).length, 1);
  const withOptimo = [...prodLikeIngredients, { id: 'ing_extra', code: 'IN-99', name: 'Agua Mineral', station: 'BARRA', unit: 'bot', stock: 30, minStock: 18, cost: 2.0 }];
  assert.equal(filterIngredients(withOptimo, { status: 'optimo' }).length, 1);
});

test('kardex filters and master-detail + QR grid + roles render safely without XSS or mixed channels', () => {
  const kardex = [
    { date: '27/11/26, 11:27 a. m.', ingId: 'ing_huevo', ingName: 'Huevo', type: 'SALIDA', doc: 'Aprobación BB-3F76', prev: 0, qty: -1, next: -1, unit: 'und' },
    { date: '2026-11-26 14:12', ingId: 'ing_gaseosa', ingName: 'Gaseosas', type: 'ENTRADA', doc: 'Compra F001', prev: 10, qty: 20, next: 30, unit: 'bot' }
  ];
  const ings = [
    { id: 'ing_huevo', station: 'COCINA' },
    { id: 'ing_gaseosa', station: 'BARRA' }
  ];
  assert.equal(filterKardexMovements(kardex, ings, { station: 'BARRA' }).length, 1);
  assert.equal(filterKardexMovements(kardex, ings, { date: '2026-11-27' }).length, 1);
  assert.equal(filterKardexMovements(kardex, ings, { type: 'SALIDA' }).length, 1);

  const listHtml = renderAdminOrderListHtml([
    { id: 'o1', code: 'BB-1', channel: 'MESA', table: 'Mesa 2', customer: '<script>x</script>', status: 'POR_APROBAR', total: 20, createdIso: new Date(Date.now() - 180000).toISOString() }
  ], 'o1');
  assert.ok(!listHtml.includes('<script>'));
  assert.match(listHtml, /&lt;script&gt;x&lt;\/script&gt;/);

  const detailHtml = renderAdminOrderDetailHtml(
    { id: 'o1', code: 'BB-1', channel: 'MESA', table: 'Mesa 2', customer: 'Carlos', status: 'POR_APROBAR', paymentStatus: 'PENDIENTE', total: 20, items: [{ name: 'Burger', qty: 1, unitPrice: 20, station: 'COCINA' }] },
    { canEdit: true, canCancel: true, stationLabelFn: s => s, stationReadyFn: () => false, orderStationsFn: () => ['COCINA'] }
  );
  assert.match(detailHtml, /Aprobar e imprimir/);
  assert.match(detailHtml, /Cancelar pedido/);

  const qrHtml = renderQrTablesGridHtml({ baseUrl: 'https://theburgersbrother.com', makeQrSvgFn: p => `<svg data-qr="${p}"></svg>` });
  for (let n = 1; n <= 6; n++) {
    assert.ok(qrHtml.includes(`https://theburgersbrother.com#mesa=${n}`));
  }
  assert.ok(qrHtml.includes('https://theburgersbrother.com#delivery=1'));

  const rolesHtml = renderRolesCardsHtml();
  assert.match(rolesHtml, /Admin · Nicol/);
  assert.match(rolesHtml, /Cocina/);
  assert.match(rolesHtml, /Cliente/);
  assert.match(renderSuppliersDirectoryHtml([]).tableHtml, /Nuevo proveedor/);
  assert.match(renderPurchasesViewHtml([]).tableHtml, /Registrar compra/);
  assert.match(renderCajaMovementsHtml([]).tableHtml, /Sin movimientos/);
  assert.match(renderBoletasListHtml([]), /Sin boletas internas/);
  assert.equal(formatElapsedFromOrder({ approvedAt: '27/11/2026 10:00' }, Date.parse('2026-11-27T10:15:00-05:00')), '15 min');
});

test('public QR Carta defaults and strict App Shell isolation remain preserved in index.html and brand.css', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/brand.css', import.meta.url), 'utf8');
  assert.match(html, /<body data-public-menu/);
  assert.match(css, /body:not\(\[data-staff-shell\]\)\s*\.pos-shell-chrome\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(html, /id="business-closed-modal"/);
  assert.match(html, /id="client-tracker-modal"/);
  assert.match(html, /id="carta-mobile-nav"/);
  assert.match(html, /id="modal-confirm"/);
});

test('order elapsed timers parse es-PE 12h/24h Lima timestamps accurately and emit live timer attributes', () => {
  assert.equal(parseLimaDateTime('27/11/26, 1:30 p. m.'), Date.parse('2026-11-27T13:30:00-05:00'));
  assert.equal(parseLimaDateTime('27/11/26, 12:15 p. m.'), Date.parse('2026-11-27T12:15:00-05:00'));
  assert.equal(parseLimaDateTime('27/11/26, 12:15 a. m.'), Date.parse('2026-11-27T00:15:00-05:00'));
  assert.equal(parseLimaDateTime('24/11/2026 18:56'), Date.parse('2026-11-24T18:56:00-05:00'));

  const nowMs = Date.parse('2026-11-27T17:05:00-05:00');
  assert.equal(preparationStartedAt({ approvedAt: '27/11/26, 4:45 p. m.' }), Date.parse('2026-11-27T16:45:00-05:00'));
  assert.equal(formatElapsedFromOrder({ createdAt: '27/11/26, 4:50 p. m.' }, nowMs), '15 min');
  assert.equal(formatElapsedMinutesLabel(Date.parse('2026-11-27T17:04:30-05:00'), nowMs), '< 1 min');

  const dashHtml = renderDashboardHtml({
    pendingCount: 1,
    cocinaPending: 0,
    barraPending: 0,
    readyCount: 0,
    lowStockCount: 0,
    expectedCash: 0,
    shiftOpen: true,
    activeOrders: [{ id: 'o1', code: 'BB-1', channel: 'MESA', table: 'Mesa 1', customer: 'Ana', status: 'POR_APROBAR', total: 14, createdIso: '2026-11-27T21:55:00.000Z' }],
    nowMs
  }, { staffArea: 'admin' });
  assert.match(dashHtml, /data-order-elapsed-ref="\d+"/);
  assert.match(dashHtml, /10 min/);

  const routeSrc = readFileSync(new URL('../functions/api/[[route]].js', import.meta.url), 'utf8');
  assert.match(routeSrc, /serverTimeIso:\s*clock\.iso/);

  // Ensure transitive ES module imports carry matching cache-busting query versions
  const viewsSrc = readFileSync(new URL('../public/pos/views.js', import.meta.url), 'utf8');
  const adminViewsSrc = readFileSync(new URL('../public/pos/admin-views.js', import.meta.url), 'utf8');
  const htmlSrc = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const htmlPrepTag = /from '\.\/preparation\.js\?v=([^']+)'/.exec(htmlSrc)?.[1];
  const htmlViewsTag = /from '\.\/pos\/views\.js\?v=([^']+)'/.exec(htmlSrc)?.[1];
  const orderEntrySrc = readFileSync(new URL('../public/pos/order-entry.js', import.meta.url), 'utf8');
  assert.ok(htmlPrepTag && htmlViewsTag);
  assert.equal(/from '\.\.\/preparation\.js\?v=([^']+)'/.exec(viewsSrc)?.[1], htmlPrepTag);
  assert.equal(/from '\.\/views\.js\?v=([^']+)'/.exec(adminViewsSrc)?.[1], htmlViewsTag);
  assert.equal(/from '\.\/views\.js\?v=([^']+)'/.exec(orderEntrySrc)?.[1], htmlViewsTag);
});

test('Nuevo pedido dedicated Split View isolates light POS presentation, single category source, and cart states', () => {
  const activeMenuCats = new Set(MENU.filter(m => !m.retired).map(m => m.cat));
  for (const cat of activeMenuCats) {
    assert.ok(NP_CATEGORIES.some(c => c.id === cat), `missing NP_CATEGORIES entry for ${cat}`);
  }
  const burgers = filterPosProducts(MENU, { category: 'Hamburguesas', search: 'royal' });
  assert.equal(burgers.length, 1);
  assert.equal(burgers[0].name, 'Burger Royal');

  const shellHtml = renderNuevoPedidoShellHtml({ mode: 'MESA', mesa: 'Mesa 4', category: 'Hamburguesas' });
  assert.match(shellHtml, /pos-np-split/);
  assert.match(shellHtml, /np-open-pdf-btn/);
  assert.match(shellHtml, /id="np-category-select"/);
  assert.match(shellHtml, /id="np-submit-order"[^>]*disabled/);
  assert.ok(!shellHtml.includes('Ver QR de mesas'));
  assert.ok(!shellHtml.includes('Volver a Pedidos'));
  assert.ok(!shellHtml.includes('carta-sidebar'));

  const cardsHtml = renderNuevoPedidoProductsHtml(burgers);
  assert.match(cardsHtml, /Burger Royal/);
  assert.match(cardsHtml, /Ver ingredientes/);
  assert.match(cardsHtml, /data-open-cust="m4"/);

  const emptyCartHtml = renderNuevoPedidoCartItemsHtml([]);
  assert.match(emptyCartHtml, /Pedido vacío/);

  const filledCartHtml = renderNuevoPedidoCartItemsHtml([
    { menuId: 'm1', name: 'Burger Classic', qty: 2, unitPrice: 18, flavors: [], extras: [{ name: 'Huevo' }], note: 'Cremas: Mayonesa' }
  ]);
  assert.match(filledCartHtml, /Editar personalización/);
  assert.match(filledCartHtml, /S\/ 36\.00/);

  const htmlSrc = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(htmlSrc, /function syncDeliveryGpsViews\(\)\s*\{\s*syncDeliveryLocationUI\(\);\s*syncNpDeliveryLocationUI\(\);/s);
});

test('staff login uses Phosphor icons, two-line accessible profile selector, and zero yellow top stripe', () => {
  const loginHtml = readFileSync(new URL('../public/personal/index.html', import.meta.url), 'utf8');
  const loginJs = readFileSync(new URL('../public/personal/login.js', import.meta.url), 'utf8');
  const phosphorSrc = readFileSync(new URL('../public/personal/phosphor-icons.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/brand.css', import.meta.url), 'utf8');

  assert.match(loginHtml, /Acceso al POS/);
  assert.match(loginHtml, /Perfil de acceso/);
  assert.match(loginHtml, /Clave de acceso/);
  assert.match(loginHtml, /placeholder="Ingresa tu clave"/);
  assert.match(loginHtml, /Volver a la carta digital/);
  assert.match(loginHtml, /logo-burgers-brother\.webp"\s+width="88"\s+height="88"/);
  assert.ok(!loginHtml.includes('lucide') && !loginJs.includes('lucide'));

  for (const iconName of [
    'identification-badge-duotone',
    'chef-hat-duotone',
    'lock-simple',
    'eye',
    'eye-slash',
    'caret-down',
    'sign-in',
    'arrow-left',
    'warning-circle',
    'spinner-gap'
  ]) {
    assert.ok(phosphorSrc.includes(`"${iconName}"`), `missing Phosphor icon ${iconName}`);
  }
  assert.match(loginJs, /Administración/);
  assert.match(loginJs, /Cocina/);
  assert.match(loginJs, /Nicol/);
  assert.ok(!loginJs.includes('Administración · Nicol'));
  assert.ok(!css.match(/\.staff-login-card\s*\{[^}]*border-top\s*:/s));
});

test('system sound defaults to enabled, persists mute override cleanly, and handles AudioContext states safely', async () => {
  const htmlSrc = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(htmlSrc, /SOUND_PREF_KEY\s*=\s*'pos-sound-enabled'/);
  assert.match(htmlSrc, /localStorage\.getItem\(SOUND_PREF_KEY\)\s*!==\s*'0'/);
  assert.match(htmlSrc, /from '\.\/pos-sounds\.js\?v=/);

  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    async resume() { this.state = 'running'; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return {}; } }; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {} }; }
  }
  const sounds = createPosSounds({
    Audio: MockAudioContext,
    fetchAudio: async () => ({ ok: false })
  });
  assert.equal(sounds.isRunning(), false);
  assert.equal(await sounds.enable(), true);
  assert.equal(sounds.isRunning(), true);
  assert.equal(sounds.play('action-success', 1), true);
  sounds.mute();
  assert.equal(sounds.isRunning(), false);
});
