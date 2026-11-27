/**
 * Pure presentation and permission-aware navigation model for POSAppShell.
 * Shared by Tablet NavigationRail, Desktop Sidebar, MobileBottomNavigation, POSHeader, and MoreModulesDrawer.
 */

export const POS_ROUTES = {
  inicio: { id: 'inicio', label: 'Inicio', title: 'Panel de control', subtitle: 'Operación en vivo', hash: '#modulos', icon: 'home', scopes: ['admin', 'chef'], roles: ['modulos'] },
  pedidos: { id: 'pedidos', label: 'Pedidos', title: 'Pedidos', subtitle: 'Aprobar, cobrar y despachar', hash: '#admin', icon: 'clipboard-list', scopes: ['admin'], roles: ['admin'] },
  nuevoPedido: { id: 'nuevo-pedido', label: 'Nuevo pedido', title: 'Nuevo pedido', subtitle: 'Toma de pedido en mostrador', hash: '#nuevo-pedido', icon: 'plus-circle', scopes: ['admin'], roles: ['nuevo-pedido'] },
  cocina: { id: 'cocina', label: 'Cocina', title: 'Cocina · Preparación', subtitle: 'Plancha, burgers y combos', hash: '#estacion=cocina', icon: 'cooking-pot', scopes: ['admin', 'chef'], roles: ['chef'], station: 'COCINA' },
  barra: { id: 'barra', label: 'Barra', title: 'Barra · Preparación', subtitle: 'Bebidas, jugos y cócteles', hash: '#estacion=barra', icon: 'cup-soda', scopes: ['admin', 'chef'], roles: ['chef'], station: 'BARRA' },
  terminados: { id: 'terminados', label: 'Terminados', title: 'Comandas terminadas', subtitle: 'Historial de preparación', hash: '#chef', icon: 'check-circle-2', scopes: ['chef'], roles: ['chef'], prepFilter: 'ready' },
  carta: { id: 'carta', label: 'Carta', title: 'Carta administrativa', subtitle: 'PDF original y precios', hash: '#carta-admin', icon: 'book-open', scopes: ['admin', 'chef'], roles: ['carta-admin'] },
  inventario: { id: 'inventario', label: 'Inventario', title: 'Inventario', subtitle: 'Insumos y recetas', hash: '#gestion=inventario', icon: 'package', scopes: ['admin'], roles: ['gestion'], subtab: 'inventario' },
  kardex: { id: 'kardex', label: 'Kardex', title: 'Kardex', subtitle: 'Movimientos y trazabilidad', hash: '#gestion=kardex', icon: 'list-restart', scopes: ['admin'], roles: ['gestion'], subtab: 'kardex' },
  proveedores: { id: 'proveedores', label: 'Proveedores', title: 'Proveedores', subtitle: 'Directorio e ingresos a Kardex', hash: '#gestion=proveedores', icon: 'truck', scopes: ['admin'], roles: ['gestion'], subtab: 'proveedores' },
  caja: { id: 'caja', label: 'Caja', title: 'Caja y Boletas', subtitle: 'Jornada, boletas internas y reportes', hash: '#gestion=caja', icon: 'wallet', scopes: ['admin'], roles: ['gestion'], subtab: 'caja' },
  qr: { id: 'qr', label: 'Códigos QR', title: 'Códigos QR', subtitle: 'Mesas 1–6 y enlace Delivery', hash: '#qr', icon: 'qr-code', scopes: ['admin'], roles: ['qr'] },
  configuracion: { id: 'configuracion', label: 'Configuración', railLabel: 'Ajustes', title: 'Configuración', subtitle: 'Sonido, seguridad y cuenta', hash: '#configuracion', icon: 'settings', scopes: ['admin', 'chef'], roles: ['configuracion'] },
  roles: { id: 'roles', label: 'Roles', title: 'Roles y accesos', subtitle: 'Permisos de Admin, Cocina y Cliente', hash: '#roles', icon: 'shield-check', scopes: ['admin'], roles: ['roles'] }
};

function hasScope(item, staffArea) {
  return Boolean(item && staffArea && item.scopes.includes(staffArea));
}

/**
 * Resolves the active navigation item ID from current UI routing state.
 */
export function resolveActiveNavId({ role, staffOrderEntry, gestionSubtab, prepStation, prepFilter }) {
  if (role === 'modulos') return 'inicio';
  if (role === 'admin') return 'pedidos';
  if (role === 'cliente') return staffOrderEntry ? 'nuevo-pedido' : 'carta';
  if (role === 'chef') {
    if (prepFilter === 'ready') return prepStation === 'BARRA' ? 'barra' : 'cocina';
    return prepStation === 'BARRA' ? 'barra' : 'cocina';
  }
  if (role === 'gestion') {
    if (['inventario', 'kardex', 'proveedores', 'caja'].includes(gestionSubtab)) return gestionSubtab;
    return 'inventario';
  }
  if (role === 'qr') return 'qr';
  if (role === 'configuracion') return 'configuracion';
  if (role === 'roles') return 'roles';
  return 'inicio';
}

/**
 * Returns primary Tablet NavigationRail items tailored to the authenticated staff role.
 */
export function getRailItems(staffArea) {
  const keys = staffArea === 'admin'
    ? ['inicio', 'pedidos', 'cocina', 'barra', 'caja']
    : ['inicio', 'cocina', 'barra', 'carta', 'configuracion'];
  return keys.map(key => POS_ROUTES[key]).filter(item => hasScope(item, staffArea));
}

/**
 * Returns persistent Phone Bottom Navigation items (3 primary destinations + Más trigger).
 */
export function getMobileBottomItems(staffArea) {
  const keys = staffArea === 'admin'
    ? ['inicio', 'pedidos', 'cocina']
    : ['inicio', 'cocina', 'barra'];
  return keys.map(key => POS_ROUTES[key]).filter(item => hasScope(item, staffArea));
}

/**
 * Returns grouped Desktop Sidebar sections filtered strictly by authenticated scope.
 */
export function getDesktopSidebarGroups(staffArea) {
  const groups = [
    {
      id: 'operacion',
      label: 'Operación',
      items: ['inicio', 'pedidos', 'nuevoPedido', 'cocina', 'barra', 'carta']
    },
    {
      id: 'administracion',
      label: 'Administración',
      items: ['caja', 'inventario', 'kardex', 'proveedores', 'qr']
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: ['configuracion', 'roles']
    }
  ];
  return groups
    .map(group => ({
      ...group,
      items: group.items.map(k => POS_ROUTES[k]).filter(item => hasScope(item, staffArea))
    }))
    .filter(group => group.items.length > 0);
}

/**
 * Returns contextual modules for the "Más" drawer/sheet filtered by role and avoiding duplicate prominence.
 */
export function getMoreDrawerGroups(staffArea, { includeNuevoPedido = true } = {}) {
  const groups = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      items: [
        ...(includeNuevoPedido ? ['nuevoPedido'] : []),
        ...(staffArea === 'chef' ? ['terminados'] : []),
        'barra',
        'carta'
      ]
    },
    {
      id: 'administracion',
      label: 'Administración',
      items: ['caja', 'inventario', 'kardex', 'proveedores', 'qr']
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: ['configuracion', 'roles']
    }
  ];

  // Avoid repeating Barra if already visible in Chef's 3-button rail/bottom nav? Keep accessible in Drawer for discoverability or de-dup per context.
  return groups
    .map(group => ({
      ...group,
      items: group.items.map(k => POS_ROUTES[k]).filter(item => hasScope(item, staffArea))
    }))
    .filter(group => group.items.length > 0);
}

/**
 * Returns Header title and subtitle for the active POS screen.
 */
export function getHeaderMeta(navId, { businessStatus, prepFilter } = {}) {
  const item = Object.values(POS_ROUTES).find(entry => entry.id === navId) || POS_ROUTES.inicio;
  let title = item.title;
  if ((navId === 'cocina' || navId === 'barra') && prepFilter === 'ready') {
    title = `${item.label} · Terminados`;
  }
  const datePart = formatLimaHeaderDate();
  const statusSuffix = businessStatus && !businessStatus.open ? ' · Local cerrado hoy' : '';
  return {
    title,
    contextText: `${datePart}${statusSuffix}`
  };
}

let limaHeaderFmt;
export function formatLimaHeaderDate(now = new Date()) {
  limaHeaderFmt ||= new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });
  const formatted = limaHeaderFmt.format(now);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function renderNavBadgeText(navId, metrics) {
  if (!metrics) return '';
  if (navId === 'pedidos' && metrics.pendingCount > 0) return String(metrics.pendingCount);
  if (navId === 'cocina' && metrics.cocinaPending > 0) return String(metrics.cocinaPending);
  if (navId === 'barra' && metrics.barraPending > 0) return String(metrics.barraPending);
  return '';
}
