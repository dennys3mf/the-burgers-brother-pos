# Auditoría Técnica y UX/UI — The Burgers Brother POS (Fase 0)

Fecha de auditoría: `2026-11-27`  
Alcance: Sistema POS administrativo (`#modulos`, `#admin`, `#chef`/`#estacion`, `#gestion`, `#personal/`), visor de Carta administrativa, Gestión de QR, y preservación integral de la experiencia pública QR / Delivery / Para llevar (`#mesa=...`, `#delivery=1`, `#recojo=1`).

---

## 1. Arquitectura Actual del Repositorio

### Stack y Herramientas
- **Runtime / Hosting:** Cloudflare Pages + Pages Functions (`functions/api/[[route]].js`) sobre base de datos Cloudflare D1 (`migrations/0001_init.sql`..`0005_shifts_and_incremental_ops.sql`).
- **Frontend:** Vanilla HTML/CSS/ES Modules sin bundler JS en tiempo de ejecución (`public/index.html` ~5,609 líneas con JavaScript inline + módulos ES en `public/`).
- **Estilos:** Tailwind CSS `3.4.19` compilado a `public/vendor/tailwind.css` (`scripts/build-assets.mjs`, `tailwind.config.cjs`) + hoja de diseño principal `public/brand.css` (~3,482 líneas).
- **Iconografía y utilidades vendoreadas:** `lucide@0.460.0` (`public/vendor/lucide.min.js`), `qrcode-generator@1.4.4` (`public/vendor/qrcode.js`), `jspdf` (`public/vendor/jspdf.umd.min.js`).
- **Módulos JS existentes (`public/`):**
  - `carta-components.js` — Componentes de carta digital (`CARTA_CATEGORIES`, `renderCategoryNav`, `syncCategoryNavState`, `canFitBookSpread`, `buildMenuPageLeaf`, `bindBottomSheetSwipe`).
  - `order-pricing.js` — Fuente única de precios compartida cliente/servidor (`TAPER_PRICE = 1`, `CARD_FEE_PERCENT = 5`, `priceOrder()`).
  - `preparation.js` — Lógica KDS (`STATIONS = ['COCINA', 'BARRA']`, `orderStations`, `stationReady`, `preparationStartedAt`, `formatPrepCompletion`, `prepHistory`).
  - `staff-entry.js` — Resolución de hash/query para ingreso directo a estación (`preparationEntry`, `staffLoginUrl`).
  - `pos-sounds.js` — Web Audio API + preload de clips `./sounds/*.mp3` (`createPosSounds`).
  - `bixolon.js` — Impresión térmica directa vía BIXOLON Web Print SDK (`runBixolon`).
  - `receipt-pdf.js` — Generación PDF 80 mm para boleta interna (`receiptPdf`).
  - `personal/index.html` y `personal/login.js` — Pantalla de autenticación de personal (`admin` Nicol y `chef` Cocina).

### Navegación, Rutas y Autorización
- **Rutas cliente públicas (`document.body[data-public-menu]`):**
  - `/?` / `#delivery=1` / `#recojo=1` / `#mesa=1..6`
  - Renderizan únicamente `#view-cliente` sin sesión requerida.
- **Rutas administrativas (`applyHashRoute` en `public/index.html`):**
  - `#modulos` (o `#personal`): lanzador de 12 mosaicos (`Admin`) o accesos reducidos (`Cocina`).
  - `#admin`: Bandeja de pedidos (`Admin`).
  - `#chef` / `#estacion=cocina` / `#estacion=barra` / `#chef=<CODE>`: Pantalla de preparación (`Admin` y `Cocina`).
  - `#gestion=inventario|kardex|proveedores|caja`: Gestión de Back Office (`Admin`).
  - Estado especial sin cambio de hash: `ui.staffOrderEntry = true` desde `+ Nuevo pedido`, reutilizando `#view-cliente` en modo mostrador.
- **Autenticación y roles reales (`functions/api/[[route]].js` + `public/index.html`):**
  - `Admin` (`staffArea === 'admin'`): Cookie firmada HMAC vía `POST /api/session`, acceso completo a `/api/state`, `/api/orders/*`, `/api/kitchen/*`, `/api/inventory/*`, `/api/suppliers`, `/api/purchases`, `/api/caja/expense`, `/api/shifts/*`, `/api/business/day-status`, `/api/reports`, `/api/access/chef`.
  - `Cocina` (`staffArea === 'chef'`): Cookie firmada HMAC usando credencial guardada en `pos_chef_access`, acceso a `GET /api/kitchen` y `POST /api/kitchen/complete`. En cliente `canOpenPosView(role)` limita a `['modulos', 'chef', 'cliente']`.
  - `Cliente` (público): Solo `GET /api/status`, `POST /api/orders`, `GET /api/orders/:id`.

### Pruebas Existentes (Estado Base Verificado)
Ejecución de `npm test` (`node --test`): **8/8 pruebas aprobadas (0 fallos)** cubriendo `tests/api-regression.test.js` y `tests/shifts-and-history.test.js` (proyección SQL incremental, concurrencia CAS/ETag, bloqueo de domingos/días cerrados, autocierre 00:00 Lima, reportes históricos, validaciones Delivery GPS/manual vs Recojo vs Mesa).

---

## 2. Auditoría Visual y UX contra las 20 Capturas Actuales (`docs/ux-ui/current-design/`)

### Hallazgos Transversales (Sistema Completo)
1. **Ausencia de App Shell y navegación persistente:** Cada módulo administrativo (`view-admin`, `view-chef`, `view-gestion`, `view-cliente` en modo personal) renderiza un bloque oscuro gigante independiente (`.module-hero` / `.prep-header` / `#staff-menu-hero`) con un botón `←` para regresar a `#modulos` (`view-modulos`). El personal no puede saltar directamente entre *Inicio*, *Pedidos*, *Cocina*, *Barra*, *Caja* u otros módulos sin retroceder al lanzador.
2. **Exceso de encabezados, descripciones permanentes y ruido visual:** Se repiten textos explicativos (`MÓDULO · OPERACIÓN`, `MÓDULO · ADMINISTRACIÓN`, `MÓDULO · ESTACIONES`, subtítulos permanentes) y badges redundantes (`5 por aprobar` aparece simultáneamente en el subtítulo, en la barra KPI superior y dentro de la tarjeta *Pedidos* en `01-dashboard/`).
3. **Controles de cuenta y audio mal ubicados:** `Admin · Nicol`, `Activar sonido` y `Cerrar sesión` ocupan fila completa en el encabezado de `#view-modulos` (`01-dashboard/movil-superior.png`) pero desaparecen al entrar a `#admin`, `#gestion` o `#chef` (en `#chef` solo existe dentro del menú `...`).

### Hallazgos por Módulo (vs. Capturas)
| Módulo | Captura(s) | Problemas Detectados | Discrepancia Código vs Captura |
| --- | --- | --- | --- |
| **01 Dashboard** | `01-dashboard/escritorio.png`, `movil-superior.png`, `movil-inferior.png` | Lanzador estático de 12 mosaicos sin vista operativa de pedidos activos ni tarjeta directa de Caja del día o acción prominente `+ Nuevo pedido`. Grid de 5 + 7 deja huecos huérfanos en escritorio y móvil (`Carta` queda sola; `Roles y accesos` queda sola). | En código (`renderModuleStats`), sí existen todos los conteos reales en memoria (`pendingCount`, `cookingCount`, `readyCount`, `lowCount`, efectivo esperado) que no se aprovechan como centro operativo vivo. |
| **02 Pedidos** | `02-pedidos/movil.png` | Tarjetas grandes apilan productos + 4 botones al pie (`Ver comanda`, `Cancelar pedido`, `Editar comanda`, `Aprobar e imprimir`). En 360px `Cancelar pedido` salta a 2 líneas con fondo rosa entre dos botones neutros con bordes equivalentes. En escritorio (`grid-cols-3`) todas las tarjetas muestran listas completas en paralelo en lugar de Master-Detail. | `view-admin` usa grid `md:grid-cols-2 xl:grid-cols-3` sin panel de detalle persistente en tablet/desktop. |
| **03 Cocina / 04 Barra** | `03-cocina/escritorio.png`, `03-cocina/movil.png`, `04-barra/movil.png` | Header oscuro alto en móvil (~145px) consume pantalla antes de ver las comandas. Temporizadores `64 h 38 min`, `47 h 27 min` sin alerta visual suficientemente diferenciada para operación a distancia ni modo concentración dedicado visible en barra superior. En `04-barra/movil.png`, estado vacío plano en caja pequeña sobre enorme vacío inferior. | `prepPreferences` soporta `largeText`, `showTimers`, `tableTime` (10 min por defecto), `deliveryTime` (60 min) y `prep-late`, pero no existe botón rápido de pantalla completa/concentración en el header KDS. |
| **05 Nuevo pedido** | `05-nuevo-pedido/escritorio.png` | Muestra **4 niveles de encabezado apilados**: barra `"Nuevo pedido de mostrador / Volver a Admin"` + hero publicitario gigante con foto de hamburguesa `"THE BURGERS BROTHER"` + header `"La carta [Carta] [Explorar] [Pedido (0)]"` + `"Tu pedido"`. Además duplica el botón `Pedido (0)` aunque el carrito está visible a la derecha, y abre inicialmente el PDF visual en lugar del catálogo rápido `Explorar`. | `startCounterOrder()` activa `ui.staffOrderEntry = true`, pero `applyHashRoute`/`renderCliente` mantiene `showMenuFormat('visual')` y deja visible `#staff-menu-hero`. |
| **06 Inventario** | `06-inventario/escritorio.png`, `06-inventario/movil.png` | `Valorizado Almacén S/ -35.60` se muestra en **verde (`text-emerald-600`)**. En móvil (`360px`), la tabla se **recorta horizontalmente** (`MÍNIMC`, `2000 g` cortado) obligando scroll lateral en vez de tarjetas táctiles. No tiene buscador ni filtros por estación (`COCINA`/`BARRA`) ni estado (`Faltante`/`Stock bajo`/`Óptimo`). | En `public/index.html:3326`, la clase `text-emerald-600` está fija sin evaluar `valTotal < 0`. |
| **07 Kardex** | `07-kardex/movil.png` | En móvil la tabla queda cortada (`DOCUMEI / PEDIDO`). Formatos mixtos de fecha en historial (`27/11/26, 11:27 a. m.` vs `26/11/2026 14:12` heredado). Falta filtro por estación, tipo de movimiento y fecha; solo tiene buscador textual. | CSV ya exporta todo correctamente; filtros adicionales pueden derivarse en memoria combinando `state.kardex` con `state.ingredients` (`station`). |
| **08 Proveedores** | `08-proveedores/movil.png` | Dos paneles apilados y tabla vacía de Proveedores con barra de desplazamiento horizontal azul cortando `CONTACTO`. Sin pestañas dedicadas (`Directorio` / `Compras`), estados vacíos secos sin guía útil ni botón en empty state. | Los formularios `#modal-supplier` y `#modal-purchase` están funcionales pero la pantalla mezcla ambas vistas. |
| **09 Caja y Boletas** | `09-caja-boletas/escritorio.png`, `movil-caja.png`, `movil-reportes.png` | Una sola pantalla kilométrica mezcla: (A) Control de jornada + KPIs + Movimientos de Caja + Boletas Emitidas Hoy, y (B) Historial y Reportes (`Día/Semana/Mes/Año` + métricas + tabla + boletas). En móvil ambas tablas (`Movimientos de Caja` y `Jornadas`) se **recortan a la derecha**. | Todas las llamadas `/api/shifts/*` y `/api/reports` ya operan correctamente en D1; la división en 3 subvistas funcionales es puramente organizacional de UI. |
| **10 Carta (Admin)** | `10-carta/escritorio.png` | Al abrir Carta desde el POS admin sigue mostrando el banner promocional gigante `#staff-menu-hero` con fotografía de hamburguesa y botón duplicado `Pedido (0)` junto a `Tu pedido`. | En desktop sí oculta `#carta-mobile-nav` y muestra `.carta-sidebar` correctamente, pero mantiene hero + redundancias. |
| **11 Códigos QR** | `11-codigos-qr/escritorio.png`, `movil.png` | No es un módulo independiente: abre `#modal-qr` encima de `#view-cliente`, truncando la URL en `URL pública del POS` (`https://theburgersbrother.c`) y obligando a cambiar el `<select>` mesa por mesa en lugar de ofrecer cuadrícula real de Mesas 1–6 + sección Delivery clara sin desbordamientos. | Todo el generador SVG/PNG real (`qrcode-generator`) funciona bien y debe conservarse intacto en URL (`#mesa=1..6` y `#delivery=1`). |
| **12 Configuración** | `12-configuracion/movil.png` | Existe solo como `<dialog id="staff-settings">` pequeño lanzado desde Dashboard, sin tarjeta de perfil/sesión ni acceso unificado desde el App Shell, y encadena modal sobre modal al abrir *Ver roles* o *Cambiar clave de Cocina*. | Preservar `#staff-sound` y `#btn-chef-access` conectándolos sin romper el desbloqueo de `AudioContext`. |
| **13 Roles y accesos** | `13-roles/movil.png` | Existe solo como `<dialog id="staff-roles">` de solo lectura lanzado desde Dashboard o Configuración. | Conserva exactamente los 3 perfiles reales (`Admin · Nicol`, `Cocina`, `Cliente`); debe integrarse como módulo informativo del sistema en `#roles` o pestaña dedicada sin inventar editor de permisos. |

---

## 3. Investigación de Anomalías Preexistentes Reportadas

### Anomalía A — Temporizadores > 24 horas en Cocina (`03-cocina/`: `64 h 38 min`, `47 h 27 min`…)
- **Evidencia observada en capturas (`03-cocina/escritorio.png` y `07-kardex/movil.png`) y código (`public/preparation.js`, `functions/api/[[route]].js`):**
  - En `functions/api/[[route]].js:633`, al aprobar un pedido se guarda `preparation_started_at = clock.iso` (UTC ISO exacto).
  - En `public/preparation.js:24-26`, `preparationStartedAt(order)` prioriza `order.preparationStartedAt` y calcula `Date.now() - start`.
  - Contrastando con `07-kardex/movil.png` capturado en el mismo instante que `03-cocina/escritorio.png`: la orden reciente `BB-3F7633A8E414` figura aprobada el `27/11/26, 11:27 a. m.` y su tarjeta KDS marca `17 min`; la orden `BB-27A732D63154` figura en Kardex el `26/11/26, 11:58 p. m.` y marca `11 h 46 min`.
- **Conclusión raíz:** El cálculo temporal y de zona horaria (`America/Lima`) es **correcto**. Los valores de `42 h` a `64 h` corresponden a **comandas reales/de prueba aprobadas entre 2 y 3 días antes (`24–26 nov`) en el entorno observado que permanecieron en estado `EN_COCINA`** sin haber sido marcadas como listas (`POST /api/kitchen/complete`). Además, se verificó en la base local D1 de desarrollo que 5 pedidos recientes (`BB-81821987F908`, `BB-051ADF695E5F`, `BB-A4645CA617DE`, `BB-99F7CC89FECF`, `BB-BD1CF2177CB7`) siguen en `POR_APROBAR`.
- **Decisión obligatoria:** No auto-cerrar ni alterar registros históricos ni reiniciar contadores. Documentarlo en `known-issues.md` y resaltar visualmente las comandas demoradas en KDS sin ocultar su tiempo real.

### Anomalía B — Stocks negativos y Valorización de Almacén `S/ -35.60` (`06-inventario/`)
- **Evidencia observada en código (`functions/initial-state.js:33`, `functions/pos-store.js:519-570`) y D1 local:**
  - En `functions/initial-state.js:33`, al inicializar la tienda en frío se ejecuta `for (const ingredient of state.ingredients) ingredient.stock = 0;`.
  - Cuando Admin aprueba un pedido (`POST /api/orders/:id/approve`), `buildOrderDeductions` descuenta los insumos de la receta desde el stock actual **sin impedir saldos negativos** (comportamiento intencional del negocio para no bloquear ventas en hora pico si falta registrar una compra previa en Kardex).
  - En la captura `06-inventario/escritorio.png`: `(-250 × 0.03) + (-1 × 1.50) + (-3 × 2.20) + (-6 × 1.10) + (-1 × 2.80) + (-5 × 1.20) + (-2 × 2.00) + (-1 × 0.60) = -7.50 - 1.50 - 6.60 - 6.60 - 2.80 - 6.00 - 4.00 - 0.60 = S/ -35.60`. En D1 local también se observan stocks negativos iniciales tras pruebas (`IN-01: -300`, `IN-02: -2`, `IN-03: -2`) con stock inicial `0`.
  - El defecto de interfaz estaba en `public/index.html:3326`, que pintaba el KPI `Valorizado Almacén` siempre en verde (`text-emerald-600`).
- **Decisión obligatoria:** No alterar fórmulas ni corregir stocks en base de datos. Mostrar el valor real en rojo/error (`#AD4D3A`) cuando sea negativo e indicar claramente estado *Faltante* / *Déficit*.

---

## 4. Discrepancias Adicionales Código vs. Capturas
- **Modal de Delivery/Para llevar/Local Cerrado/Estado de Pedido:** El código actual (`?v=20261127c`) ya incluye la refactorización móvil de Carta pública QR (`carta-components.js`), agrupación de bebidas con selector en modal, obligación de nombre en todos los canales, selección de GPS o dirección manual en Delivery, `RECOJO` sin dirección, `#business-closed-modal` centrado y `#client-tracker-modal` sin ocupar espacio en el cuerpo. Estas mejoras **no deben regresar**.
- **Navegación de `#personal/` (`public/personal/login.js`):** Apunta por defecto a `../#modulos` tras login de Admin o `#estacion=...` si proviene de QR de cocina. Se mantendrá compatible agregando rutas hash limpias para los módulos del nuevo Shell (`#modulos` / `#inicio`, `#admin`, `#nuevo-pedido`, `#chef`, `#gestion=...`, `#carta`, `#qr`, `#configuracion`, `#roles`).
