# The Burgers Brother — Sistema POS QR + Admin + BIXOLON SPP-R310BK + App Chef (Cloudflare Pages + D1)

Proyecto full-stack listo para subir a **GitHub (`dennys3mf`)** y desplegar en **Cloudflare Pages** con base de datos **Cloudflare D1** para que los códigos QR de mesa, Delivery con prepago, aprobación del Admin y cierre del Chef funcionen sincronizados desde cualquier celular.

## Estructura del proyecto
- `public/index.html` — Aplicación web completa (Carta QR/Delivery, Panel Admin, App Chef, Inventario, Kardex, Proveedores, Caja y Boletas 80 mm para BIXOLON SPP-R310BK).
- `functions/api/[[route]].js` — API serverless en Cloudflare Pages Functions conectada a Cloudflare D1 (`env.DB`).
- `migrations/0001_init.sql` — Esquema SQL para Cloudflare D1 (SQLite).
- `wrangler.toml` — Configuración de Cloudflare Pages y enlace D1 (`binding = "DB"`).

## Paso 1: Subir a tu GitHub (`dennys3mf`)
```bash
git init
git add .
git commit -m "Inicial: POS The Burgers Brother en Cloudflare Pages + D1"
git branch -M main
git remote add origin https://github.com/dennys3mf/the-burgers-brother-pos.git
git push -u origin main
```

## Paso 2: Instalar Wrangler y crear la base de datos Cloudflare D1
```bash
npm install
npx wrangler login
npm run db:create
```
Copia el `database_id` que te devuelve Cloudflare y pégalo en `wrangler.toml` reemplazando `REPLACE_WITH_YOUR_D1_DATABASE_ID`. Luego ejecuta la migración:
```bash
npm run db:migrate:remote
```

## Paso 3: Desplegar en Cloudflare Pages (URL pública para tus QR)
```bash
npm run deploy
```
O conecta el repositorio `dennys3mf/the-burgers-brother-pos` desde el panel de **Cloudflare → Workers & Pages → Create → Pages → Connect to Git** (Directorio de salida: `public`, y en *Settings → Bindings* vincula tu base de datos D1 con el nombre de variable `DB`).

Una vez publicado en `https://the-burgers-brother-pos.pages.dev`, abre el botón **Ver QR** dentro de la app: detectará automáticamente tu URL pública `https://...` y generará códigos QR reales descargables en PNG para pegar en cada mesa.
