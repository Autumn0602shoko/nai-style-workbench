const { app, BrowserWindow, ipcMain, shell } = require("electron");
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
      preload: path.join(__dirname, "preload.cjs"),
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
      `document.body.innerText.includes("画师串工作台") && document.body.innerText.includes("Danbooru 参考库") && typeof window.naiDesktop?.searchDanbooru === "function"`,
    );
    app.exit(ready ? 0 : 1);
  });

  window.loadFile(path.join(__dirname, "..", "desktop-dist", "renderer", "index.html"));
};

const fetchDanbooru = async ({ q = "", mode = "artist", tag = "" }) => {
  const query = String(q).trim().toLowerCase().replace(/\s+/g, "_");
  const chosen = String(tag).trim().toLowerCase();
  const options = { headers: { "User-Agent": "NAI-Style-Workbench/0.3" }, signal: AbortSignal.timeout(12_000) };
  const tagsUrl = new URL("https://danbooru.donmai.us/tags.json");
  tagsUrl.searchParams.set("limit", "8");
  tagsUrl.searchParams.set("search[name_matches]", `${query || chosen}*`);
  tagsUrl.searchParams.set("search[category]", mode === "tag" ? "0" : "1");
  tagsUrl.searchParams.set("search[order]", "count");
  const tagsResponse = await fetch(tagsUrl, options);
  if (!tagsResponse.ok) throw new Error(`Danbooru 返回 ${tagsResponse.status}`);
  const tags = await tagsResponse.json();
  const selectedTag = chosen || tags.find((item) => item.name === query)?.name || tags[0]?.name;
  if (!selectedTag) return { selectedTag: null, suggestions: [], posts: [] };

  const postsUrl = new URL("https://danbooru.donmai.us/posts.json");
  postsUrl.searchParams.set("limit", "18");
  postsUrl.searchParams.set("tags", `${selectedTag} rating:g`);
  const postsResponse = await fetch(postsUrl, options);
  if (!postsResponse.ok) throw new Error(`Danbooru 返回 ${postsResponse.status}`);
  const posts = await postsResponse.json();
  return {
    selectedTag,
    suggestions: tags.map((item) => ({ name: item.name, count: item.post_count })),
    posts: posts.filter((post) => post.rating === "g" && post.preview_file_url).map((post) => ({
      id: post.id,
      previewUrl: post.preview_file_url,
      imageUrl: post.large_file_url || post.file_url || post.preview_file_url,
      artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
      generalTags: (post.tag_string_general || "").split(" ").filter(Boolean).slice(0, 18),
      postUrl: `https://danbooru.donmai.us/posts/${post.id}`,
    })),
  };
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.nai.styleworkbench");
  ipcMain.handle("danbooru:search", async (_event, request) => fetchDanbooru(request));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
