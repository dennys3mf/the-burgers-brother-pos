# Registro de Incidencias Conocidas y Observaciones — The Burgers Brother POS V2.0

Fecha: `2026-11-27`

---

## 1. Hallazgos Preexistentes del Entorno Operativo (No Modificados por Restricción de Integridad)

### A. Temporizadores KDS mayores a 24 horas en Cocina (`64 h 38 min`, `47 h 27 min`…)
- **Causa raíz verificada en código y D1:** [functions/api/[[route]].js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/functions/api/[[route]].js) registra `preparation_started_at = clock.iso` al aprobar el pedido y [public/preparation.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/preparation.js) calcula correctamente el tiempo transcurrido frente a `Date.now()` (`America/Lima`). Los valores superiores a `24 h` observados en las capturas originales (`03-cocina/`) y `28 h` observados en pedidos `POR_APROBAR` de prueba en D1 local (`BB-99F7CC89FECF`, `BB-BD1CF2177CB7`) corresponden a órdenes antiguas que nunca fueron marcadas como terminadas vía `POST /api/kitchen/complete`.
- **Estado en V2.0:** Conservados íntegros sin reiniciar contadores ni alterar el historial; las tarjetas KDS resaltan visualmente las comandas demoradas (`prep-late`).

### B. Stock negativo y valorización negativa en Inventario (`S/ -35.60` en capturas base / `S/ -16.40` en D1 local)
- **Causa raíz verificada:** Los insumos iniciales en [functions/initial-state.js](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/functions/initial-state.js) parten con stock `0` antes de registrar compras/conteos iniciales, y la deducción por recetas descuenta consumo sin acotar a `0`.
- **Corrección UX aplicada en V2.0:** Se eliminó la clase estática `text-emerald-600` (que pintaba de verde un valor negativo en [public/index.html](file:///d:/the-burgers-brother-cloudflare/the-burgers-brother-pos/public/index.html)). Ahora el KPI `Valor del almacén` evalúa dinámicamente `totalValuation < 0` y renderiza color error semántico (`--pos-error`, `#AD4D3A`) junto con la etiqueta explícita `Déficit real`.

---

## 2. Limitaciones Propias del Entorno de Pruebas Locales / Headless

1. **Impresora BIXOLON Web Print SDK (`public/bixolon.js`):** No evaluable físicamente sin hardware ni servicio BIXOLON local instalado.
2. **Audio HTML5 / `AudioContext`:** El desbloqueo del botón `#header-sound-toggle` y su estado persistente `aria-pressed` fueron verificados en Chromium, pero la salida acústica real por altavoces requiere verificación manual en tablet de salón/cocina.
3. **Credencial de pruebas local en `.wrangler/state/v3/d1`:** Durante el QA automatizado del rol `Cocina` en el servidor local, se configuró temporalmente la clave local de Cocina (`PUT /api/access/chef`) en el estado local `.wrangler/` (sin afectar código ni D1 de producción). La variable temporal `.dev.vars` usada para arrancar `wrangler pages dev --local` fue eliminada antes de finalizar.

---

## 3. Mejoras Futuras Opcionales (Fuera del Alcance Actual)

- **Atajo directo de cierre masivo de pedidos de prueba antiguos en entornos QA** (solo bajo herramienta administrativa explícita, nunca automático en producción).
- **Auditoría visual periódica en dispositivos físicos** con Safari iPadOS y Chrome Android tras desplegar manualmente cuando el propietario lo autorice.
