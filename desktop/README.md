# The Burgers Brother para escritorio

El piloto abre el acceso de personal del POS publicado. La carta por QR y los datos siguen en Cloudflare. Se requiere internet para operar el POS.

## Windows

Instala el piloto con el archivo de instalación de Windows de 64 bits. En la aplicación, abre **Impresora → Verificar Printer1**. La comprobación consulta el nombre lógico **Printer1** en el puerto local 18080 mediante HTTP. Si el SDK usa HTTPS o un nombre distinto, prueba la conexión desde **Configurar BIXOLON** en la ventana de impresión del POS.

Si falta el SDK, abre **Impresora → Descargar Web Print SDK** y selecciona la versión de Windows. Registra la SPP-R310 en el SDK y ejecuta **Test Print** antes de imprimir una comanda o boleta desde el POS.

## Compilación

Desde esta carpeta, ejecuta `npm ci`. Usa `npm run start` para desarrollo y `npm run build:win` en Windows para el instalador de 64 bits. El piloto local se genera sin firma.

En una Mac con las herramientas de firma de Apple, usa `npm run build:mac` para generar un DMG universal. Para distribución, configura la firma Developer ID y la notarización mediante las variables de entorno de electron-builder. Valida en la Mac de Administración el SDK de macOS y el Test Print de BIXOLON antes de aprobar esa versión.

El Web Print SDK se obtiene desde BIXOLON. Su distribución con el instalador del POS queda sujeta a la autorización del fabricante.
