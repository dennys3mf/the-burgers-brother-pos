# The Burgers Brother POS

La [carta pública](https://the-burgers-brother-pos.pages.dev/) permite generar códigos de mesa y delivery desde **Ver QR**. Los perfiles Admin, Chef y Gestión requieren la clave compartida del personal. El cliente recibe un código al guardar su pedido en D1 y puede seguir el estado en la pestaña donde lo envió.

El personal verifica el prepago de delivery antes de aprobar el pedido. La referencia ingresada por el cliente queda pendiente de verificación hasta ese momento. El inventario inicial contiene los insumos de la carta con existencias en cero.

## Desarrollo local

Instala las dependencias con `npm install` y crea un archivo local `.dev.vars` con el valor `STAFF_PASSWORD` que usarás para las pruebas. Ejecuta `npm run db:migrate:local` una vez y después `npm run dev`.

## Cloudflare Pages

El proyecto está vinculado a GitHub y usa `main` para producción. `wrangler.toml` define la salida `public` y el vínculo D1 `DB`. Las funciones de Pages viven en `functions/api`.

Antes de publicar una versión con migraciones, ejecuta `npm run db:migrate:remote` desde un entorno autorizado en la cuenta de Cloudflare. Configura o rota la clave con `npx wrangler pages secret put STAFF_PASSWORD --project-name the-burgers-brother-pos` y publícala mediante un despliegue de Pages. Mantén la clave fuera de Git y compártela solamente con el personal autorizado.

`GET /api/health` comprueba la conexión al esquema D1. `GET /api/state` y `GET /api/orders` requieren una sesión del personal.

## Impresión directa BIXOLON

Instala [BIXOLON Web Print SDK](https://es.bixolon.com/download_view.php?idx=14&s_key=SDK) en el equipo desde el que se imprimirá. Registra allí la SPP-R310 con el nombre lógico `Printer1` o introduce el nombre que elegiste en **Configurar BIXOLON**. En celular, empareja la variante Bluetooth y abre el POS en el navegador integrado del SDK. En PC, inicia el servicio local antes de abrir el POS.

En **Gestión → Caja**, abre una boleta y elige **Conectar impresora**. Cuando se verifique la conexión, pulsa **Imprimir directo**. Si el SDK tiene activado TLS, selecciona **HTTPS local en el SDK**. El POS usa el puerto local predeterminado 18080. El diálogo del sistema y el PDF siguen disponibles como opciones de impresión.
