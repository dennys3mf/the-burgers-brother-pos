# Arquitectura UX/UI y Técnica — The Burgers Brother POS V2.0

Fecha: `2026-11-27`  
Alcance: Aplicación POS administrativa (`Tablet First · Touch First · Full Responsive`) y preservación aislada de la Carta pública QR / Delivery / Para llevar.

---

## 1. Principio Rector: Aislamiento Estricto Público vs. POS Administrativo

El HTML único en [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html) atiende dos experiencias completamente aisladas mediante atributos en `document.body`:

1. **Experiencia Pública QR / Delivery / Para llevar (`body[data-public-menu]`):**
   - Rutas: `/`, `#mesa=1..6`, `#delivery=1`, `#recojo=1`.
   - Permanece 100% intacta bajo CSS con prefijo `body[data-public-menu]` en [public/brand.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/brand.css) y `body:not([data-staff-shell]) .pos-shell-chrome { display: none !important; }`.
   - Conserva sin modificaciones el PDF original de la carta (`public/carta/*`), hotspots superpuestos, barra inferior móvil (`#carta-mobile-nav`), drawer de categorías (`public/carta-components.js`) y reglas de validación en servidor (`POST /api/orders`).

2. **Experiencia POS V2.0 de Personal (`body[data-staff-shell="true"]`):**
   - Activa únicamente cuando un usuario autenticado (`Admin · Nicol` o `Cocina`) inicia sesión en `/personal/`.
   - Carga el chrome compartido `POSAppShell` definido en [public/pos/shell.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/shell.js) y estilizaje `POS V2.0` en [public/brand.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/brand.css).

---

## 2. Arquitectura Modular Frontend (`public/pos/`)

Se modularizó la capa de presentación sin introducir frameworks ni bundlers JS adicionales:

| Módulo | Responsabilidad principal | Exportaciones verificadas |
| --- | --- | --- |
| [public/pos/shell.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/shell.js) | Definición de rutas POS V2.0, filtrado RBAC por rol (`admin` vs `chef`), Navigation Rail, Bottom Nav, Desktop Sidebar y More Drawer | `POS_ROUTES`, `resolveActiveNavId`, `getRailItems`, `getMobileBottomItems`, `getDesktopSidebarGroups`, `getMoreDrawerGroups`, `getHeaderMeta`, `formatLimaHeaderDate`, `renderNavBadgeText` |
| [public/pos/views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/views.js) | Centro operativo Dashboard, Pedidos Master-Detail, Inventario semántico + filtros y Kardex unificado | `escapeHtml`, `money`, `ORDER_STATUS_META`, `orderOriginText`, `extractMapsUrl`, `stripMapsUrl`, `formatElapsedFromOrder`, `computeDashboardModel`, `renderDashboardHtml`, `renderAdminOrderListHtml`, `renderAdminOrderDetailHtml`, `ingredientStatusMeta`, `filterIngredients`, `renderInventoryKpisHtml`, `renderInventoryRowsAndCards`, `normalizeKardexDate`, `filterKardexMovements`, `renderKardexRowsAndCards` |
| [public/pos/admin-views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/admin-views.js) | Vistas Back Office y Sistema: Proveedores/Compras, Caja/Boletas/Reportes móviles, cuadrícula QR standalone y tarjetas de Roles | `renderSuppliersDirectoryHtml`, `renderPurchasesViewHtml`, `renderCajaMovementsHtml`, `renderBoletasListHtml`, `renderReportsMobileHtml`, `renderQrTablesGridHtml`, `renderRolesCardsHtml` |
| [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html) | Orquestación de estado en memoria, sincronización HTTP (`D1`), modales accesibles (`confirmPosAction`), enrutamiento por hash y enlace de eventos | Mantiene compatibilidad total con `order-pricing.js`, `preparation.js`, `carta-components.js`, `pos-sounds.js`, `bixolon.js`, `receipt-pdf.js` |

---

## 3. Breakpoints y Adaptación del `POSAppShell`

```
< 768 px   (Móvil)            -> Bottom Navigation sticky (Inicio, Pedidos/Cocina, Cocina/Barra, Más)
                                 + Header compacto (56–60px) + MoreModulesDrawer en bottom-sheet
768–1365px (Tablet / Prior.) -> Navigation Rail lateral oscuro (88px) con Más Drawer deslizable
>= 1366 px (Escritorio)      -> Sidebar colapsable (236px expandido / 76px colapsado, persistido en localStorage)
```

- En `<= 1023px`, el carrito de `#view-cliente` (`Nuevo pedido` y `Carta administrativa`) funciona como drawer inferior (`z-index: 65`) sobre backdrop (`z-index: 64`) activado desde `#pos-mobile-cart-bar` únicamente cuando corresponde (`ui.staffOrderEntry || units > 0`).
- En `>= 1024px`, `#nuevo-pedido` muestra la barra contextual superior (`En mesa` / `Para llevar` / `Delivery` + selector de mesa) y un Split View con catálogo `Explorar` a la izquierda y carrito `#client-cart` fijo a la derecha, ocultando por completo el hero comercial (`#staff-menu-hero`) y botones duplicados.

---

## 4. Control de Acceso por Roles (RBAC Frontend + Backend)

| Capacidad | `Admin · Nicol` (`staffArea === 'admin'`) | `Cocina` (`staffArea === 'chef'`) |
| --- | --- | --- |
| Vistas permitidas | `modulos`, `admin`, `chef`, `gestion`, `cliente`, `qr`, `configuracion`, `roles` | `modulos`, `chef`, `cliente` (solo Carta de consulta), `configuracion` |
| Dashboard operativo | 4 KPIs (`Por aprobar`, `En cocina`, `En barra`, `Listos`) + Pedidos activos + Alertas de inventario + Caja del día | 2 KPIs (`En Cocina`, `En Barra`) + Comandas activas + accesos rápidos (`Comandas terminadas`, `Carta de platos`), sin datos financieros ni Caja/Inventario |
| Validación en rutas/API | Cookie HMAC de Administrador; acceso completo a APIs `/api/*` | Cookie HMAC de Cocina; `#admin`, `#gestion`, `#qr` y `#roles` bloqueados en `canOpenPosView` y restringidos en `functions/api/[[route]].js` |

---

## 5. Flujo de Datos sin Cambios en Backend ni Esquema SQL

- **Sin migraciones nuevas ni cambios de contrato:** Se preservan íntegras `migrations/` y `functions/`.
- **Transparencia de datos operativos:** Inventario negativo (`S/ -35.60` histórico o `S/ -16.40` tras prueba local) y tiempos KDS reales (`> 24 h` en comandas heredadas sin marcar listo) se muestran con su valor exacto calculado y semántica de alerta (`data-tone="error"`, etiqueta `Déficit real` o indicador de demora), sin maquillar ni alterar registros existentes.
