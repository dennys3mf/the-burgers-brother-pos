# Propuesta Arquitectónica de Vistas y Navegación (`proposed-design`)

Este directorio documenta la estructura objetivo que guía la implementación de The Burgers Brother POS V2.0 (basada en las referencias visuales aprobadas por el usuario y en la auditoría de las capturas reales).

## 1. Mapa del App Shell (`!body[data-public-menu]`)

```text
+-----------------------------------------------------------------------------+
| [NavigationRail 88px (Tablet) / DesktopSidebar 240px] | POSHeader (60px)     |
|   - Inicio                                           |   Título | Fecha | Audio | Usuario |
|   - Pedidos (Admin)                                  |----------------------|
|   - Cocina                                           | MainContent          |
|   - Barra                                            |   Vista activa del   |
|   - Caja (Admin)                                     |   módulo sin headers |
|   - Más -> Drawer contextual por rol                 |   gigantes           |
+-----------------------------------------------------------------------------+
| [MobileBottomNavigation (<768px): Inicio | Pedidos | Cocina | Más + safe-area] |
+-----------------------------------------------------------------------------+
```

## 2. Flujo por Dispositivo

### Tablet Horizontal (1024–1439px — Dispositivo Prioritario)
- **Inicio (`#modulos`):** Barra KPI superior de 4 tarjetas reales (`Por aprobar`, `En cocina`, `En barra`, `Listos`) + Split `65/35`: tabla interactiva `Pedidos activos` a la izquierda y `Alertas de inventario` + `Caja del día` a la derecha, junto al botón primario `+ Nuevo pedido`.
- **Nuevo pedido (`Split View` 62/38):** Buscador + chips de 5 categorías + grid de tarjetas táctiles (`Explorar` por defecto, con switch opcional a Carta PDF) a la izquierda; `Pedido actual` sticky a la derecha sin botones duplicados ni banner fotográfico.
- **Pedidos (`Master-Detail` 40/60):** Pestañas con conteos (`Por aprobar | En cocina | Listos | Historial`) + buscador + lista compacta a la izquierda; detalle completo sticky del pedido seleccionado a la derecha con jerarquía clara de acciones (1 CTA primario dominante según estado + secundarios + `Cancelar pedido` aislado con confirmación).
- **Cocina / Barra (KDS):** Switch directo `Cocina | Barra`, filtro `Por preparar | Terminados`, botón código `BB-…`, botón ajustes, toggle `Pantalla completa` (modo concentración), grid multi-columna (`2–3 cols`) con texto `16–18px` y botones de acción de `48px+`.
- **Back Office:** Tablas con alineación tabular, filtros dedicados en Inventario (`Estación`, `Estado`, `Buscar`) y Kardex (`Fecha`, `Estación`, `Tipo`, `Buscar`), subvistas separadas en Proveedores (`Directorio | Compras`) y Caja (`Caja actual | Boletas internas | Reportes`).

### Teléfono (320–767px)
- Navegación inferior fija (`Inicio`, `Pedidos` para Admin / `Barra` para Cocina, `Cocina`, `Más`).
- Todas las tablas complejas (Pedidos, Inventario, Kardex, Proveedores, Caja/Movimientos, Reportes) se adaptan automáticamente a **listas/tarjetas táctiles en 1 columna** con detalles expandibles o vista de detalle independiente (`Pedidos`), logrando **0px de scroll horizontal global**.
- En *Nuevo pedido*, resumen inferior fijo encima del Bottom Navigation que despliega el carrito completo sin perder la selección al cambiar de categoría o formato.
