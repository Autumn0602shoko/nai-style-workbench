const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naiDesktop", {
  searchDanbooru: (request) => ipcRenderer.invoke("danbooru:search", request),
  suggestDanbooru: (request) => ipcRenderer.invoke("danbooru:suggest", request),
  loadDanbooruImage: (url) => ipcRenderer.invoke("danbooru:image", url),
  loadTagDictionary: () => ipcRenderer.invoke("translations:dictionary"),
  lookupTranslation: (tag) => ipcRenderer.invoke("translations:lookup", tag),
});
