# Plan de Implementación — The Burgers Brother POS V2.0

Estrategia rectora: **Tablet First (prioridad horizontal y soporte vertical) + Touch First + Full Responsive Design (320px–1920px+)** sobre una arquitectura compartida sin modificar la carta pública QR, el PDF original, los contratos API ni las reglas de negocio.

---

## 1. Arquitectura Propuesta y Estrategia Técnica

Para mantener compatibilidad directa con Cloudflare Pages estático sin añadir bundlers complejos ni romper estado compartido:
1. **`public/brand.css` + `styles/tailwind.css` (`npm run build:assets`):** Consolidar las variables CSS del Design System POS V2.0 (`#F3EDE3`, `#FFFBF5`, `#E9DFD1`, `#382B22`, `#E5B260`, `#D7A24F`, `#725941`, `#DDCFBE`, semánticos WCAG AA) encapsuladas para no alterar los estilos de `body[data-public-menu]`.
2. **`public/pos/` (Módulos ES dedicados para lógica de presentación y Shell):**
   - `public/pos/shell.js` — Configuración de navegación por rol (`Admin` / `Cocina`), renderizado de etiquetas, header global compacto (`POSHeader`), `NavigationRail`, `DesktopSidebar`, `MobileBottomNavigation` y `MoreModulesDrawer`.
   - `public/pos/views.js` — Helpers puros/seguros de presentación para Dashboard operativo vivo (`renderDashboardOverview`), Master-Detail de Pedidos, filtros de Inventario/Kardex y tarjetas móviles sin recorte horizontal, Caja/Boletas/Reportes divididos en 3 subvistas, Códigos QR independiente, Configuración agrupada y Roles y accesos.
3. **`public/index.html`:** Integrar `#pos-app-shell` envolviendo todas las vistas administrativas (`.role-view` cuando `!body[data-public-menu]`), manteniendo la única fuente de verdad de `state`, `ui`, `callStaffApi`, polling ETag 4s, BIXOLON, `posSounds` y carta pública `#view-cliente`.

---

## 2. Roadmap Incremental por Fases y Criterios de Aceptación

### Fase 1 — Design System y Tokens (`docs/ux-ui/design-system.md` + `public/brand.css`)
- Definir escala tipográfica operativa (`12–13px` caption, `14px` secondary, `16px` body, `18–20px` section, `24–28px` module, `32–40px` KPI tabular-nums) sin tipografía condensada en importes o tablas.
- Verificar contraste WCAG AA (`>= 4.5:1` texto normal): `#382B22` (`13.25:1`), `#725941` (`6.32:1`), `#AD4D3A` (`5.22:1`), `#46734F` (`5.32:1`), `#755118` para texto advertencia (`6.91:1`) usando `#A37731` para íconos/bordes/métricas grandes.
- Alturas táctiles mínimas `48×48px` (acciones primarias `48–56px`, filas `56–64px`) y radios `6/8/12/16px`.

### Fase 2 — Global `POSAppShell` (`NavigationRail`, `DesktopSidebar`, `MobileBottomNavigation`, `POSHeader`, `MoreModulesDrawer`)
- **Escritorio (`>= 1440px` / colapsable desde `1024px+`):** Sidebar lateral expandible (`224–256px` con botón colapsar/expandir persistente y versión compacta opcional) mostrando módulos agrupados según rol (`Admin` vs `Cocina`).
- **Tablet horizontal/vertical (`768px–1439px`):** `NavigationRail` izquierdo (`88px`) con accesos prioritarios (`Inicio`, `Pedidos`, `Cocina`, `Barra`, `Caja`, `Más`) para `Admin` y adaptados (`Inicio`, `Cocina`, `Barra`, `Carta`, `Configuración`, `Más`) para `Cocina`.
- **Teléfono (`320–767px`):** `MobileBottomNavigation` fija inferior (`Inicio`, `Pedidos`, `Cocina`, `Más` para `Admin`; `Inicio`, `Cocina`, `Barra`, `Más` para `Cocina`) respetando `env(safe-area-inset-bottom)` y sin solapar contenido.
- **`POSHeader` único (`56–64px`):** Título del módulo actual + contexto breve/fecha Lima + estado de audio real conectado a `posSounds` + píldora de usuario con menú desplegable de perfil y `Cerrar sesión`.
- **Limpieza:** Eliminar `.module-hero`, `.prep-header` sobredimensionada, `#staff-menu-hero` para personal y duplicación de flechas *Volver*.
- **Criterio:** La navegación global funciona en `Admin` y `Cocina`, nunca aparece en la carta pública QR (`?mesa=` / `#delivery=` / `#recojo=`), y respeta el historial del navegador (`hashchange` / `history`).

### Fase 3 — Core POS (`Inicio / Dashboard`, `Nuevo pedido`, `Pedidos`)
1. **Dashboard (`#view-modulos` transformado a Centro Operativo en Vivo):**
   - Cabecera operativa (`Operación en vivo` + CTA primario prominente `+ Nuevo pedido` en `#E5B260`, `48–56px`).
   - 4 tarjetas KPI clicables con color semántico e ícono Lucide (`Por aprobar`, `En cocina`, `En barra`, `Listos`) — sin repetirlas debajo en tiras duplicadas. Para rol `Cocina`, solo estaciones y acciones autorizadas (`Cocina`, `Barra`, `Terminados`, `Ingresar código`, `Carta`).
   - Tablet horizontal (`>= 1024px`): Split `~65–70%` tabla/lista `Pedidos activos` priorizados (`Por aprobar` → `Listos` → `En cocina` ordenados por urgencia) + botón contextual rápido, y `~30–35%` tarjetas `Alertas de inventario` (conteo real -> clic navega a Inventario) + `Caja del día` (jornada actual + efectivo esperado real -> clic navega a Caja).
   - Teléfono: KPIs `2×2` + `+ Nuevo pedido` ancho completo + `Pedidos activos` en tarjetas limpias + alertas compactas.
2. **Nuevo pedido (`#nuevo-pedido`, Split View operativo en `#view-cliente` cuando `ui.staffOrderEntry`):**
   - Sin banner fotográfico `#staff-menu-hero`. Controles superiores limpios dentro del módulo: selector de canal (`En mesa` / `Para llevar (Recoger)` cuando aplique + selector `Mesa 1..6` + alternador `Explorar` | `Carta PDF`) y salida a `Pedidos` con confirmación si hay carrito con ítems.
   - Vista por defecto para personal al abrir *Nuevo pedido*: **`Explorar` (catálogo POS táctil con buscador y chips compactos de las 5 categorías)**, manteniendo el cambio instantáneo a la **Carta PDF original con hotspots** sin perder el carrito.
   - Tablet horizontal/Desktop: Split `60–65%` catálogo + `35–40%` panel derecho sticky *Pedido actual* (ocultando botón redundante `Pedido (N)` del header de carta).
   - Teléfono: catálogo a ancho completo + barra inferior/drawer de resumen de carrito con total y envío directo sobre Bottom Navigation o modo dedicado sin perder navegación.
3. **Pedidos (`#admin`, Master-Detail en Tablet horizontal y Desktop):**
   - Pestañas de estado (`Por aprobar`, `En cocina`, `Listos`, `Historial`) con conteos reales + buscador único superior.
   - Tablet horizontal / Escritorio (`>= 1024px`): Panel izquierdo (`~38–42%`) lista compacta táctil (origen/mesa, cliente, total, estado, código/tiempo) + Panel derecho (`~58–62%`) detalle completo (`OrderDetails` con ítems, extras, cremas, dirección/GPS, método pago, notas) y jerarquía estricta de botones (1 primario dominante según estado: `Aprobar e imprimir` / `Cobrar y Emitir Boleta` / `Despachar + Boleta Interna`, secundarios `Ver comanda` y `Editar comanda`, destructivo separado `Cancelar pedido`). Confirmación obligatoria en cancelaciones y bloqueo anti doble clic.
   - Teléfono / Tablet vertical (`< 1024px`): Lista compacta limpia (1 tarjeta = resumen rápido) que al tocar abre la vista/panel de detalle del pedido (`Ver detalle` / modal o subvista independiente en móvil) con botón `← Volver al listado`.

### Fase 4 — KDS (`Cocina & Barra`)
- Reemplazar banner oscuro por barra de controles compacta en línea dentro del App Shell (`Cocina` | `Barra` con contadores, `Por preparar` | `Terminados`, botón código `BB-…`, botón ajustes KDS y **Modo concentración / Pantalla completa** `[data-kds-fullscreen]`).
- Comandas con legibilidad a distancia (`16–18px` en ítems, cantidades destacadas, sabores/extras/cremas/notas completas sin truncar), grid adaptativa (`1 col` móvil, `2 cols` tablet vertical, `2–3 cols` horizontal, hasta `4 cols` en `>= 1440px` sin estirar tarjetas artificialmente).
- Temporizadores de espera reales (`preparationStartedAt`) con distinción clara normal vs alerta (`>= target min`), preservando valores > 24h sin alterarlos.
- Estados vacíos diferenciados (sin pedidos vs cargando vs error/reconexión) con acción útil.

### Fase 5 — Back Office (`Inventario`, `Kardex`, `Proveedores & Compras`, `Caja & Boletas & Reportes`)
- Separar la navegación lateral/rail hacia los sub-módulos de Back Office sin apilar un segundo encabezado gigante; dentro de Caja conservar subtabs claros para sus 3 vistas:
  1. **Inventario:** 3 KPIs propios (`Insumos controlados`, `Stock bajo / Faltante`, `Valor del almacén` en rojo cuando `< 0`), toolbar con buscador en vivo, filtro Estación (`Todas | Cocina | Barra`), filtro Estado (`Todos | Faltante | Stock bajo | Óptimo`) + acciones (`Nuevo insumo`, `Recetas de la carta`, `Ajustar stock`). Tabla táctil tabular en tablet/desktop y tarjetas compactas con detalle expandible en teléfono (`0` scroll horizontal).
  2. **Kardex:** Buscador por código/insumo + filtros por Estación (`Todas | Cocina | Barra`), Tipo (`Todos | Entradas | Salidas`) y Fecha + botón `Exportar CSV`. Tabla con encabezado claro en desktop/tablet y lista expandible en móvil.
  3. **Proveedores & Compras:** Subvistas separadas (`Directorio` | `Compras registradas`), empty states informativos con CTAs directos (`Nuevo proveedor`, `Registrar compra`), listas móviles limpias en 1 columna y modales de un campo por fila en teléfonos.
  4. **Caja, Boletas y Reportes:** Subtabs dedicados (`Caja actual` | `Boletas internas` | `Reportes`). Caja actual clara con control de jornada, cierre diario confirmatorio con modal explícito, 4 métricas en formato `S/ 0.00` tabular y listado responsive de movimientos. Boletas internas con búsqueda rápida del turno e impresión térmica/PDF. Reportes con `Día/Semana/Mes/Año`, fecha, desglose `Efectivo/Yape/Plin/Tarjeta`, exportación CSV y tablas/listas sin desbordes móviles.

### Fase 6 — Administración (`Carta administrativa`, `Códigos QR`, `Configuración`, `Roles y accesos`)
- **Carta administrativa:** Acceso en la vista libro/explorar dentro del App Shell **sin banner hero fotográfico**, diferenciada de *Nuevo pedido* (inicia en Carta visual para consulta/uso de mesa o modal QR contextual).
- **Códigos QR (Módulo independiente `#qr`):** Cuadrícula responsive con las 6 mesas reales (`Mesa 1..6`), previsualización QR SVG escaneable en vivo, enlace completo legible sin truncar (`theburgersbrother.com/#mesa=N`), acciones por mesa / selector rápido (`Descargar PNG`, `Copiar enlace`, `Probar acceso`), URL base editable, más tarjeta diferenciada de **Carta Web Delivery** (`#delivery=1`, copiar/abrir) y enlace para recoger (`#recojo=1` si aplica sin confusión con QR de mesa). Mantener también acceso contextual modal si se invoca desde Carta.
- **Configuración (`#configuracion`) y Roles (`#roles`):** Vistas integradas al Shell (sin modales anidados) organizadas en secciones claras (*Notificaciones y sonido*, *Seguridad / Clave de Cocina* para Admin, *Cuenta y sesión*, y vista de *Roles y accesos* de solo lectura preservando permisos exactos). Mantener compatibilidad con los dialogs existentes si algún acceso rápido los invoca o unificarlos limpiamente.

### Fase 7, 8 y 9 — QA Multi-Viewport, Pruebas y Documentación Final
- Ejecutar `npm run build:assets`, validar sintaxis CSS/JS, ampliar `tests/` con pruebas unitarias/regresión de cualquier lógica extraída (`public/pos/*.js`), mantener `npm test` al 100%.
- Probar con `wrangler pages dev --local` + Playwright headless Chromium en los 12 viewports definidos en la Sección 32 (`320×568` a `1920×1080`), verificar 0 errores de consola y 0 desbordes horizontales globales, verificar flujos reales (login Admin & Cocina, creación de pedido mostrador, Master-Detail aprobación/edición/cobro/despacho/cancelación, KDS Cocina/Barra, Inventario/Kardex/Proveedores/Caja/Reportes/QR/Config/Roles y Carta pública QR/Delivery/Recojo).
- Capturar imágenes reales en `docs/ux-ui/after-redesign/` por cada módulo y completar `design-system.md`, `architecture.md`, `testing-report.md`, `known-issues.md`, `changelog.md` y resumen final (sin desplegar a producción ni dejar archivos temporales `.dev.vars`).

---

## 3. Riesgos y Mitigaciones
1. **Regresión en Carta Pública QR (`body[data-public-menu]`):** Toda regla CSS y manipulación DOM del App Shell debe estar estrictamente condicionada a `body[data-staff-shell]` (`!body[data-public-menu]`). Se verificará explícitamente antes y después con capturas y checklist funcional en `320px` y `390px` y `1280px`.
2. **Desincronización de `syncStaff()` / `pollCloudflare()` durante rediseño DOM:** Mantener IDs críticos o actualizar en un solo paso las referencias DOM y listeners de eventos, evitando duplicar listeners en re-renders.
3. **Desbloqueo de audio del navegador (`AudioContext`):** Reutilizar `toggleSound` y la instancia única `posSounds` en el header global y en Configuración para garantizar activación por gesto de usuario real.
4. **Tabla responsive en móvil vs tabla en desktop:** Nunca forzar scroll horizontal en `body` ni recortar columnas; en móvil (`< 768px`) renderizar listas/tarjetas dedicadas alimentadas por el mismo estado.
