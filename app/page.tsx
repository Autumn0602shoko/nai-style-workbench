"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { parseArtistTags } from "./artist-parser";
import { createWeightExperiments } from "./weight-experiments";

type Artist = { id: string; name: string; weight: number; enabled: boolean; locked?: boolean };
type Recipe = {
  id: string;
  name: string;
  artists: Artist[];
  suffix: string;
  images: string[];
  createdAt: number;
};
type DanbooruPost = { id: number; rating: string; previewUrl: string; imageUrl: string; postUrl: string; artistTags: string[]; generalTags: string[]; characterTags: string[]; copyrightTags: string[]; metaTags: string[] };
type DanbooruResult = { selectedTag: string | null; totalCount?: number; suggestions: { name: string; count: number }[]; posts: DanbooruPost[]; error?: string };

declare global {
  interface Window {
    naiDesktop?: { searchDanbooru: (request: { q: string; mode: "artist" | "tag"; tag?: string; page?: number }) => Promise<DanbooruResult>; suggestDanbooru: (request: { q: string; mode: "artist" | "tag" }) => Promise<{ name: string; count: number }[]>; loadDanbooruImage: (url: string) => Promise<string> };
  }
}

const sample = `1.2::artist:honashi::, 1.25::artist:satou kuuki::,
1.13::artist:jackdempa::, 0.8::artist:dk.senie::,
artist:takano suzu, year 2024, year 2025`;

const uid = () => Math.random().toString(36).slice(2, 10);

function formatWeight(value: number) {
  return Number(value.toFixed(2)).toString();
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const max = 720;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [raw, setRaw] = useState(sample);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [recipeName, setRecipeName] = useState("未命名画师串");
  const [suffix, setSuffix] = useState("year 2024, year 2025, full color, natural colors");
  const [images, setImages] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [notice, setNotice] = useState("");
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [experimentAmplitude, setExperimentAmplitude] = useState(0.2);
  const [booruQuery, setBooruQuery] = useState("");
  const [booruMode, setBooruMode] = useState<"artist" | "tag">("artist");
  const [booruResult, setBooruResult] = useState<DanbooruResult | null>(null);
  const [booruLoading, setBooruLoading] = useState(false);
  const [booruPage, setBooruPage] = useState(1);
  const [booruPageInput, setBooruPageInput] = useState("1");
  const [autocomplete, setAutocomplete] = useState<{ name: string; count: number }[]>([]);
  const [activeView, setActiveView] = useState<"workbench" | "danbooru" | "favorites">("workbench");
  const [favorites, setFavorites] = useState<DanbooruPost[]>([]);
  const [focusedPost, setFocusedPost] = useState<DanbooruPost | null>(null);
  const [pinnedPostId, setPinnedPostId] = useState<number | null>(null);
  const [detailImage, setDetailImage] = useState("");
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailRequestId = useRef(0);
  const importRecipesRef = useRef<HTMLInputElement>(null);
  const autocompleteCache = useRef(new Map<string, { name: string; count: number }[]>());

  useEffect(() => {
    try {
      setRecipes(JSON.parse(localStorage.getItem("nai-style-recipes") || "[]"));
    } catch {
      setRecipes([]);
    }
    try { setFavorites(JSON.parse(localStorage.getItem("nai-style-favorites") || "[]")); } catch { setFavorites([]); }
  }, []);

  useEffect(() => {
    const query = booruQuery.trim();
    if (query.length < 2) { setAutocomplete([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const cacheKey = `${booruMode}:${query.toLowerCase().replace(/\s+/g, "_")}`;
        const cached = autocompleteCache.current.get(cacheKey);
        if (cached) { if (!cancelled) setAutocomplete(cached); return; }
        let suggestions: { name: string; count: number }[];
        if (window.naiDesktop) suggestions = await window.naiDesktop.suggestDanbooru({ q: query, mode: booruMode });
        else {
          const params = new URLSearchParams({ q: query, mode: booruMode, suggest: "1" });
          const response = await fetch(`/api/danbooru?${params}`);
          const data = await response.json() as { suggestions: { name: string; count: number }[] };
          suggestions = data.suggestions || [];
        }
        autocompleteCache.current.set(cacheKey, suggestions);
        if (!cancelled) setAutocomplete(suggestions);
      } catch { if (!cancelled) setAutocomplete([]); }
    }, 320);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [booruQuery, booruMode]);

  const prompt = useMemo(() => {
    const artistPart = artists
      .filter((artist) => artist.enabled)
      .map((artist) => `${formatWeight(artist.weight)}::artist:${artist.name}::`)
      .join(", ");
    return [artistPart, suffix.trim()].filter(Boolean).join(", ");
  }, [artists, suffix]);

  const experiments = useMemo(
    () => createWeightExperiments(artists, experimentAmplitude),
    [artists, experimentAmplitude],
  );

  const promptForWeights = (weights: number[]) => {
    const artistPart = artists
      .filter((artist) => artist.enabled)
      .map((artist) => `${formatWeight(weights[artists.indexOf(artist)])}::artist:${artist.name}::`)
      .join(", ");
    return [artistPart, suffix.trim()].filter(Boolean).join(", ");
  };

  const parse = () => {
    const next = parseArtistTags(raw).map((artist) => ({ ...artist, id: uid(), enabled: true }));
    setArtists(next);
    setNotice(next.length ? `已提取 ${next.length} 位画师` : "没有识别到 artist: 画师标签");
  };

  const updateArtist = (id: string, patch: Partial<Artist>) =>
    setArtists((current) => current.map((artist) => (artist.id === id ? { ...artist, ...patch } : artist)));

  const persistRecipes = (next: Recipe[]) => {
    setRecipes(next);
    localStorage.setItem("nai-style-recipes", JSON.stringify(next));
  };

  const saveRecipe = () => {
    const recipe: Recipe = { id: activeRecipeId || uid(), name: recipeName.trim() || "未命名画师串", artists, suffix, images, createdAt: Date.now() };
    const next = activeRecipeId
      ? [recipe, ...recipes.filter((item) => item.id !== activeRecipeId)]
      : [recipe, ...recipes];
    persistRecipes(next);
    setActiveRecipeId(recipe.id);
    setNotice(activeRecipeId ? "配方已更新" : "配方已保存到当前浏览器");
  };

  const loadRecipe = (recipe: Recipe) => {
    setRecipeName(recipe.name);
    setArtists(recipe.artists.map((artist) => ({ ...artist, id: uid() })));
    setSuffix(recipe.suffix);
    setImages(recipe.images);
    setActiveRecipeId(recipe.id);
    setNotice(`已载入「${recipe.name}」`);
  };

  const removeRecipe = (id: string) => {
    const next = recipes.filter((recipe) => recipe.id !== id);
    persistRecipes(next);
    if (activeRecipeId === id) setActiveRecipeId(null);
  };

  const addImages = async (incoming: File[]) => {
    const files = incoming.filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 6 - images.length));
    const next = await Promise.all(files.map(resizeImage));
    setImages((current) => [...current, ...next].slice(0, 6));
    setNotice(next.length ? `已导入 ${next.length} 张参考图` : "没有可导入的图片");
  };

  const importImages = async (event: ChangeEvent<HTMLInputElement>) => {
    await addImages(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const dropImages = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    await addImages(Array.from(event.dataTransfer.files));
  };

  const moveArtist = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= artists.length) return;
    setArtists((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const exportRecipes = () => {
    const blob = new Blob([JSON.stringify({ version: 1, recipes }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `画师串配方-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice(`已导出 ${recipes.length} 个配方`);
  };

  const importRecipes = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.recipes;
      if (!Array.isArray(incoming)) throw new Error("invalid");
      const valid = incoming.filter((item): item is Recipe => item && typeof item.name === "string" && Array.isArray(item.artists));
      const merged = [...valid, ...recipes.filter((recipe) => !valid.some((item) => item.id === recipe.id))];
      persistRecipes(merged);
      setNotice(`已导入 ${valid.length} 个配方`);
    } catch {
      setNotice("导入失败：请选择工作台导出的 JSON 文件");
    }
  };

  const filteredRecipes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return recipes;
    return recipes.filter((recipe) => `${recipe.name} ${recipe.artists.map((artist) => artist.name).join(" ")}`.toLowerCase().includes(keyword));
  }, [recipes, search]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setNotice("新版 Prompt 已复制");
  };

  const applyExperiment = (weights: number[], name: string) => {
    setArtists((current) => current.map((artist, index) => ({ ...artist, weight: weights[index] })));
    setActiveRecipeId(null);
    setRecipeName(`${recipeName.replace(/ · .+$/, "")} · ${name}`);
    setNotice(`已应用「${name}」，可继续微调或保存为新配方`);
  };

  const copyExperiment = async (weights: number[], name: string) => {
    await navigator.clipboard.writeText(promptForWeights(weights));
    setNotice(`「${name}」Prompt 已复制`);
  };

  const searchDanbooru = async (tag?: string, page = 1) => {
    if (!booruQuery.trim() && !tag) return;
    setBooruLoading(true);
    try {
      let data: DanbooruResult;
      if (window.naiDesktop) {
        data = await window.naiDesktop.searchDanbooru({ q: booruQuery, mode: booruMode, tag, page });
      } else {
        const params = new URLSearchParams({ q: booruQuery, mode: booruMode });
        if (tag) params.set("tag", tag);
        params.set("page", String(page));
        const response = await fetch(`/api/danbooru?${params}`);
        data = await response.json() as DanbooruResult;
        if (!response.ok) throw new Error(data.error || "查询失败");
      }
      setBooruResult(data);
      setBooruPage(page);
      setBooruPageInput(String(page));
      setAutocomplete([]);
      setNotice(data.posts.length ? `已载入第 ${page} 页，共 ${data.posts.length} 张参考图` : "这一页没有参考图");
    } catch (error) {
      setBooruResult({ selectedTag: null, suggestions: [], posts: [], error: error instanceof Error ? error.message : "查询失败" });
      setNotice("Danbooru 查询失败，请稍后重试");
    } finally {
      setBooruLoading(false);
    }
  };

  const totalBooruPages = Math.max(1, Math.ceil((booruResult?.totalCount || 0) / 24));
  const jumpBooruPage = () => {
    const page = Math.max(1, Math.min(totalBooruPages, Number(booruPageInput) || 1));
    searchDanbooru(booruResult?.selectedTag || undefined, page);
  };

  const useDanbooruTag = (tag: string) => {
    const normalized = tag.replace(/_/g, " ");
    if (booruMode === "artist") {
      if (!artists.some((artist) => artist.name.toLowerCase() === normalized.toLowerCase())) {
        setArtists((current) => [...current, { id: uid(), name: normalized, weight: 1, enabled: true }]);
      }
      setNotice(`已把画师 ${normalized} 加入当前画师串`);
    } else {
      const readable = tag.replace(/_/g, " ");
      setSuffix((current) => current.split(",").map((item) => item.trim()).includes(readable) ? current : [current.trim(), readable].filter(Boolean).join(", "));
      setNotice(`已把提示词 ${readable} 加入通用提示词`);
    }
  };

  const toggleFavorite = (post: DanbooruPost) => {
    const next = favorites.some((item) => item.id === post.id) ? favorites.filter((item) => item.id !== post.id) : [post, ...favorites];
    setFavorites(next);
    localStorage.setItem("nai-style-favorites", JSON.stringify(next));
  };

  const showPost = async (post: DanbooruPost, pinned = false) => {
    const requestId = ++detailRequestId.current;
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setFocusedPost(post);
    if (pinned) setPinnedPostId(post.id);
    setDetailImage(post.previewUrl);
    if (window.naiDesktop && !post.imageUrl.startsWith("data:")) {
      try {
        const image = await window.naiDesktop.loadDanbooruImage(post.imageUrl);
        if (detailRequestId.current === requestId) setDetailImage(image);
      } catch {}
    } else setDetailImage(post.imageUrl);
  };

  const keepPostOpen = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  };

  const schedulePostClose = (postId: number) => {
    keepPostOpen();
    if (pinnedPostId === postId) return;
    hoverCloseTimer.current = setTimeout(() => {
      detailRequestId.current += 1;
      setFocusedPost((current) => current?.id === postId ? null : current);
      setDetailImage("");
    }, 550);
  };

  const sendPostToWorkbench = (post: DanbooruPost) => {
    const newArtists = post.artistTags.map((name) => name.replace(/_/g, " ")).filter((name) => !artists.some((artist) => artist.name.toLowerCase() === name.toLowerCase()));
    setArtists((current) => [...current, ...newArtists.map((name) => ({ id: uid(), name, weight: 1, enabled: true }))]);
    setSuffix([...post.copyrightTags, ...post.characterTags, ...post.generalTags].map((tag) => tag.replace(/_/g, " ")).join(", "));
    setActiveView("workbench");
    setNotice(`已发送作品 #${post.id} 的画师和提示词到工作台`);
  };

  const generalGroups = (tags: string[]) => {
    const clothingWords = /dress|shirt|skirt|pants|uniform|jacket|coat|sleeve|shoes|boots|hat|gloves|swimsuit|bikini|lingerie|clothes|hoodie|kimono|armor|stockings|pantyhose|bra|necktie/;
    const actionWords = /sitting|standing|walking|running|lying|looking|holding|smile|smiling|fighting|dancing|jumping|kneeling|pose|reaching|sleeping|eating|drinking/;
    return {
      clothing: tags.filter((tag) => clothingWords.test(tag)),
      actions: tags.filter((tag) => actionWords.test(tag)),
      other: tags.filter((tag) => !clothingWords.test(tag) && !actionWords.test(tag)),
    };
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">NOVELAI STYLE WORKBENCH</p>
          <h1>画师串工作台</h1>
        </div>
        <nav className="top-nav" aria-label="主功能">
          <button className={activeView === "workbench" ? "active" : ""} onClick={() => setActiveView("workbench")}>画师串工作台</button>
          <button className={activeView === "danbooru" ? "active" : ""} onClick={() => setActiveView("danbooru")}>Danbooru 画廊</button>
          <button className={activeView === "favorites" ? "active" : ""} onClick={() => setActiveView("favorites")}>收藏 {favorites.length ? `(${favorites.length})` : ""}</button>
        </nav>
        <div className="top-actions">
          <span className="status">{notice || "本地保存 · 不上传图片"}</span>
          {activeView === "workbench" && <><button className="button secondary" onClick={() => { setRecipeName("新画师串"); setArtists([]); setImages([]); setActiveRecipeId(null); setNotice("已新建空白画师串"); }}>＋ 新建</button>
          <button className="button primary" onClick={saveRecipe}>{activeRecipeId ? "更新配方" : "保存配方"}</button></>}
        </div>
      </header>

      {activeView === "danbooru" && <section className="gallery-page">
        <div className="gallery-title"><div><p className="eyebrow">DANBOORU EXPLORER</p><h2>画师与提示词参考画廊</h2><p>查询标签、浏览作品，并把画师或提示词送回工作台。</p></div><button className="button secondary" onClick={() => setActiveView("workbench")}>返回工作台</button></div>
        <section className="panel danbooru-panel">
          <div className="panel-heading"><div><span className="step">DB</span><h2>Danbooru 参考库</h2></div><span className="safe-badge">全部分级</span></div>
          <div className="booru-search">
            <select value={booruMode} onChange={(event) => { setBooruMode(event.target.value as "artist" | "tag"); setBooruResult(null); setBooruPage(1); }} aria-label="查询类型"><option value="artist">画师</option><option value="tag">提示词</option></select>
            <div className="booru-input-wrap"><input value={booruQuery} onChange={(event) => setBooruQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchDanbooru(); }} placeholder={booruMode === "artist" ? "输入画师名，如 honashi" : "输入英文标签，如 cinematic lighting"} />{!!autocomplete.length && <div className="booru-autocomplete">{autocomplete.map((tag) => <button key={tag.name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setBooruQuery(tag.name); searchDanbooru(tag.name, 1); }}><span>{tag.name}</span><small>{tag.count.toLocaleString()} 张</small></button>)}</div>}</div>
            <button className="button primary" disabled={booruLoading} onClick={() => searchDanbooru()}>{booruLoading ? "查询中…" : "查询"}</button>
          </div>
          {booruResult?.error && <div className="booru-error">{booruResult.error}</div>}
          {!!booruResult?.suggestions.length && <div className="booru-suggestions">{booruResult.suggestions.map((tag) => <button className={tag.name === booruResult.selectedTag ? "active" : ""} key={tag.name} onClick={() => searchDanbooru(tag.name)}>{tag.name}<small>{tag.count.toLocaleString()}</small></button>)}</div>}
          {booruResult?.selectedTag && <div className="booru-selected"><span>当前：{booruResult.selectedTag}</span><button onClick={() => useDanbooruTag(booruResult.selectedTag!)}>{booruMode === "artist" ? "＋ 加入画师串" : "＋ 加入提示词"}</button></div>}
          {!!booruResult?.posts.length && <><div className="booru-grid">{booruResult.posts.map((post) => <article className="booru-card" key={post.id} onMouseEnter={() => { keepPostOpen(); showPost(post); }} onMouseLeave={() => schedulePostClose(post.id)}><button className={`favorite-star ${favorites.some((item) => item.id === post.id) ? "active" : ""}`} aria-label="收藏作品" onClick={(event) => { event.stopPropagation(); toggleFavorite(post); }}>★</button><button className="booru-image-button" onClick={() => showPost(post, true)}><img src={post.previewUrl} alt={`${booruResult.selectedTag} 参考图`} loading="lazy" /><span>#{post.id} · {post.rating.toUpperCase()}</span></button></article>)}</div><div className="booru-pages"><button disabled={booruPage === 1 || booruLoading} onClick={() => searchDanbooru(booruResult.selectedTag || undefined, 1)}>首页</button><button disabled={booruPage === 1 || booruLoading} onClick={() => searchDanbooru(booruResult.selectedTag || undefined, booruPage - 1)}>上一页</button><label>第 <input type="number" min="1" max={totalBooruPages} value={booruPageInput} onChange={(event) => setBooruPageInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") jumpBooruPage(); }} /> / {totalBooruPages} 页</label><button disabled={booruLoading} onClick={jumpBooruPage}>跳转</button><button disabled={booruLoading || booruPage >= totalBooruPages} onClick={() => searchDanbooru(booruResult.selectedTag || undefined, booruPage + 1)}>下一页</button></div></>}
          {!booruResult && <div className="booru-intro">查询 Danbooru 的画师标签和提示词参考图。图片版权归原作者，点击缩略图可查看原帖。</div>}
        </section>
      </section>}

      {activeView === "favorites" && <section className="gallery-page"><div className="gallery-title"><div><p className="eyebrow">LOCAL FAVORITES</p><h2>收藏的参考作品</h2><p>收藏仅保存在当前设备。</p></div></div>{favorites.length ? <div className="favorite-grid">{favorites.map((post) => <article className="favorite-card" key={post.id}><button className="favorite-star active" onClick={() => toggleFavorite(post)}>★</button><button className="booru-image-button" onClick={() => showPost(post, true)}><img src={post.previewUrl} alt={`收藏作品 ${post.id}`} /><span>#{post.id}</span></button></article>)}</div> : <div className="library-empty">还没有收藏作品，请在 Danbooru 画廊点击图片左上角的星号。</div>}</section>}

      {focusedPost && <aside className={`post-detail ${pinnedPostId === focusedPost.id ? "pinned" : ""}`} onMouseEnter={keepPostOpen} onMouseLeave={() => schedulePostClose(focusedPost.id)}><button className="detail-close" onClick={() => { keepPostOpen(); setFocusedPost(null); setPinnedPostId(null); setDetailImage(""); }}>×</button><div className="detail-image">{detailImage ? <img src={detailImage} alt={`作品 ${focusedPost.id} 高清预览`} /> : <span>高清图加载中…</span>}</div><div className="detail-copy"><div className="detail-title"><h3>作品 #{focusedPost.id}</h3><span>{pinnedPostId === focusedPost.id ? "已固定" : "移入面板可暂留 · 点击图片固定"}</span></div>{[["画师", focusedPost.artistTags],["角色", focusedPost.characterTags],["作品", focusedPost.copyrightTags],["服装", generalGroups(focusedPost.generalTags).clothing],["动作", generalGroups(focusedPost.generalTags).actions],["其他提示词", generalGroups(focusedPost.generalTags).other],["元数据", focusedPost.metaTags]].map(([label, tags]) => !!tags.length && <section className="tag-group" key={label as string}><h4>{label as string}</h4><div>{(tags as string[]).map((tag) => <button key={tag} onClick={() => { navigator.clipboard.writeText(tag); setNotice(`已复制 ${tag}`); }}>{tag}</button>)}</div></section>)}<div className="detail-actions"><button className="button primary" onClick={() => sendPostToWorkbench(focusedPost)}>发送提示词到工作台</button><a className="button secondary" href={focusedPost.postUrl} target="_blank" rel="noreferrer">打开 Danbooru 原帖</a></div></div></aside>}

      {activeView === "workbench" && <>
      <section className="workspace">
        <div className="column left-column">
          <section className="panel parser-panel">
            <div className="panel-heading">
              <div><span className="step">01</span><h2>粘贴与解析</h2></div>
              <button className="text-button" onClick={() => setRaw(sample)}>使用示例</button>
            </div>
            <textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="粘贴 Prompt、Description 或 NAI 元数据……" />
            <button className="button primary wide" onClick={parse}>自动提取画师串</button>
          </section>

          <section className="panel gallery-panel">
            <div className="panel-heading"><div><span className="step">03</span><h2>参考图预览</h2></div><span className="counter">{images.length}/6</span></div>
            <label className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropImages}>
              <input type="file" accept="image/*" multiple onChange={importImages} />
              <strong>＋ 导入参考图</strong>
              <span>支持拖入或多选，图片仅保存在本机</span>
            </label>
            <div className="image-grid">
              {images.map((src, index) => (
                <figure key={src.slice(-24) + index}>
                  <img src={src} alt={`参考图 ${index + 1}`} />
                  <button aria-label={`删除参考图 ${index + 1}`} onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>×</button>
                </figure>
              ))}
            </div>
          </section>

        </div>

        <div className="column right-column">
          <section className="panel editor-panel">
            <div className="panel-heading"><div><span className="step">02</span><h2>调整画师与权重</h2></div><span className="counter">{artists.length} 位画师</span></div>
            <div className="recipe-name-row">
              <label>配方名称<input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} /></label>
              <button className="button secondary" onClick={() => setArtists((current) => current.map((artist) => ({ ...artist, weight: 1 })))}>权重归一</button>
            </div>
            <div className="artist-list">
              {!artists.length && <div className="empty-state">先在左侧粘贴 Prompt，然后点击“自动提取画师串”。</div>}
              {artists.map((artist, index) => (
                <article className={`artist-row ${artist.enabled ? "" : "disabled"}`} key={artist.id}>
                  <button className="toggle" onClick={() => updateArtist(artist.id, { enabled: !artist.enabled })}>{artist.enabled ? "✓" : "–"}</button>
                  <span className="artist-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="artist-main">
                    <input className="artist-name" value={artist.name} onChange={(event) => updateArtist(artist.id, { name: event.target.value })} />
                    <input className="slider" type="range" min="-2" max="2" step="0.05" value={artist.weight} onChange={(event) => updateArtist(artist.id, { weight: Number(event.target.value) })} />
                  </div>
                  <input className="weight" type="number" min="-9" max="9" step="0.05" value={artist.weight} onChange={(event) => updateArtist(artist.id, { weight: Number(event.target.value) })} />
                  <div className="artist-links">
                    <a href={`https://aitag.win/?q=${encodeURIComponent(`artist:${artist.name}`)}`} target="_blank" rel="noreferrer">AI TAG</a>
                    <a href={`https://danbooru.donmai.us/posts?tags=${encodeURIComponent(artist.name.replace(/ /g, "_"))}`} target="_blank" rel="noreferrer">作品</a>
                  </div>
                  <button className={`lock ${artist.locked ? "active" : ""}`} title={artist.locked ? "解除权重锁定" : "锁定权重"} aria-label={`${artist.locked ? "解除锁定" : "锁定"} ${artist.name}`} onClick={() => updateArtist(artist.id, { locked: !artist.locked })}>{artist.locked ? "锁" : "○"}</button>
                  <div className="artist-order"><button aria-label={`上移 ${artist.name}`} disabled={index === 0} onClick={() => moveArtist(index, -1)}>↑</button><button aria-label={`下移 ${artist.name}`} disabled={index === artists.length - 1} onClick={() => moveArtist(index, 1)}>↓</button></div>
                  <button className="remove" aria-label={`删除 ${artist.name}`} onClick={() => setArtists((current) => current.filter((item) => item.id !== artist.id))}>×</button>
                </article>
              ))}
            </div>
            <button className="add-artist" onClick={() => setArtists((current) => [...current, { id: uid(), name: "new artist", weight: 1, enabled: true }])}>＋ 手动添加画师</button>
          </section>

          <section className="panel output-panel">
            <div className="panel-heading"><div><span className="step">04</span><h2>生成新版 Prompt</h2></div><button className="button primary" onClick={copyPrompt}>复制 Prompt</button></div>
            <label className="suffix-label">追加通用提示词<input value={suffix} onChange={(event) => setSuffix(event.target.value)} /></label>
            <pre>{prompt || "等待添加画师……"}</pre>
          </section>

          <section className="panel experiment-panel">
            <div className="panel-heading"><div><span className="step">05</span><h2>权重实验室</h2></div><span className="counter">锁定画师不会变化</span></div>
            <div className="experiment-controls">
              <label>变化幅度 <strong>±{experimentAmplitude.toFixed(2)}</strong><input type="range" min="0.05" max="0.5" step="0.05" value={experimentAmplitude} onChange={(event) => setExperimentAmplitude(Number(event.target.value))} /></label>
            </div>
            {!artists.length ? <div className="experiment-empty">添加画师后，这里会自动生成四种权重方向。</div> : <div className="experiment-grid">
              {experiments.map((experiment) => (
                <article className="experiment-card" key={experiment.id}>
                  <div><h3>{experiment.name}</h3><p>{experiment.description}</p></div>
                  <div className="weight-chips">{experiment.weights.map((weight, index) => <span className={artists[index].locked ? "locked" : ""} key={artists[index].id}>{formatWeight(weight)}</span>)}</div>
                  <div className="experiment-actions"><button onClick={() => copyExperiment(experiment.weights, experiment.name)}>复制</button><button onClick={() => applyExperiment(experiment.weights, experiment.name)}>应用方案</button></div>
                </article>
              ))}
            </div>}
          </section>
        </div>
      </section>

      <section className="library">
        <div className="library-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h2>已保存的画师串</h2></div><span>{recipes.length} 个配方</span></div>
        <div className="library-tools">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索配方或画师…" aria-label="搜索配方或画师" />
          <input ref={importRecipesRef} className="file-input" type="file" accept="application/json,.json" onChange={importRecipes} />
          <button className="button secondary" onClick={() => importRecipesRef.current?.click()}>导入</button>
          <button className="button secondary" disabled={!recipes.length} onClick={exportRecipes}>导出</button>
        </div>
        <div className="recipe-grid">
          {!filteredRecipes.length && <div className="library-empty">{recipes.length ? "没有找到匹配的配方。" : "调整满意后点击右上角“保存配方”，它会出现在这里。"}</div>}
          {filteredRecipes.map((recipe) => (
            <article className={`recipe-card ${recipe.id === activeRecipeId ? "active" : ""}`} key={recipe.id}>
              <div className="recipe-cover">{recipe.images[0] ? <img src={recipe.images[0]} alt="" /> : <span>{recipe.name.slice(0, 1)}</span>}</div>
              <div className="recipe-copy"><h3>{recipe.name}</h3><p>{recipe.artists.map((artist) => artist.name).join(" · ") || "暂无画师"}</p><small>{recipe.artists.length} 位画师 · {new Date(recipe.createdAt).toLocaleDateString("zh-CN")}</small></div>
              <div className="recipe-actions"><button onClick={() => loadRecipe(recipe)}>载入</button><button onClick={() => removeRecipe(recipe.id)}>删除</button></div>
            </article>
          ))}
        </div>
      </section>
      </>}
    </main>
  );
}
