import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUpdateController } = require('../electron/update-controller.cjs');
const { resolveAsset, trustedSender } = require('../electron/security.cjs');
const path = require('node:path');

function fixture({ isPackaged = true, implementation } = {}) {
  const updater = new EventEmitter();
  let checks = 0,
    installs = 0,
    clock = 100_000,
    interval;
  updater.checkForUpdates = () => {
    checks++;
    return implementation ? implementation(updater) : Promise.resolve({});
  };
  updater.quitAndInstall = (silent, relaunch) => {
    assert.equal(silent, false);
    assert.equal(relaunch, true);
    installs++;
  };
  const states = [];
  const controller = createUpdateController({
    version: '0.1.0',
    isPackaged,
    makeUpdater: () => updater,
    publishState: (s) => states.push(s),
    now: () => clock,
    schedule: (callback) => {
      interval = callback;
      return { unref() {} };
    },
    cancelSchedule: () => {
      interval = null;
    },
  });
  return {
    controller,
    updater,
    states,
    checks: () => checks,
    installs: () => installs,
    advance: () => {
      clock += 31_000;
    },
    hour: () => interval?.(),
  };
}
test('El actualizador descarga y solo instala después de una descarga verificada', async () => {
  const f = fixture();
  await f.controller.start();
  await f.controller.check();
  assert.equal(f.updater.autoDownload, true);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false);
  assert.equal(f.updater.allowPrerelease, false);
  assert.equal(f.controller.install().ok, false);
  assert.equal(f.installs(), 0);
  f.updater.emit('update-available', { version: '0.1.1' });
  f.updater.emit('download-progress', { percent: 47.3 });
  assert.equal(f.controller.state().status, 'downloading');
  assert.equal(f.controller.state().progress, 47);
  assert.equal(f.controller.install().ok, false);
  f.updater.emit('update-downloaded', { version: '0.1.1' });
  assert.equal(f.controller.state().status, 'ready');
  assert.equal(f.controller.state().progress, 100);
  assert.equal(f.controller.install().ok, true);
  assert.equal(f.installs(), 1);
  assert.equal(f.controller.install().ok, false);
  assert.equal(f.installs(), 1);
  f.controller.dispose();
});
test('Evita verificaciones simultáneas y controla búsquedas periódicas', async () => {
  let finish;
  const f = fixture({
    implementation: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await f.controller.start();
  void f.controller.check();
  void f.controller.check();
  assert.equal(f.checks(), 1);
  finish({});
  await new Promise((resolve) => setImmediate(resolve));
  await f.controller.check();
  assert.equal(f.checks(), 1);
  f.advance();
  f.hour();
  await Promise.resolve();
  assert.equal(f.checks(), 2);
  finish({});
  await new Promise((resolve) => setImmediate(resolve));
  f.controller.dispose();
  f.hour();
  assert.equal(f.checks(), 2);
  assert.equal(f.updater.listenerCount('update-downloaded'), 0);
});
test('El modo de desarrollo no busca ni instala actualizaciones', async () => {
  const f = fixture({ isPackaged: false });
  await f.controller.start();
  await f.controller.check();
  assert.equal(f.controller.state().status, 'development');
  assert.equal(f.controller.state().enabled, false);
  assert.equal(f.checks(), 0);
  assert.equal(f.controller.install().ok, false);
  f.controller.dispose();
});
test('Los errores de red permiten reintentar sin mostrar detalles internos', async () => {
  const f = fixture({
    implementation: () => Promise.reject(new Error('sensitive internal details')),
  });
  await f.controller.start();
  await f.controller.check();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.controller.state().status, 'error');
  assert.doesNotMatch(f.controller.state().message, /sensitive/);
  f.advance();
  f.updater.checkForUpdates = async () => {
    f.updater.emit('update-not-available', { version: '0.1.0' });
    return {};
  };
  await f.controller.check();
  assert.equal(f.controller.state().status, 'up-to-date');
  f.controller.dispose();
});
test('Una búsqueda que falla inmediatamente puede volver a intentarse', async () => {
  const f = fixture({
    implementation: () => {
      throw new Error('failure');
    },
  });
  await f.controller.start();
  await f.controller.check();
  assert.equal(f.controller.state().status, 'error');
  assert.equal(f.checks(), 1);
  f.advance();
  await f.controller.check();
  assert.equal(f.checks(), 2);
  f.controller.dispose();
});
test('Una descarga fallida no deja habilitada la instalación', async () => {
  const f = fixture({
    implementation: (updater) => {
      updater.emit('update-available', { version: '0.1.1' });
      return Promise.resolve({ downloadPromise: Promise.reject(new Error('download failed')) });
    },
  });
  await f.controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.controller.state().status, 'error');
  assert.equal(f.controller.install().ok, false);
  f.controller.dispose();
});
test('Una instalación fallida informa el error y permite reintentar', async () => {
  const f = fixture();
  await f.controller.start();
  await f.controller.check();
  f.updater.emit('update-downloaded', { version: '0.1.1' });
  f.updater.quitAndInstall = () => {
    throw new Error('failed');
  };
  assert.equal(f.controller.install().ok, false);
  assert.equal(f.controller.state().status, 'ready');
  f.controller.dispose();
});
test('El protocolo sirve rutas Angular y bloquea acceso fuera del paquete', () => {
  const root = path.resolve('test-root');
  assert.equal(resolveAsset(root, 'projectos://app/settings'), path.join(root, 'index.html'));
  assert.equal(resolveAsset(root, 'projectos://app/main.js'), path.join(root, 'main.js'));
  assert.equal(resolveAsset(root, 'https://other.test/main.js'), null);
  assert.equal(resolveAsset(root, 'projectos://other/main.js'), null);
  assert.equal(resolveAsset(root, 'projectos://app/%2e%2e%2fsecret.txt'), null);
  assert.equal(resolveAsset(root, 'projectos://app/%5c..%5csecret.txt'), null);
  assert.equal(resolveAsset(root, 'projectos://app/%00secret'), null);
});
test('IPC solo acepta la ventana principal y su origen esperado', () => {
  const mainFrame = { url: 'projectos://app/settings' },
    webContents = { mainFrame };
  const window = { webContents, isDestroyed: () => false };
  assert.equal(trustedSender({ sender: webContents, senderFrame: mainFrame }, window, null), true);
  assert.equal(trustedSender({ sender: {}, senderFrame: mainFrame }, window, null), false);
  assert.equal(
    trustedSender({ sender: webContents, senderFrame: { url: 'projectos://app/' } }, window, null),
    false,
  );
  mainFrame.url = 'https://other.test';
  assert.equal(trustedSender({ sender: webContents, senderFrame: mainFrame }, window, null), false);
  mainFrame.url = 'http://127.0.0.1:4500/settings';
  assert.equal(
    trustedSender({ sender: webContents, senderFrame: mainFrame }, window, 'http://127.0.0.1:4500'),
    true,
  );
  mainFrame.url = 'http://127.0.0.1:9999/settings';
  assert.equal(
    trustedSender({ sender: webContents, senderFrame: mainFrame }, window, 'http://127.0.0.1:4500'),
    false,
  );
});
