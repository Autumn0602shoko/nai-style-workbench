const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

protocol.registerSchemesAsPrivileged([{ scheme: "nai-image", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

const proxiedImageUrl = (value) => `nai-image://cdn/load?url=${encodeURIComponent(value)}`;

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
        const dictionary = await window.naiDesktop.loadTagDictionary();
        const suggestions = await window.naiDesktop.suggestDanbooru({ q: "hona", mode: "artist" });
        const tagSuggestions = await window.naiDesktop.suggestDanbooru({ q: "pink_h", mode: "tag" });
        const data = await window.naiDesktop.searchDanbooru({ q: "honashi", mode: "artist", tag: "honashi", page: 1 });
        const pageTwo = await window.naiDesktop.searchDanbooru({ q: "honashi", mode: "artist", tag: "honashi", page: 2 });
        const thumbnailReady = await new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(true); image.onerror = () => resolve(false); image.src = data.posts[0]?.previewUrl || ""; });
        const character = await window.naiDesktop.searchDanbooru({ q: "mika_(blue_archive)", mode: "tag", page: 1 });
        const combo = await window.naiDesktop.searchDanbooru({ q: "", mode: "tag", combo: ["mika_(blue_archive)", "1girl"], page: 1 });
        return { ready: dictionary.entries?.halo === "光环" && suggestions.length > 2 && suggestions.some((item) => item.name === "honashi") && tagSuggestions.some((item) => item.name === "pink_hair") && data.selectedTag === "honashi" && data.totalCount > 24 && data.posts.length > 0 && pageTwo.selectedTag === "honashi" && pageTwo.posts.length > 0 && data.posts.every((post) => post.previewUrl.startsWith("nai-image://")) && thumbnailReady && character.selectedTag === "mika_(blue_archive)" && character.posts.length > 0 && combo.selectedTag === "mika_(blue_archive) 1girl" && combo.posts.length > 0, dictionaryVersion: dictionary.version, suggestions: suggestions.length, tagSuggestions: tagSuggestions.length, count: data.posts.length, totalCount: data.totalCount, pageTwoCount: pageTwo.posts.length, thumbnailReady, characterTag: character.selectedTag, characterCount: character.posts.length, comboTag: combo.selectedTag, comboCount: combo.posts.length, prefix: data.posts[0]?.previewUrl.slice(0, 24) };
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

const danbooruSearchCache = new Map();
const danbooruSuggestionCache = new Map();
const danbooruTagMetaCache = new Map();
const getCached = (cache, key, maxAge) => {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.time > maxAge) { cache.delete(key); return null; }
  return hit.value;
};
const setCached = (cache, key, value, maxEntries = 12) => {
  cache.set(key, { time: Date.now(), value });
  if (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  return value;
};

const fetchDanbooruResponse = async (url, timeoutMs = 18_000, retry = true) => {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "NAI-Style-Workbench/0.14.0" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok && response.status >= 500 && retry) return fetchDanbooruResponse(url, 30_000, false);
    return response;
  } catch (error) {
    if (retry) return fetchDanbooruResponse(url, 30_000, false);
    throw error;
  }
};

const fetchDanbooru = async ({ q = "", mode = "artist", tag = "", combo = [], page = 1 }) => {
  const query = String(q).trim().toLowerCase().replace(/\s+/g, "_");
  const comboTags = [...new Set((Array.isArray(combo) ? combo : []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  const chosen = comboTags.length ? comboTags.join(" ") : String(tag).trim().toLowerCase();
  const isCombo = comboTags.length > 0;
  const normalizedPage = Math.max(1, Math.min(1000, Number(page) || 1));
  const cacheKey = `${mode}:${chosen || query}:${normalizedPage}`;
  const cached = getCached(danbooruSearchCache, cacheKey, 2 * 60_000);
  if (cached) return cached;
  const tagsUrl = new URL("https://danbooru.donmai.us/tags.json");
  tagsUrl.searchParams.set("limit", "8");
  tagsUrl.searchParams.set("search[name_matches]", `${query || chosen}*`);
  if (mode !== "tag") tagsUrl.searchParams.set("search[category]", "1");
  tagsUrl.searchParams.set("search[order]", "count");
  const earlyPostsUrl = chosen ? new URL("https://danbooru.donmai.us/posts.json") : null;
  if (earlyPostsUrl) {
    earlyPostsUrl.searchParams.set("limit", "24");
    earlyPostsUrl.searchParams.set("page", String(normalizedPage));
    earlyPostsUrl.searchParams.set("tags", chosen);
  }
  const earlyPostsResponse = earlyPostsUrl ? fetchDanbooruResponse(earlyPostsUrl) : null;
  const cachedTagMeta = chosen ? getCached(danbooruTagMetaCache, chosen, 10 * 60_000) : null;
  const countPromise = chosen && !isCombo && !cachedTagMeta && normalizedPage === 1 ? (() => {
    const countUrl = new URL("https://danbooru.donmai.us/counts/posts.json");
    countUrl.searchParams.set("tags", chosen);
    return fetchDanbooruResponse(countUrl, 12_000, false)
      .then(async (response) => response.ok ? (await response.json()).counts?.posts || 0 : 0)
      .catch(() => 0);
  })() : null;
  const tagsResponse = isCombo || chosen ? null : await fetchDanbooruResponse(tagsUrl);
  if (tagsResponse && !tagsResponse.ok) throw new Error(`Danbooru 返回 ${tagsResponse.status}`);
  const tags = tagsResponse ? await tagsResponse.json() : [];
  const selectedTag = chosen || tags.find((item) => item.name === query)?.name || tags[0]?.name;
  if (!selectedTag) return { selectedTag: null, suggestions: [], posts: [] };
  tags.forEach((item) => setCached(danbooruTagMetaCache, item.name, { count: item.post_count }, 120));

  const postsUrl = earlyPostsUrl || new URL("https://danbooru.donmai.us/posts.json");
  if (!earlyPostsUrl) {
    postsUrl.searchParams.set("limit", "24");
    postsUrl.searchParams.set("page", String(normalizedPage));
    postsUrl.searchParams.set("tags", selectedTag);
  }
  const postsResponse = earlyPostsResponse ? await earlyPostsResponse : await fetchDanbooruResponse(postsUrl);
  if (!postsResponse.ok) throw new Error(`Danbooru 返回 ${postsResponse.status}`);
  const posts = await postsResponse.json();
  const visiblePosts = posts.filter((post) => post.preview_file_url);
  const mappedPosts = visiblePosts.map((post) => ({
        id: post.id,
        rating: post.rating,
        previewUrl: proxiedImageUrl(post.preview_file_url),
        imageUrl: post.large_file_url || post.file_url || post.preview_file_url,
        artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
        generalTags: (post.tag_string_general || "").split(" ").filter(Boolean),
        characterTags: (post.tag_string_character || "").split(" ").filter(Boolean),
        copyrightTags: (post.tag_string_copyright || "").split(" ").filter(Boolean),
        metaTags: (post.tag_string_meta || "").split(" ").filter(Boolean).slice(0, 12),
        postUrl: `https://danbooru.donmai.us/posts/${post.id}`,
  }));
  let totalCount = tags.find((item) => item.name === selectedTag)?.post_count || cachedTagMeta?.count || 0;
  if (!totalCount && countPromise) {
    totalCount = await countPromise;
    if (totalCount) setCached(danbooruTagMetaCache, selectedTag, { count: totalCount }, 120);
  }
  if (isCombo) {
    const countUrl = new URL("https://danbooru.donmai.us/counts/posts.json");
    countUrl.searchParams.set("tags", selectedTag);
    try {
      const countResponse = await fetchDanbooruResponse(countUrl);
      if (countResponse.ok) totalCount = (await countResponse.json()).counts?.posts || 0;
    } catch {}
  }
  return setCached(danbooruSearchCache, cacheKey, {
    selectedTag,
    totalCount,
    suggestions: tags.map((item) => ({ name: item.name, count: item.post_count })),
    posts: mappedPosts,
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.nai.styleworkbench");
  protocol.handle("nai-image", async (request) => {
    try {
      const source = new URL(request.url).searchParams.get("url");
      const imageUrl = new URL(String(source));
      if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "cdn.donmai.us") return new Response(null, { status: 404 });
      return net.fetch(imageUrl.toString(), { headers: { "User-Agent": "NAI-Style-Workbench/0.14.0" } });
    } catch { return new Response(null, { status: 404 }); }
  });
  ipcMain.handle("danbooru:search", async (_event, request) => fetchDanbooru(request));
  ipcMain.handle("danbooru:suggest", async (_event, { q = "", mode = "artist" }) => {
    const query = String(q).trim().toLowerCase().replace(/\s+/g, "_");
    if (query.length < 2) return [];
    const cacheKey = `${mode}:${query}`;
    const cached = getCached(danbooruSuggestionCache, cacheKey, 5 * 60_000);
    if (cached) return cached;
    const url = new URL("https://danbooru.donmai.us/tags.json");
    url.searchParams.set("limit", "30");
    url.searchParams.set("search[name_matches]", `*${query}*`);
    if (mode !== "tag") url.searchParams.set("search[category]", "1");
    url.searchParams.set("search[order]", "count");
    const response = await fetchDanbooruResponse(url, 15_000);
    if (!response.ok) throw new Error(`Danbooru 返回 ${response.status}`);
    const matchedTags = await response.json();
    matchedTags.forEach((item) => setCached(danbooruTagMetaCache, item.name, { count: item.post_count }, 120));
    const suggestions = matchedTags
      .sort((left, right) => Number(right.name.startsWith(query)) - Number(left.name.startsWith(query)) || right.post_count - left.post_count)
      .map((item) => ({ name: item.name, count: item.post_count }));
    return setCached(danbooruSuggestionCache, cacheKey, suggestions, 60);
  });
  ipcMain.handle("danbooru:image", async (_event, value) => {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.hostname !== "cdn.donmai.us") throw new Error("不支持的图片地址");
    const response = await fetch(url, { headers: { "User-Agent": "NAI-Style-Workbench/0.5" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`图片加载失败 ${response.status}`);
    const type = response.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  });
  ipcMain.handle("translations:dictionary", async () => {
    try {
      const response = await fetchDanbooruResponse(new URL("https://raw.githubusercontent.com/Autumn0602shoko/nai-style-workbench/main/public/tag-translations.zh-CN.json"), 12_000, false);
      if (response.ok) return response.json();
    } catch {}
    return JSON.parse(await readFile(path.join(__dirname, "..", "public", "tag-translations.zh-CN.json"), "utf8"));
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
