"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Artist = { id: string; name: string; weight: number; enabled: boolean };
type Recipe = {
  id: string;
  name: string;
  artists: Artist[];
  suffix: string;
  images: string[];
  createdAt: number;
};

const sample = `1.2::artist:honashi::, 1.25::artist:satou kuuki::,
1.13::artist:jackdempa::, 0.8::artist:dk.senie::,
artist:takano suzu, year 2024, year 2025`;

const uid = () => Math.random().toString(36).slice(2, 10);

function parseArtists(input: string): Artist[] {
  const found: Artist[] = [];
  const seen = new Set<string>();
  const regex = /(?:(-?\d+(?:\.\d+)?)::\s*)?artist:((?:\\,|[^,:\n])+?)(?=::|,|\n|$)/gi;
  for (const match of input.matchAll(regex)) {
    const name = match[2].replace(/\\,/g, ",").trim().replace(/^\(+|\)+$/g, "");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    found.push({ id: uid(), name, weight: match[1] ? Number(match[1]) : 1, enabled: true });
  }
  return found;
}

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

  const parse = () => {
    const next = parseArtists(raw);
    setArtists(next);
    setNotice(next.length ? `已提取 ${next.length} 位画师` : "没有识别到 artist: 画师标签");
  };

  const updateArtist = (id: string, patch: Partial<Artist>) =>
    setArtists((current) => current.map((artist) => (artist.id === id ? { ...artist, ...patch } : artist)));

  const saveRecipe = () => {
    const recipe: Recipe = { id: uid(), name: recipeName.trim() || "未命名画师串", artists, suffix, images, createdAt: Date.now() };
    const next = [recipe, ...recipes];
    setRecipes(next);
    localStorage.setItem("nai-style-recipes", JSON.stringify(next));
    setNotice("配方已保存到当前浏览器");
  };

  const loadRecipe = (recipe: Recipe) => {
    setRecipeName(recipe.name);
    setArtists(recipe.artists.map((artist) => ({ ...artist, id: uid() })));
    setSuffix(recipe.suffix);
    setImages(recipe.images);
    setNotice(`已载入「${recipe.name}」`);
  };

  const removeRecipe = (id: string) => {
    const next = recipes.filter((recipe) => recipe.id !== id);
    setRecipes(next);
    localStorage.setItem("nai-style-recipes", JSON.stringify(next));
  };

  const importImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 6 - images.length));
    const next = await Promise.all(files.map(resizeImage));
    setImages((current) => [...current, ...next].slice(0, 6));
    event.target.value = "";
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setNotice("新版 Prompt 已复制");
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
          <button className="button secondary" onClick={() => { setRecipeName("新画师串"); setArtists([]); setImages([]); }}>＋ 新建</button>
          <button className="button primary" onClick={saveRecipe}>保存配方</button>
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
            <label className="dropzone">
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
        </div>
      </section>

      <section className="library">
        <div className="library-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h2>已保存的画师串</h2></div><span>{recipes.length} 个配方</span></div>
        <div className="recipe-grid">
          {!recipes.length && <div className="library-empty">调整满意后点击右上角“保存配方”，它会出现在这里。</div>}
          {recipes.map((recipe) => (
            <article className="recipe-card" key={recipe.id}>
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
