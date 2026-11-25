import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { join } from 'node:path';

const pos = new URL('https://the-burgers-brother-pos.pages.dev/#personal');
const sdkDownloads = 'https://www.bixolon.com/download_view.php?idx=14&s_key=SDK';
let checking = false;

function createWindow() {
  const window = new BrowserWindow({
    title: 'The Burgers Brother',
    width: 1240,
    height: 840,
    minWidth: 420,
    minHeight: 520,
    backgroundColor: '#f5ecdc',
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== pos.origin) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (new URL(url).origin !== pos.origin) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    const link = new URL(url);
    if (link.protocol === 'https:' && ['www.bixolon.com', 'es.bixolon.com'].includes(link.hostname)) {
      void shell.openExternal(link.href);
    }
    return { action: 'deny' };
  });
  window.webContents.on('did-fail-load', (_event, error, _description, url, mainFrame) => {
    if (!mainFrame || error === -3 || new URL(url).origin !== pos.origin) return;
    void dialog.showMessageBox(window, {
      type: 'warning', buttons: ['Cerrar'],
      message: 'No se pudo abrir el POS.',
      detail: 'Comprueba la conexión a internet y usa Ver → Recargar.'
    });
  });
  void window.loadURL(pos.href).catch(() => {});
}

async function checkPrinter() {
  if (checking) return;
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return;
  checking = true;
  try {
    const sdk = app.isPackaged ? './printing/bixolon.js' : '../public/bixolon.js';
    const { runBixolon } = await import(new URL(sdk, import.meta.url).href);
    await runBixolon({ name: 'Printer1', secure: false });
    if (!window.isDestroyed()) await dialog.showMessageBox(window, {
      type: 'info',
      message: 'Printer1 verificada',
      detail: 'BIXOLON respondió a la consulta de estado. Abre una comanda en el POS para imprimir.'
    });
  } catch (error) {
    if (window.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(window, {
      type: 'warning',
      message: 'No se pudo verificar Printer1',
      detail: error.message + '\n\nAbre el Web Print SDK, confirma el nombre Printer1 y el puerto 18080. Si necesitas instalarlo, elige la versión oficial para ' + (process.platform === 'darwin' ? 'macOS' : 'Windows') + '.',
      buttons: ['Cerrar', 'Descargas oficiales'],
      cancelId: 0
    });
    if (response === 1) await shell.openExternal(sdkDownloads);
  } finally {
    checking = false;
  }
}

app.whenReady().then(() => {
  const template = [];
  if (process.platform === 'darwin') template.push({ role: 'appMenu' });
  template.push(
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Impresora', submenu: [
      { label: 'Verificar Printer1', click: () => void checkPrinter() },
      { label: 'Descargar Web Print SDK', click: () => void shell.openExternal(sdkDownloads) }
    ] }
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
