const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naiDesktop", {
  searchDanbooru: (request) => ipcRenderer.invoke("danbooru:search", request),
});
