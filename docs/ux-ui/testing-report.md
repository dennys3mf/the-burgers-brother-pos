# Reporte de Pruebas y Validación UX/UI — POS V2.0

Fecha: `2026-11-27`  
Entorno probado: Servidor local Cloudflare Pages (`npx wrangler pages dev public --port 8788 --local`) con base D1 local + suite automatizada Node.js (`node --test`).

---

## 1. Suite de Pruebas Automatizadas (`npm test`)

Ejecución posterior a la última edición en [public/brand.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/brand.css), [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html), [public/pos/shell.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/shell.js), [public/pos/views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/views.js) y [public/pos/admin-views.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/pos/admin-views.js):

- **Resultado global:** **13/13 pruebas aprobadas** (`fail: 0`, `cancelled: 0`, `skipped: 0`, duración `348.84 ms`).
- **Regresión Backend/API + Negocio (8 pruebas previas conservadas):**
  - Proyección SQL atómica al editar órdenes fuera del top 50.
  - Inventario grande con proyección selectiva por revisión aceptada.
  - Alcance de validadores staff por endpoint y rol tras autorización.
  - Bloqueo de domingos/días cerrados en pedidos QR sin turnos fantasma.
  - Autocierre de turno a las `00:00 America/Lima` preservando reportes históricos.
  - Migración única desde legado `pos_state` hacia esquema `0005`.
  - Ediciones incrementales, cancelación, unidades `ml`/`MERMA`/`CONTEO`, recetas, proveedores y guardas `409` post-cierre.
  - Validación obligatoria de nombre y ubicación GPS/manual para `Delivery`, frente a nombre obligatorio sin ubicación para `Para llevar (RECOJO)`.
- **Pruebas unitarias de arquitectura POS V2.0 ([tests/pos-v2-ui.test.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/tests/pos-v2-ui.test.js), 5 pruebas nuevas):**
  1. `navigation shell strictly enforces Admin vs Cocina role permissions without leaking admin modules`
  2. `dashboard model orders real queue accurately and scopes financial cards strictly to Admin`
  3. `inventory KPI preserves negative valuation S/ -35.60 with semantic error styling (never green) and filters work`
  4. `kardex filters and master-detail + QR grid + roles render safely without XSS or mixed channels`
  5. `public QR Carta defaults and strict App Shell isolation remain preserved in index.html and brand.css`

---

## 2. Validación de Compilación CSS y Sintaxis JS

| Verificación | Resultado | Detalle observado |
| --- | --- | --- |
| `npm run build:assets` | Aprobado (`exit 0`, `380 ms`) | Regeneración limpia de [public/vendor/tailwind.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/vendor/tailwind.css) desde [tailwind.config.cjs](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/tailwind.config.cjs) |
| `postcss.parse` sobre [public/brand.css](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/brand.css) | Aprobado (`0` errores) | `162,808 bytes` analizados sin errores sintácticos |
| `node --check` sobre módulo inline de [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html) y `public/pos/*.js` | Aprobado (`exit 0`) | Validados `shell.js`, `views.js`, `admin-views.js` y el `<script type="module">` completo de `index.html` |
| Integridad de recursos protegidos (`git diff --name-only public/carta/ migrations/ functions/`) | Sin cambios (`0` archivos modificados) | Carta PDF original, esquema SQL y backend preservados íntegros |

---

## 3. Matriz QA Headless en Chromium (CDP) — 98 Verificaciones de Viewport y 43 Capturas

Se ejecutó la batería completa en Chromium headless contra `http://127.0.0.1:8788` cubriendo **13 resoluciones** (`320×568`, `360×800`, `390×844`, `430×932`, `768×1024`, `800×1280`, `820×1180`, `1024×768`, `1180×820`, `1280×800`, `1366×768`, `1440×900`, `1920×1080`) y capturando **43 evidencias PNG** en `docs/ux-ui/after-redesign/`:

| Métrica QA Chromium | Resultado medido |
| --- | --- |
| Verificaciones de desbordamiento horizontal (`scrollWidth <= clientWidth + 1`) | **98/98 aprobadas (`0` overflows)** |
| Errores en consola (`console.error` excluyendo `401` pre-login) | **`0`** |
| Excepciones JS no capturadas (`Runtime.exceptionThrown`) | **`0`** |
| Respuestas HTTP `>= 500` | **`0`** |
| Comprobaciones funcionales E2E registradas | **14/14 verificadas** |

### Detalle de Comprobaciones Funcionales E2E Verificadas en Navegador Real
1. **Regresión pública QR (`#mesa=4` y `#delivery=1` en `390×844`):** `data-public-menu=true`, `data-staff-shell=false`, `#pos-header` oculto, `#carta-mobile-nav` visible, `#staff-menu-hero` oculto y contexto intacto (`Mesa 4`, `Delivery`).
2. **App Shell Admin:** Ingreso en `#modulos`, `headerH: 60 px`, `railW: 88 px`, botón `#header-sound-toggle` pasa a `aria-pressed="true"` tras clic, CTA `Nuevo pedido` operativo.
3. **Dashboard sin desborde interno en tabla (`1180×820`):** `dashboard-table-overflow-1180: false`.
4. **Pedidos Master-Detail:** 5 órdenes listadas en bandeja `Por aprobar`, selección activa (`Lucia`) y footer de acciones (`Ver comanda`, `Editar comanda`, `Cancelar pedido`, `Aprobar e imprimir`), más flujo volver/abrir en móvil (`390×844`).
5. **Cocina / Barra KDS + Modo Concentración:** Render completo de tarjetas táctiles, activación de pantalla completa KDS (`concentracion.png`) y salida mediante `Salir pantalla completa`.
6. **Nuevo pedido Split View & Drawer móvil:** Catálogo `Explorar` abierto directo sin `#staff-menu-hero` ni enlace duplicado `#carta-cart-link`; agregado `Burger Classic` (`S/ 14.00`); en móvil (`390×844`), `#client-cart` abre en `position: fixed; z-index: 65` sobre `#cart-drawer-backdrop` (`z-index: 64`) ocultando `#pos-mobile-cart-bar`.
7. **Carta administrativa (`#carta-admin`):** Visor PDF activo sin `#staff-menu-hero` ni barra inferior vacía estorbando en móvil.
8. **Inventario semántico negativo:** KPI `Valor del almacén` muestra `S/ -16.40` (estado D1 local) con `data-negative="true"` y `data-tone="error"` + pill `Déficit real`.
9. **Kardex / Proveedores / Caja & Boletas & Reportes / Códigos QR (`6` mesas + `#delivery=1`) / Configuración / Roles:** Renderizado limpio sin recortes horizontales ni en móvil ni en tablet.
10. **RBAC Rol `Cocina` (`qa-cocina-pin-2026` en D1 local):** Rail limitado a `['inicio', 'cocina', 'barra', 'carta', 'configuracion']`; sin tarjetas de `Caja del día` ni `Alertas de inventario`; bloqueo confirmado al intentar abrir `#admin` (`#view-admin` permanece `.hidden`).

---

## 4. Defectos Visuales Detectados en Primera Pasada QA y Corregidos Antes del Cierre

1. `[hidden]` de `#pos-more-drawer` quedaba anulado por `.pos-more-drawer { display: flex }` -> Corregido con `body[data-staff-shell] [hidden], .pos-shell-chrome[hidden] { display: none !important; }`.
2. Selector `[data-staff-cart-drawer="true"]` no coincidía con `document.body.toggleAttribute('data-staff-cart-drawer', ...)` (que asigna cadena vacía `""`) -> Corregido a `[data-staff-cart-drawer]` + ocultación de `.pos-mobile-cart-bar` cuando el drawer está abierto + botón `#btn-close-cart-drawer` centrado en `44×44 px`.
3. Etiqueta duplicada `+ + Nuevo pedido` y `Configuración` muy justa en Navigation Rail `88px` -> Corregido quitando `+ ` duplicado junto al ícono `<i data-lucide="plus">` y agregando `railLabel: 'Ajustes'`.
4. Lista de viñetas de `Roles y accesos` oculta por Tailwind Preflight (`list-style: none`) -> Restaurado `list-style: disc` en `.pos-role-list`.
5. Título `Proveedores y Compras` cercano al límite en `390px` y columna `"Hamburguesas"` rompiendo la `s` en `1180px` -> Simplificado título de ruta a `'Proveedores'`, ancho de `.carta-desktop-shell` ajustado a `196px` solo bajo `body:not([data-public-menu])`, y columna `Canal` + padding compacto en tabla de Dashboard.
6. `#pos-mobile-cart-bar` visible con carrito vacío sobre `Carta administrativa` en móvil -> Condicionado a `!isPublic && isCompactStaff && (ui.staffOrderEntry || units > 0)`.

---

## 5. Pendientes Fuera del Entorno Headless (Requiere Hardware Físico)

- Impresión térmica real con **BIXOLON Web Print SDK** sobre impresora física conectada por USB/red en caja y cocina.
- Prueba táctil física de gestos y audio en iPad/tablet Android real y teléfonos iOS/Android con impresora activa.
- Creación y cierre completo de jornada real con boletas e impresión en entorno de staging cuando exista turno abierto con caja física.
