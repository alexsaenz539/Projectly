const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');
const { NsisUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');
const { existsSync, mkdirSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createUpdateController } = require('./update-controller.cjs');
const { resolveAsset, trustedSender } = require('./security.cjs');
const { releaseType, ...feed } = require('./updates.config.json');
const dev = !app.isPackaged && process.argv.includes('--dev');
const smoke = !app.isPackaged && process.argv.includes('--smoke-test');
const origin = dev ? 'http://127.0.0.1:4500' : null;
const entry = origin || 'projectos://app/';
// Keep existing desktop data when changing the visible product name.
const profileNames = app.isPackaged ? ['Project OS', 'project-os'] : ['project-os', 'Project OS'];
const previousProfile = profileNames
  .map((name) => path.join(app.getPath('appData'), name))
  .find(existsSync);
const profile = previousProfile || path.join(app.getPath('appData'), 'Projectly');
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
let window = null,
  controller = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'projectos',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const root = path.join(app.getAppPath(), 'dist', 'project-os', 'browser');
      const policy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'";
      protocol.handle('projectos', async (request) => {
        if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
        const file = resolveAsset(root, request.url);
        if (!file) return new Response('Forbidden', { status: 403 });
        try {
          await fs.access(file);
          const response = await net.fetch(pathToFileURL(file).href);
          const headers = new Headers(response.headers);
          headers.set('Content-Security-Policy', policy);
          return new Response(response.body, { status: response.status, headers });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      });
      controller = createUpdateController({
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        makeUpdater: () => new NsisUpdater(feed),
        publishState: (state) => {
          if (window && !window.isDestroyed()) window.webContents.send('updates:changed', state);
        },
      });
      const secureHandle = (channel, handler) =>
        ipcMain.handle(channel, (event, ...args) => {
          if (!trustedSender(event, window, origin)) throw new Error('Solicitud no permitida.');
          return handler(...args);
        });
      secureHandle('updates:state', () => controller.state());
      secureHandle('updates:check', () => controller.check());
      secureHandle('updates:install', () => controller.install());
      await controller.start();
      async function createWindow() {
        window = new BrowserWindow({
          width: 1360,
          height: 920,
          minWidth: 780,
          minHeight: 600,
          show: false,
          title: 'Projectly',
          backgroundColor: '#FAFAF9',
          icon: path.join(root, 'brand', 'app-icon-512x512.png'),
          webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        });
        Menu.setApplicationMenu(null);
        window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
          callback(false),
        );
        window.webContents.session.setPermissionCheckHandler(() => false);
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (event, url) => {
          const parsed = new URL(url);
          if (
            dev
              ? parsed.origin !== origin
              : parsed.protocol !== 'projectos:' || parsed.host !== 'app'
          )
            event.preventDefault();
        });
        window.on('closed', () => {
          window = null;
        });
        window.once('ready-to-show', () => {
          if (!smoke) window.show();
        });
        await window.loadURL(entry);
        if (smoke) {
          const result = await window.webContents.executeJavaScript(
            `new Promise((resolve,reject)=>{const end=Date.now()+15000;const poll=async()=>{if(document.querySelector('h1')&&window.projectOSDesktop){const state=await window.projectOSDesktop.getUpdateState();resolve({title:document.querySelector('h1').textContent,desktop:true,status:state.status,nodeUnavailable:typeof window.require==='undefined'});}else if(Date.now()>end)reject(new Error('La aplicación no cargó.'));else setTimeout(poll,50);};poll();})`,
          );
          console.log(JSON.stringify({ smoke: result }));
          app.quit();
        }
      }
      await createWindow();
      app.on('activate', () => {
        if (!window) void createWindow();
      });
    })
    .catch(() => {
      console.error('No se pudo iniciar Projectly.');
      app.exit(1);
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => controller?.dispose());
}
