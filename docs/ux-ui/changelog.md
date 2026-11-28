# Changelog — Rediseño UX/UI POS V2.0 (The Burgers Brother)

Fecha: `2026-11-27`

---

## [2.2.0] — Rediseño Pantalla de Inicio de Sesión (`/personal/`)

### Cambiado
- **Tarjeta centrada minimalista (`public/personal/index.html`, `public/brand.css`):** diseño `<= 440px`, borde uniforme `1px solid #DDCFBE` sin franja amarilla superior ni gradientes decorativos, fondo `#F3EDE3` y superficie `#FFFBF5` con tipografía `Inter`.
- **Encabezado horizontal con logotipo original (`88×88px`):** logotipo circular intacto, separador vertical fino, marca `THE BURGERS BROTHER` y título `Acceso al POS`.
- **Selector de perfil personalizado accesible y campo de contraseña (`public/personal/login.js`, `public/personal/phosphor-icons.js`):** selector con teclado/ARIA completo (`Administración` / `Nicol` con `IdentificationBadge` Duotone y `Cocina` con `ChefHat` Duotone), campo `56px` con `LockSimple` + conmutador de visibilidad `Eye`/`EyeSlash`, botón principal `Iniciar sesión` (`56px`, `#E5B260`) con estado `SpinnerGap` sin cambio de tamaño y enlace secundario `Volver a la carta digital` (`ArrowLeft`), utilizando exclusivamente Phosphor Icons generados desde `@phosphor-icons/core` vía `scripts/build-assets.mjs`.

---

## [2.1.0] — Separación Operativa POS Split View en Módulo Nuevo pedido

### Cambiado
- **Vista dedicada `#view-nuevo-pedido` ([public/pos/order-entry.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/order-entry.js)):** se separó por completo la interfaz de **Nuevo pedido** respecto a la Carta pública (`#view-cliente`), eliminando el fondo oscuro heredado, el sidebar interno duplicado, el encabezado secundario `"La carta"`, `"Volver a Pedidos"` y `"Ver QR de mesas"`.
- **Layout Split View `~62% / 38%` a ancho completo:** sin límites artificiales de `max-width` y con altura ajustada al viewport (`calc(100dvh - 86px)` en `>= 1024px`) para scroll independiente entre catálogo y carrito persistente.
- **Categorización única sincronizada (`NP_CATEGORIES`):** única fuente de verdad entre pestañas en tablet/escritorio, selector `<select>` en móvil (`< 768px`) y búsqueda en vivo, sin barras de desplazamiento horizontal.
- **Tarjetas claras y carrito operativo completo:** tarjetas claras `POS V2.0` con acordeón accesible `Ver ingredientes`, personalización en `#modal-customize` y opción `Editar personalización` sobre líneas existentes del carrito, estilos claros unificados para `En mesa` (táperes), `Para llevar` y `Delivery` (incluyendo sincronización en vivo de ubicación GPS y resaltado de validación), preservación de modalidad y carrito al previsualizar `Ver carta PDF`, subtotal/total/botón `Confirmar pedido` fijos al pie (deshabilitado si el carrito está vacío), y soporte responsivo completo en `390×844` hasta `1920×1080`.
- **Sincronización horaria y sonido por defecto:** `serverTimeIso` en endpoints de estado, `parseLimaDateTime` para formato 12 h/24 h en `America/Lima`, actualización en vivo cada `10 s` en Dashboard/Pedidos/KDS y sonido habilitado por defecto con persistencia en navegador.

---

## [2.0.0] — Rediseño Integral POS Tablet First, Touch First y Responsive

### Añadido
- **Sistema de diseño `POS V2.0`** en [public/brand.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/brand.css) y [docs/ux-ui/design-system.md](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/docs/ux-ui/design-system.md): tokens cálidos propios de marca validados para contraste WCAG AA (`--pos-warning-ink: #755118`, `--pos-error-ink: #8E3726`, `--pos-text-secondary: #725941`), escala tipográfica operativa con `tabular-nums`, radios `6–16px` y áreas táctiles mínimas `>= 48px`.
- **App Shell unificado (`POSAppShell`)** en [public/pos/shell.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/shell.js) y [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html):
  - `NavigationRail` (`88px`) para tablets `768–1365px`.
  - `DesktopSidebar` colapsable (`236px` / `76px`, persistente en `localStorage`) para `>= 1366px`.
  - `MobileBottomNavigation` fija en teléfonos `< 768px`.
  - `POSHeader` compacto (`60px`) con título contextual, fecha en `America/Lima`, indicador interactivo de sonido (`#header-sound-toggle`) y menú de cuenta con perfil y cierre de sesión.
  - `MoreModulesDrawer` contextual (`#pos-more-drawer`) agrupado por `Operaciones`, `Administración` y `Sistema`.
- **Módulo de vistas operativas** en [public/pos/views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/views.js):
  - Dashboard operativo en vivo (`computeDashboardModel`, `renderDashboardHtml`) con KPIs clicables, tabla/lista móvil de pedidos activos, alertas de inventario y Caja del día restringida a `Admin`.
  - Vista **Pedidos** en arquitectura **Master-Detail** (`renderAdminOrderListHtml`, `renderAdminOrderDetailHtml`) con buscador en tiempo real por código/cliente/mesa y navegación móvil lista ↔ detalle.
  - Filtros combinados en **Inventario** (estación + estado `Faltante`/`Stock bajo`/`Óptimo`) y **Kardex** (estación + tipo + fecha normalizada), con tarjetas expandibles `<details>` en móvil `< 768px`.
- **Módulo Back Office y Sistema** en [public/pos/admin-views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/admin-views.js):
  - Pestañas separadas en **Proveedores** (`Directorio` / `Compras al Kardex`) con estados vacíos accionables.
  - Tres subvistas ordenadas en **Caja y Boletas** (`Caja actual`, `Boletas emitidas`, `Reportes`) con listas móviles responsivas sin tablas recortadas.
  - Módulo independiente **`#qr` (`Códigos QR`)** con tarjetas para Mesas `1–6` y tarjeta destacada para enlace Delivery (`#delivery=1`).
  - Vistas dedicadas **`#configuracion`** y **`#roles`** (solo lectura) integradas al shell sin depender de diálogos pequeños encadenados.
- **Modo concentración en KDS (`Cocina` / `Barra`)**: interruptor rápido en barra superior, banner compacto y ocultación del cromo administrativo durante pantalla completa.
- **Diálogo de confirmación accesible (`dialog#modal-confirm` / `confirmPosAction`)** reemplazando el uso de `window.confirm()` en acciones destructivas o críticas.
- **Cobertura de pruebas automatizadas UI** en [tests/pos-v2-ui.test.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/tests/pos-v2-ui.test.js) y suite visual completa documentada en `docs/ux-ui/`.

### Cambiado
- **Nuevo pedido (`#nuevo-pedido`)** ahora abre por defecto el catálogo táctil `Explorar` en diseño **Split View** (desktop/tablet `>= 1024px`) o barra resumen inferior + drawer de carrito (tablet vertical/móvil `< 1024px`), eliminando el hero comercial `#staff-menu-hero` y el botón duplicado `Pedido (0)`.
- **Carta administrativa (`#carta-admin`)** elimina `#staff-menu-hero` y ajusta el ancho de `.carta-desktop-shell` (`196px`) en tablet horizontal únicamente para uso de personal.
- **Inventario KPI (`Valor del almacén`)**: corregido bug visual donde valores negativos (`S/ -35.60`) aparecían en verde (`text-emerald-600`); ahora muestra estado error (`--pos-error`) y pill `Déficit real`.
- **Kardex**: normalización homogénea de fechas ISO/legadas (`normalizeKardexDate`) al formato legible en español `dd/mm/yy HH:mm`.
- **Navigation Rail**: etiqueta abreviada `Ajustes` para `Configuración` en `88px` evitando cercanía a bordes, y etiquetas `+` sin duplicación en botones `Nuevo pedido`.

### Preservado sin Modificaciones
- **Carta pública QR / Delivery / Para llevar (`body[data-public-menu]`)** y PDF original (`public/carta/*`): sin alteraciones de diseño, precios, imágenes, logotipos, hotspots ni reglas de carrito/ubicación.
- **Contratos API, esquema D1 y lógica de negocio (`functions/`, `migrations/`)**: 100% intactos; las 8 pruebas de regresión originales continúan pasando junto a las 5 pruebas nuevas (`13/13` total).
