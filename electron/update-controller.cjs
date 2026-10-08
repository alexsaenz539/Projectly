// Framework-independent update lifecycle: testable without downloading an installer.
function createUpdateController({
  version,
  isPackaged,
  makeUpdater,
  publishState,
  now = () => Date.now(),
  schedule = setInterval,
  cancelSchedule = clearInterval,
}) {
  let state = {
    status: isPackaged ? 'idle' : 'development',
    currentVersion: version,
    availableVersion: null,
    progress: 0,
    message: isPackaged
      ? 'Puedes buscar nuevas versiones.'
      : 'Las actualizaciones se activan en la aplicación instalada.',
    enabled: isPackaged,
    lastCheckedAt: null,
  };
  let updater = null,
    activeCheck = null,
    timer = null,
    lastAttempt = null,
    started = false;
  const listeners = [];
  function set(patch) {
    state = { ...state, ...patch };
    publishState({ ...state });
  }
  function detach() {
    if (updater) for (const [name, fn] of listeners) updater.removeListener(name, fn);
    listeners.length = 0;
    updater = null;
  }
  function configure() {
    detach();
    if (!isPackaged) {
      set({
        status: 'development',
        message: 'Las actualizaciones se activan en la aplicación instalada.',
      });
      return;
    }
    updater = makeUpdater();
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    // Forward concise user messages rather than low-level request details.
    updater.logger = null;
    const on = (name, fn) => {
      listeners.push([name, fn]);
      updater.on(name, fn);
    };
    on('checking-for-update', () =>
      set({ status: 'checking', message: 'Buscando nuevas versiones…' }),
    );
    on('update-available', (info) =>
      set({
        status: 'downloading',
        availableVersion: info.version,
        progress: 0,
        message: 'Descargando actualización…',
      }),
    );
    on('download-progress', (info) =>
      set({
        status: 'downloading',
        progress: Math.max(0, Math.min(100, Math.round(info.percent || 0))),
        message: 'Descargando actualización…',
      }),
    );
    on('update-not-available', () =>
      set({
        status: 'up-to-date',
        availableVersion: null,
        progress: 0,
        message: 'Tienes la versión más reciente.',
        lastCheckedAt: new Date(now()).toISOString(),
      }),
    );
    on('update-downloaded', (info) =>
      set({
        status: 'ready',
        availableVersion: info.version,
        progress: 100,
        message: 'La actualización está lista para instalar.',
      }),
    );
    on('update-cancelled', () =>
      set({
        status: 'idle',
        progress: 0,
        message: 'La descarga se canceló. Puedes buscar nuevamente.',
      }),
    );
    on('error', () =>
      set({
        status: 'error',
        message:
          'No se pudo actualizar. Revisa tu conexión, el acceso a GitHub y los archivos del lanzamiento.',
      }),
    );
    set({ status: 'idle', message: 'Puedes buscar nuevas versiones.' });
  }
  async function check() {
    if (!updater || ['downloading', 'ready', 'installing'].includes(state.status))
      return { ...state };
    if (activeCheck) return activeCheck;
    if (lastAttempt !== null && now() - lastAttempt < 30_000) return { ...state };
    lastAttempt = now();
    set({
      status: 'checking',
      message: 'Buscando nuevas versiones…',
      lastCheckedAt: new Date(now()).toISOString(),
    });
    const current = updater;
    activeCheck = Promise.resolve().then(async () => {
      try {
        const result = await current.checkForUpdates();
        // electron-updater starts downloading separately; consume rejections too.
        if (result?.downloadPromise)
          result.downloadPromise.catch(() => {
            if (current === updater)
              set({
                status: 'error',
                message: 'No se pudo descargar la actualización. Inténtalo nuevamente.',
              });
          });
      } catch {
        if (current === updater)
          set({
            status: 'error',
            message:
              'No se pudo buscar la actualización. Revisa tu conexión y tu acceso al repositorio.',
          });
      } finally {
        activeCheck = null;
      }
      return { ...state };
    });
    return activeCheck;
  }
  return {
    state: () => ({ ...state }),
    check,
    async start() {
      if (started) return;
      started = true;
      try {
        configure();
      } catch {
        set({ status: 'error', message: 'No se pudo iniciar el actualizador.' });
      }
      if (isPackaged) {
        void check();
        timer = schedule(
          () => {
            void check();
          },
          60 * 60 * 1000,
        );
        timer?.unref?.();
      }
    },
    install() {
      if (!updater || state.status !== 'ready')
        return { ok: false, message: 'Todavía no hay una actualización lista para instalar.' };
      const current = updater;
      set({
        status: 'installing',
        message: 'Instalando actualización. La aplicación se reiniciará…',
      });
      try {
        current.quitAndInstall(false, true);
        return { ok: true };
      } catch {
        set({
          status: 'ready',
          message: 'No se pudo iniciar la instalación. Inténtalo nuevamente.',
        });
        return { ok: false, message: state.message };
      }
    },
    dispose() {
      if (timer) cancelSchedule(timer);
      detach();
    },
  };
}
module.exports = { createUpdateController };
