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
type DanbooruPost = { id: number; previewUrl: string; imageUrl: string; postUrl: string; artistTags: string[]; generalTags: string[] };
type DanbooruResult = { selectedTag: string | null; suggestions: { name: string; count: number }[]; posts: DanbooruPost[]; error?: string };

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
  const importRecipesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setRecipes(JSON.parse(localStorage.getItem("nai-style-recipes") || "[]"));
    } catch {
      setRecipes([]);
    }
  }, []);

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

  const searchDanbooru = async (tag?: string) => {
    if (!booruQuery.trim() && !tag) return;
    setBooruLoading(true);
    try {
      const base = window.location.protocol === "file:"
        ? "https://nai-artist-workbench.banubate96.chatgpt.site/api/danbooru"
        : "/api/danbooru";
      const params = new URLSearchParams({ q: booruQuery, mode: booruMode });
      if (tag) params.set("tag", tag);
      const response = await fetch(`${base}?${params}`);
      const data = await response.json() as DanbooruResult;
      if (!response.ok) throw new Error(data.error || "查询失败");
      setBooruResult(data);
      setNotice(data.posts.length ? `找到 ${data.posts.length} 张普通级参考图` : "没有找到普通级参考图");
    } catch (error) {
      setBooruResult({ selectedTag: null, suggestions: [], posts: [], error: error instanceof Error ? error.message : "查询失败" });
      setNotice("Danbooru 查询失败，请稍后重试");
    } finally {
      setBooruLoading(false);
    }
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

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">NOVELAI STYLE WORKBENCH</p>
          <h1>画师串工作台</h1>
        </div>
        <div className="top-actions">
          <span className="status">{notice || "本地保存 · 不上传图片"}</span>
          <button className="button secondary" onClick={() => { setRecipeName("新画师串"); setArtists([]); setImages([]); setActiveRecipeId(null); setNotice("已新建空白画师串"); }}>＋ 新建</button>
          <button className="button primary" onClick={saveRecipe}>{activeRecipeId ? "更新配方" : "保存配方"}</button>
        </div>
      </header>

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

          <section className="panel danbooru-panel">
            <div className="panel-heading"><div><span className="step">DB</span><h2>Danbooru 参考库</h2></div><span className="safe-badge">普通级</span></div>
            <div className="booru-search">
              <select value={booruMode} onChange={(event) => { setBooruMode(event.target.value as "artist" | "tag"); setBooruResult(null); }} aria-label="查询类型"><option value="artist">画师</option><option value="tag">提示词</option></select>
              <input value={booruQuery} onChange={(event) => setBooruQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchDanbooru(); }} placeholder={booruMode === "artist" ? "输入画师名，如 honashi" : "输入英文标签，如 cinematic lighting"} />
              <button className="button primary" disabled={booruLoading} onClick={() => searchDanbooru()}>{booruLoading ? "查询中…" : "查询"}</button>
            </div>
            {booruResult?.error && <div className="booru-error">{booruResult.error}</div>}
            {!!booruResult?.suggestions.length && <div className="booru-suggestions">{booruResult.suggestions.map((tag) => <button className={tag.name === booruResult.selectedTag ? "active" : ""} key={tag.name} onClick={() => searchDanbooru(tag.name)}>{tag.name}<small>{tag.count.toLocaleString()}</small></button>)}</div>}
            {booruResult?.selectedTag && <div className="booru-selected"><span>当前：{booruResult.selectedTag}</span><button onClick={() => useDanbooruTag(booruResult.selectedTag!)}>{booruMode === "artist" ? "＋ 加入画师串" : "＋ 加入提示词"}</button></div>}
            {!!booruResult?.posts.length && <div className="booru-grid">{booruResult.posts.map((post) => <a href={post.postUrl} target="_blank" rel="noreferrer" key={post.id} title={[...post.artistTags, ...post.generalTags.slice(0, 5)].join(", ")}><img src={post.previewUrl} alt={`${booruResult.selectedTag} 参考图`} loading="lazy" /><span>#{post.id}</span></a>)}</div>}
            {!booruResult && <div className="booru-intro">查询 Danbooru 的画师标签和提示词参考图。图片版权归原作者，点击缩略图可查看原帖。</div>}
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
    </main>
  );
}
