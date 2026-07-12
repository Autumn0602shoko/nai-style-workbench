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
    try {
      const result = await window.webContents.executeJavaScript(
      `(async () => {
        if (typeof window.naiDesktop?.searchDanbooru !== "function") return { ready: false, reason: "bridge" };
        const data = await window.naiDesktop.searchDanbooru({ q: "honashi", mode: "artist", page: 1 });
        return { ready: data.selectedTag === "honashi" && data.posts.length > 0 && data.posts.every((post) => post.previewUrl.startsWith("data:image/")), count: data.posts.length, prefix: data.posts[0]?.previewUrl.slice(0, 24) };
      })()`,
      );
      console.log("NAI_SMOKE_RESULT", JSON.stringify(result));
      app.exit(result.ready ? 0 : 1);
    } catch (error) {
      console.error("NAI_SMOKE_ERROR", error);
      app.exit(2);
    }
  });

  window.loadFile(path.join(__dirname, "..", "desktop-dist", "renderer", "index.html"));
};

const fetchDanbooru = async ({ q = "", mode = "artist", tag = "", page = 1 }) => {
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
  postsUrl.searchParams.set("limit", "24");
  postsUrl.searchParams.set("page", String(Math.max(1, Math.min(1000, Number(page) || 1))));
  postsUrl.searchParams.set("tags", selectedTag);
  const postsResponse = await fetch(postsUrl, options);
  if (!postsResponse.ok) throw new Error(`Danbooru 返回 ${postsResponse.status}`);
  const posts = await postsResponse.json();
  const visiblePosts = posts.filter((post) => post.preview_file_url);
  const mappedPosts = await Promise.all(visiblePosts.map(async (post) => {
    try {
      const imageResponse = await fetch(post.preview_file_url, { headers: options.headers, signal: AbortSignal.timeout(20_000) });
      if (!imageResponse.ok) return null;
      const type = imageResponse.headers.get("content-type") || "image/jpeg";
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      return {
        id: post.id,
        rating: post.rating,
        previewUrl: `data:${type};base64,${bytes.toString("base64")}`,
        imageUrl: post.large_file_url || post.file_url || post.preview_file_url,
        artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
        generalTags: (post.tag_string_general || "").split(" ").filter(Boolean).slice(0, 18),
        characterTags: (post.tag_string_character || "").split(" ").filter(Boolean),
        copyrightTags: (post.tag_string_copyright || "").split(" ").filter(Boolean),
        metaTags: (post.tag_string_meta || "").split(" ").filter(Boolean).slice(0, 12),
        postUrl: `https://danbooru.donmai.us/posts/${post.id}`,
      };
    } catch { return null; }
  }));
  return {
    selectedTag,
    suggestions: tags.map((item) => ({ name: item.name, count: item.post_count })),
    posts: mappedPosts.filter(Boolean),
  };
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.nai.styleworkbench");
  ipcMain.handle("danbooru:search", async (_event, request) => fetchDanbooru(request));
  ipcMain.handle("danbooru:image", async (_event, value) => {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.hostname !== "cdn.donmai.us") throw new Error("不支持的图片地址");
    const response = await fetch(url, { headers: { "User-Agent": "NAI-Style-Workbench/0.5" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`图片加载失败 ${response.status}`);
    const type = response.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
