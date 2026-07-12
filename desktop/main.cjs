const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: "#f4f5f7",
    title: "画师串工作台",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return;
    const message = encodeURIComponent(`应用页面加载失败：${errorDescription}（${errorCode}）`);
    window.loadURL(`data:text/html;charset=utf-8,<meta charset="utf-8"><title>加载失败</title><style>body{font-family:sans-serif;padding:40px;color:%23192230}h1{font-size:22px}</style><h1>画师串工作台未能加载</h1><p>${message}</p>`);
  });

  window.webContents.on("did-finish-load", async () => {
    if (process.env.NAI_DESKTOP_SMOKE_TEST !== "1") return;
    const ready = await window.webContents.executeJavaScript(
      `document.body.innerText.includes("画师串工作台") && document.body.innerText.includes("粘贴与解析")`,
    );
    app.exit(ready ? 0 : 1);
  });

  window.loadFile(path.join(__dirname, "..", "desktop-dist", "renderer", "index.html"));
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.nai.styleworkbench");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
