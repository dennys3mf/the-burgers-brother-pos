# The Burgers Brother POS

La [carta pública](https://theburgersbrother.com/) permite generar códigos QR de mesa y copiar el enlace de Carta Delivery desde **Ver QR**. El personal inicia sesión en [Acceso del personal](https://theburgersbrother.com/personal/) y entra a Módulos. Nicol usa la clave de Admin para acceder a Administración, Gestión y Preparación. El equipo de cocina usa una clave independiente, configurable desde Configuración general → Cambiar clave de Cocina. El cliente recibe un código al guardar su pedido en D1. Sus tres pedidos más recientes se conservan para seguimiento al recargar la misma pestaña.

El personal verifica el prepago de delivery antes de aprobar el pedido. La referencia ingresada por el cliente queda pendiente de verificación hasta ese momento. El inventario inicial contiene los insumos de la carta con existencias en cero.

## Desarrollo local

Usa Node.js 24. Instala las dependencias con `npm ci` y crea un archivo local `.dev.vars` con el valor `STAFF_PASSWORD` que usarás para las pruebas. Ejecuta `npm run db:migrate:local` una vez y después `npm run dev`.

Ejecuta `npm test` para correr las pruebas de la API con SQLite en memoria. Si cambias el HTML o las utilidades de Tailwind, ejecuta `npm run build:assets` y guarda también los archivos generados en `public/vendor`. Cloudflare sirve los estilos, iconos y generador de QR desde el propio POS.

## Cloudflare Pages

El proyecto está vinculado a GitHub y usa `main` para producción. `wrangler.toml` define la salida `public` y el vínculo D1 `DB`. Las funciones de Pages viven en `functions/api`.

Antes de publicar una versión con migraciones, ejecuta `npm run db:migrate:remote` desde un entorno autorizado en la cuenta de Cloudflare. Configura o rota la clave con `npx wrangler pages secret put STAFF_PASSWORD --project-name the-burgers-brother-pos` y publícala mediante un despliegue de Pages. Mantén la clave fuera de Git y compártela solamente con el personal autorizado.

`GET /api/health` comprueba la conexión al esquema D1. `GET /api/state` y `GET /api/orders` requieren una sesión de Admin. Cocina usa `/api/kitchen` para consultar sus comandas y `/api/kitchen/complete` para completarlas. En **Terminados** puede consultar las entregadas por código, mesa y fecha, en páginas de 20.

Las lecturas del personal envían un ETag de revisión y reciben una respuesta vacía cuando el estado no cambió. Las escrituras usan esa misma revisión de negocio para evitar que dos dispositivos se sobrescriban. Si hay un conflicto, el panel vuelve a consultar el servidor antes de admitir más cambios. La publicación conserva Pages y D1. El estado administrativo todavía usa un documento de 1,5 MB como máximo por guardado. Para crecer más allá de ese tamaño, se necesita separar los históricos del estado del turno mediante una migración comprobada.

## Impresión directa BIXOLON

Instala [BIXOLON Web Print SDK](https://es.bixolon.com/download_view.php?idx=14&s_key=SDK) en el equipo desde el que se imprimirá. Registra allí la SPP-R310 con el nombre lógico `Printer1` o introduce el nombre que elegiste en **Configurar BIXOLON**. En celular, empareja la variante Bluetooth y abre el POS en el navegador integrado del SDK. En PC, inicia el servicio local antes de abrir el POS.

En **Gestión → Caja**, abre una boleta y elige **Conectar impresora**. Cuando se verifique la conexión, pulsa **Imprimir directo**. Si el SDK tiene activado TLS, selecciona **HTTPS local en el SDK**. El POS usa el puerto local predeterminado 18080. El diálogo del sistema y el PDF siguen disponibles como opciones de impresión.

Activa el sonido desde Módulos, Configuración general o Preparación en cada dispositivo. El POS usa los sonidos locales de pedido nuevo, demora, pedido listo, cobro, confirmación y error. En Preparación se aplican el volumen y la pausa configurados. Los avisos se comprueban mientras el POS permanece abierto.
