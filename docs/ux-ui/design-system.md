# Design System — The Burgers Brother POS V2.0

Sistema visual compartido para operación en tablet, escritorio y teléfono, conservando la identidad cálida artesanal de The Burgers Brother y asegurando legibilidad operativa (WCAG AA) y ergonomía táctil (`Touch First`).

---

## 1. Tokens de Color (Validados WCAG AA)

### Superficies y Marca
| Token CSS | Hex | Uso | Contraste verificado |
| --- | --- | --- | --- |
| `--pos-bg` | `#F3EDE3` | Lienzo de fondo general | Base (`#382B22`: `11.73:1`, `#725941`: `5.60:1`) |
| `--pos-surface` | `#FFFBF5` | Tarjetas, paneles, tablas, formularios | Base (`#382B22`: `13.25:1`, `#725941`: `6.32:1`) |
| `--pos-surface-2` | `#E9DFD1` | Encabezados de tabla, hover sutil, agrupaciones | Base (`#382B22`: `10.37:1`, `#725941`: `4.95:1`) |
| `--pos-nav-bg` | `#382B22` | Navigation Rail, Desktop Sidebar, Bottom Nav | Oscuro (`#FFFBF5`: `13.25:1`, `#E5B260`: `7.07:1`) |
| `--pos-primary` | `#E5B260` | CTA principal, estado activo en navegación | Con texto `#382B22` (`7.07:1` AAA) |
| `--pos-primary-hover` | `#D7A24F` | Hover/active sobre acción primaria | Con texto `#382B22` (`~6.2:1`) |
| `--pos-text-primary` | `#382B22` | Títulos, importes, contenido operativo | `13.25:1` sobre `#FFFBF5` |
| `--pos-text-secondary` | `#725941` | Etiquetas secundarias, fechas, metadatos | `6.32:1` sobre `#FFFBF5` / `5.60:1` sobre `#F3EDE3` |
| `--pos-border` | `#DDCFBE` | Bordes discretos de tarjetas y divisores | Estructural (no texto) |

### Semánticos (Siempre acompañados de texto e ícono, nunca solo color)
| Estado / Semántica | Color Base | Ink accesible (`>= 4.5:1`) | Superficie tintada | Uso |
| --- | --- | --- | --- | --- |
| Error / Crítico / Por aprobar / Faltante | `--pos-error: #AD4D3A` | `--pos-error-ink: #8E3726` | `--pos-error-bg: #F7E9E6` | Por aprobar, Faltante, stock negativo, Cancelar, Egreso |
| Éxito / Listo / Óptimo / Activo | `--pos-success: #46734F` | `--pos-success-ink: #32583A` | `--pos-success-bg: #E7EFE8` | Listos, Óptimo, Jornada abierta, Entregado, Pagado |
| Advertencia / En preparación / Stock bajo | `--pos-warning: #A37731` | `--pos-warning-ink: #755118` (`6.91:1` AA) | `--pos-warning-bg: #F6EAD4` | En cocina, Stock bajo, comandas próximas a vencer |
| Neutral / Sin cola / Inactivo | `--pos-neutral: #897666` | `--pos-text-secondary: #725941` | `--pos-surface-2: #E9DFD1` | Cero pendiente (`0`), historial cerrado, metadatos inactivos |

> **Nota de accesibilidad:** Dado que `#A37731` sobre `#FFFBF5` ofrece `3.89:1` y `#897666` sobre `#FFFBF5` ofrece `4.20:1` (< `4.5:1` para texto pequeño), los tokens `--pos-warning-ink` (`#755118`, `6.91:1`) y `--pos-text-secondary` (`#725941`, `6.32:1`) se utilizan obligatoriamente en textos <= 18px; `#A37731` y `#897666` quedan reservados a métricas grandes (`32–40px`), íconos y bordes.

---

## 2. Tipografía
- **Operativa (`--font-sans`):** `'Inter', system-ui, -apple-system, sans-serif` con `font-variant-numeric: tabular-nums` en precios (`S/ 0.00`), cantidades, temporizadores y tablas.
- **Códigos / Comandas (`--font-mono`):** `'JetBrains Mono', monospace` solo para códigos (`BB-...`), boletas (`BI-001-...`), RUCs y URLs técnicas.
- **Escala:**
  - `Caption`: `12px–13px` (`0.75rem–0.8125rem`)
  - `Secondary`: `14px` (`0.875rem`)
  - `Body`: `16px` (`1rem`) — KDS operativo `16px–18px`
  - `Section title`: `18px–20px` (`1.125rem–1.25rem`)
  - `Module title`: `24px–28px` (`1.5rem–1.75rem`)
  - `Metric (KPI)`: `32px–36px` (`2rem–2.25rem`, peso `700–800`, `tabular-nums`)

---

## 3. Espaciado, Radios, Áreas Táctiles y Elevación
- **Escala base (`4px`):** `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`.
- **Border Radius:** Small `6px` (`--radius-sm`), Medium `8px` (`--radius-md`), Large `12px` (`--radius-lg`), Modal `16px` (`--radius-xl`).
- **Áreas táctiles (`Touch First`):**
  - Mínimo global en botones/controles: `48 × 48 CSS px`.
  - Botones primarios (`+ Nuevo pedido`, `Aprobar e imprimir`, `Marcar lista`, `Confirmar pedido`): `48–56 CSS px`.
  - Filas seleccionables en tablas y listas (Master-Detail / móvil): `56–64 CSS px`.
- **Iconografía:** Exclusivamente familia `Lucide` (`outline`, grosor uniforme, `aria-hidden="true"` con etiqueta visible). Prohibido usar emojis como íconos operativos.
- **Elevación y Movimiento:** Bordes discretos (`1px solid #DDCFBE`) y sombras suaves (`0 2px 8px rgba(56, 43, 34, 0.06)`). Transiciones de `150–200ms` desactivadas bajo `prefers-reduced-motion: reduce`.
