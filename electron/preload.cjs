const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'projectOSDesktop',
  Object.freeze({
    getUpdateState: () => ipcRenderer.invoke('updates:state'),
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),
    installUpdate: () => ipcRenderer.invoke('updates:install'),
    getInstalledRelease: () => ipcRenderer.invoke('updates:release-notes'),
    acknowledgeInstalledRelease: () => ipcRenderer.invoke('updates:release-notes-read'),
    onUpdateState: (listener) => {
      const handler = (_event, state) => listener(state);
      ipcRenderer.on('updates:changed', handler);
      return () => ipcRenderer.removeListener('updates:changed', handler);
    },
  }),
);
