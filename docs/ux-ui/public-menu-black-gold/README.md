# Carta pública Black & Gold

Validación local en Chromium sobre la rama `codex/carta-black-gold`, con `d6a84ca` como referencia para comparar el POS.

## Implementación

- `public/carta-publica.css` define los tokens de la carta pública, la navegación, las categorías, el visor y las tarjetas.
- `public/carta-publica-pedido.css` aplica los mismos tokens a personalización, pedido, checkout, cierre y seguimiento.
- `public/index.html` conecta la categoría con Carta o Explorar según la vista activa. También unifica los accesos al pedido, permite editar los productos agregados y restaura el foco al cerrar los paneles.
- `public/carta-iconos-publicos.js` aplica Phosphor al cliente. `public/carta-icons.js` se genera desde el paquete oficial con `scripts/build-assets.mjs`.
- Los 11 archivos de la carta en `public/carta/` coinciden con la revisión de referencia. La prueba de navegador comprobó las proporciones de las imágenes y la alineación de las áreas de selección.

## Tokens y contraste

Los tokens `--menu-*` se aplican bajo `body[data-public-menu]`. La comparación del color computado dio el mismo resultado que `d6a84ca` en Dashboard, Pedidos, Cocina, Barra, Inventario, Nuevo pedido y Carta administrativa.

| Uso | Token | Color |
| --- | --- | --- |
| Fondo | `--menu-bg` | `#111111` |
| Superficie | `--menu-surface` | `#1C1C1C` |
| Superficie elevada | `--menu-elevated` | `#292929` |
| Acción primaria | `--menu-primary` | `#EFB342` |
| Acción primaria al pasar el cursor | `--menu-hover` | `#F5C263` |
| Acción primaria al pulsar | `--menu-pressed` | `#D99D2F` |
| Texto principal | `--menu-text` | `#F5EEDC` |
| Texto secundario | `--menu-muted` | `#B5B0A5` |
| Borde de superficie | `--menu-border` | `#383838` |
| Borde de control | `--menu-control-border` | `#716D64` |
| Acento | `--menu-accent` | `#D98A32` |
| Error | `--menu-error` | `#C84B37` |
| Éxito | `--menu-success` | `#4CAF78` |

Pares medidos. Crema sobre negro, **16,32:1**. Gris sobre carbón, **7,89:1**. Gris sobre carbón elevado, **6,73:1**. Oro sobre carbón, **9,09:1**. Texto negro sobre botón oro, **10,07:1**. Borde interactivo sobre carbón, **3,31:1**.

## Pruebas

- `npm test` completó sus 17 pruebas.
- El visor mantuvo la proporción del arte y las áreas táctiles dentro de cada página en los nueve tamaños. La prueba también comprobó la paginación y la ausencia de desbordamiento horizontal.
- El gesto horizontal pasó de página. Un gesto de dos contactos emulado por CDP elevó la escala de 1 a 2,60 sin cambiar el número de página.
- Tab y Mayús+Tab recorrieron solo los controles de Pedido y Categorías. Escape cerró cada panel y recuperó el foco en su botón.
- El selector de categorías filtró Explorar y navegó a la página del visor según el contexto. «Todos los productos» estuvo visible solo en Explorar. Se comprobó el modo compacto en escritorio.
- Se probó abrir el enlace de un QR de mesa, agregar desde un hotspot, buscar y limpiar la búsqueda, personalizar, editar y quitar productos, cambiar cantidades, recalcular el total y conservar el carrito al cambiar de vista.
- Se completaron pedidos simulados de mesa, delivery con dirección escrita, delivery con GPS y recojo. Se verificó el recargo existente de tarjeta de S/ 0,70 en un total de S/ 14,70. El seguimiento pasó de «Esperando confirmación» a «Listo para entregar» con un cambio de estado del servidor simulado.

| Ventana | Páginas en pantalla inicial |
| --- | ---: |
| 320 × 568 | 1 |
| 360 × 800 | 1 |
| 390 × 844 | 1 |
| 430 × 932 | 1 |
| 768 × 1024 | 1 |
| 1024 × 768 | 2 |
| 1280 × 800 | 2 |
| 1366 × 768 | 2 |
| 1920 × 1080 | 2 |

La validación usó un navegador local y respuestas interceptadas. La API de producción y los cobros quedaron fuera de la prueba. Los tamaños emulan pantallas y eventos táctiles. El teclado de un teléfono físico y sus márgenes de pantalla requieren verificación en dispositivo.

## Capturas del navegador

1. [Carta móvil](01-carta-movil.png)
2. [Carta de escritorio](02-carta-escritorio.png)
3. [Explorar](03-explorar.png)
4. [Categorías](04-categorias.png)
5. [Personalización](05-personalizacion.png)
6. [Pedido vacío](06-pedido-vacio.png)
7. [Pedido con productos](07-pedido-con-productos.png)
8. [Checkout de mesa](08-checkout-mesa.png)
9. [Checkout de delivery](09-checkout-delivery.png)
10. [Confirmación y seguimiento](10-confirmacion-y-seguimiento.png)
11. [Carta en tablet](11-carta-tablet.png)
