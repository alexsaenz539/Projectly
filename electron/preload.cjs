const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'projectOSDesktop',
  Object.freeze({
    getUpdateState: () => ipcRenderer.invoke('updates:state'),
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),
    installUpdate: () => ipcRenderer.invoke('updates:install'),
    onUpdateState: (listener) => {
      const handler = (_event, state) => listener(state);
      ipcRenderer.on('updates:changed', handler);
      return () => ipcRenderer.removeListener('updates:changed', handler);
    },
  }),
);
