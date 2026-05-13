const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),
  readImage: () => ipcRenderer.invoke('file:readImage'),
  readVideo: () => ipcRenderer.invoke('file:readVideo'),
  geminiGenerate: (payload) => ipcRenderer.invoke('gemini:generate', payload),
  saveText: (payload) => ipcRenderer.invoke('file:saveText', payload)
});
