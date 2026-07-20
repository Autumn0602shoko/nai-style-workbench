"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { analyzeQualityTags, composeQualityTags, getQualityProfile, NovelAIModelId, qualityProfiles, UcPresetId } from "./quality-profiles";
import { deleteExperimentImage, getExperimentImage, putExperimentImage } from "./experiment-image-store";
import { createRecipeExperimentDraft, createStyleTrial, describeTrialDifferences, normalizeStyleExperimentStore, StyleExperimentDraft, StyleTrial } from "./style-experiments";
import type { Artist, Recipe } from "./workbench-types";

type Props = {
  recipe: Recipe;
  onBack: () => void;
  onApply: (draft: StyleExperimentDraft) => void;
  onOverwrite: (draft: StyleExperimentDraft) => void;
};

const STORAGE_KEY = "nai-style-debug-sessions";
const makeId = () => Math.random().toString(36).slice(2, 10);
const ucLabels: Record<UcPresetId, string> = { none: "不使用预设", light: "Light", heavy: "Heavy", human: "Human Focus", furry: "Furry Focus" };
const readExperimentStore = () => {
  try { return normalizeStyleExperimentStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); }
  catch { return normalizeStyleExperimentStore({}); }
};

const splitTags = (value: string) => value.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean);
const formatArtist = (artist: Artist) => artist.weight === 1 ? `artist:${artist.name}` : `${Number(artist.weight.toFixed(2))}::artist:${artist.name}::`;

function resizeTrialImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const max = 1440;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function StyleDebugLab({ recipe, onBack, onApply, onOverwrite }: Props) {
  const baseline = useMemo(() => createRecipeExperimentDraft(recipe), [recipe]);
  const [draft, setDraft] = useState<StyleExperimentDraft>(baseline);
  const [trials, setTrials] = useState<StyleTrial[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [trialName, setTrialName] = useState("");
  const [trialNote, setTrialNote] = useState("");
  const [qualityInput, setQualityInput] = useState("");
  const [negativeInput, setNegativeInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const profile = useMemo(() => getQualityProfile(draft.modelId), [draft.modelId]);
  const effectiveTags = useMemo(() => composeQualityTags(draft.modelId, draft.autoQuality, draft.ucPresetId, draft.positiveTags, draft.negativeTags), [draft]);
  const qualityIssues = useMemo(() => analyzeQualityTags(draft.modelId, draft.autoQuality, draft.ucPresetId, draft.positiveTags, draft.negativeTags), [draft]);
  const currentDifferences = useMemo(() => describeTrialDifferences(baseline, draft), [baseline, draft]);
  const artistPrompt = useMemo(() => draft.artists.filter((artist) => artist.enabled && artist.name.trim()).map(formatArtist).join(", "), [draft.artists]);
  const finalPrompt = useMemo(() => [draft.basePrompt, artistPrompt, effectiveTags.positive.join(", ")].filter(Boolean).join(", "), [draft.basePrompt, artistPrompt, effectiveTags.positive]);

  useEffect(() => {
    setDraft(baseline);
    setTrials(readExperimentStore().sessions[recipe.id] || []);
  }, [baseline, recipe.id]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(trials.flatMap((trial) => trial.imageIds))];
    Promise.all(ids.map(async (id) => [id, await getExperimentImage(id)] as const)).then((entries) => {
      if (cancelled) return;
      setImageUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => !!entry[1])));
    }).catch(() => { if (!cancelled) setStatus("部分试验图暂时无法读取"); });
    return () => { cancelled = true; };
  }, [trials]);

  const persistTrials = (next: StyleTrial[]) => {
    const store = readExperimentStore();
    store.sessions[recipe.id] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    setTrials(next);
  };

  const updateDraft = <K extends keyof StyleExperimentDraft>(key: K, value: StyleExperimentDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateSettings = (patch: Partial<StyleExperimentDraft["settings"]>) => setDraft((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const updateArtist = (id: string, patch: Partial<Artist>) => updateDraft("artists", draft.artists.map((artist) => artist.id === id ? { ...artist, ...patch } : artist));

  const moveArtist = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= draft.artists.length) return;
    const next = [...draft.artists];
    [next[index], next[target]] = [next[target], next[index]];
    updateDraft("artists", next);
  };

  const addTags = (kind: "positiveTags" | "negativeTags", value: string, clear: () => void) => {
    const incoming = splitTags(value);
    if (!incoming.length) return;
    updateDraft(kind, [...draft[kind], ...incoming]);
    clear();
  };

  const importTrialImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 5 - pendingImages.length));
    event.target.value = "";
    if (!files.length) return;
    try {
      const next = await Promise.all(files.map(resizeTrialImage));
      setPendingImages((current) => [...current, ...next].slice(0, 5));
      setStatus(`已准备 ${next.length} 张试验图`);
    } catch { setStatus("有图片读取失败，请换一张图片重试"); }
  };

  const saveTrial = async () => {
    setSaving(true);
    try {
      const imageIds = pendingImages.map(() => `trial-image-${makeId()}`);
      await Promise.all(imageIds.map((id, index) => putExperimentImage(id, pendingImages[index])));
      const trial = createStyleTrial(recipe.id, trialName || `实验 ${trials.length + 1}`, trialNote, draft, imageIds);
      persistTrials([trial, ...trials]);
      setPendingImages([]);
      setTrialName("");
      setTrialNote("");
      setStatus(`已保存「${trial.name}」`);
    } catch { setStatus("实验保存失败，请检查本机存储空间"); }
    finally { setSaving(false); }
  };

  const removeTrial = async (trial: StyleTrial) => {
    await Promise.all(trial.imageIds.map((id) => deleteExperimentImage(id).catch(() => undefined)));
    persistTrials(trials.filter((item) => item.id !== trial.id));
    setStatus(`已删除「${trial.name}」及其试验图`);
  };

  const loadTrial = (trial: StyleTrial) => {
    setDraft({ artists: trial.artists.map((artist) => ({ ...artist })), basePrompt: trial.basePrompt, modelId: trial.modelId, autoQuality: trial.autoQuality, ucPresetId: trial.ucPresetId, positiveTags: [...trial.positiveTags], negativeTags: [...trial.negativeTags], settings: { ...trial.settings } });
    setStatus(`已把「${trial.name}」载入编辑器`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <section className="style-debug-page">
    <div className="style-debug-title"><div><p className="eyebrow">STYLE RECIPE LAB</p><h2>{recipe.name} · 调试实验室</h2><p>以已保存画师串为基准，记录每一次参数、试验图与结论。</p></div><div><button className="button secondary" onClick={onBack}>返回工作台</button><button className="button primary" onClick={() => onApply(draft)}>应用当前方案</button></div></div>
    {status && <div className="style-debug-status">{status}<button onClick={() => setStatus("")}>×</button></div>}
    <div className="style-debug-grid">
      <div className="style-debug-editor">
        <section className="panel mini-style-editor">
          <div className="panel-heading"><div><span className="step">A</span><h2>画师串微调</h2></div><span className="counter">{draft.artists.filter((artist) => artist.enabled).length} 位启用</span></div>
          <div className="mini-artist-list">{draft.artists.map((artist, index) => <article className={artist.enabled ? "" : "disabled"} key={artist.id}>
            <button className="mini-toggle" onClick={() => updateArtist(artist.id, { enabled: !artist.enabled })}>{artist.enabled ? "✓" : "–"}</button>
            <input value={artist.name} onChange={(event) => updateArtist(artist.id, { name: event.target.value })} />
            <input className="mini-weight" type="number" min="-9" max="9" step="0.05" value={artist.weight} onChange={(event) => updateArtist(artist.id, { weight: Number(event.target.value) })} />
            <button disabled={index === 0} onClick={() => moveArtist(index, -1)}>↑</button><button disabled={index === draft.artists.length - 1} onClick={() => moveArtist(index, 1)}>↓</button>
            <button className="mini-remove" onClick={() => updateDraft("artists", draft.artists.filter((item) => item.id !== artist.id))}>×</button>
          </article>)}</div>
          <div className="mini-add-row"><input value={artistInput} onChange={(event) => setArtistInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && artistInput.trim()) { updateDraft("artists", [...draft.artists, { id: makeId(), name: artistInput.trim(), weight: 1, enabled: true }]); setArtistInput(""); } }} placeholder="临时加入画师…" /><button onClick={() => { if (!artistInput.trim()) return; updateDraft("artists", [...draft.artists, { id: makeId(), name: artistInput.trim(), weight: 1, enabled: true }]); setArtistInput(""); }}>添加</button></div>
        </section>

        <section className="panel quality-mini-editor">
          <div className="panel-heading"><div><span className="step">Q</span><h2>正负面质量词</h2></div><button className="text-button" onClick={() => onOverwrite(draft)}>覆盖保存配方</button></div>
          <div className="quality-model-row"><label>对应模型<select value={draft.modelId} onChange={(event) => { const modelId = event.target.value as NovelAIModelId; const nextProfile = getQualityProfile(modelId); setDraft((current) => ({ ...current, modelId, ucPresetId: nextProfile.ucPresets[current.ucPresetId] ? current.ucPresetId : "light" })); }}><>{qualityProfiles.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</></select></label><label className="quality-switch"><input type="checkbox" checked={draft.autoQuality} onChange={(event) => updateDraft("autoQuality", event.target.checked)} /><span>使用官方自动质量词</span></label></div>
          <div className="quality-official"><strong>官方自动追加</strong><div>{profile.automaticQuality.map((tag) => <span className={draft.autoQuality ? "active" : ""} key={tag}>{tag}</span>)}</div></div>
          <TagEditor label="自定义正面质量词" value={qualityInput} setValue={setQualityInput} tags={draft.positiveTags} onAdd={() => addTags("positiveTags", qualityInput, () => setQualityInput(""))} onRemove={(index) => updateDraft("positiveTags", draft.positiveTags.filter((_, itemIndex) => itemIndex !== index))} />
          <div className="quality-uc-select"><label>官方负面预设<select value={draft.ucPresetId} onChange={(event) => updateDraft("ucPresetId", event.target.value as UcPresetId)}>{Object.keys(profile.ucPresets).map((id) => <option value={id} key={id}>{ucLabels[id as UcPresetId]}</option>)}</select></label><span>{(profile.ucPresets[draft.ucPresetId] || []).length} 个预设标签</span></div>
          <TagEditor label="自定义负面质量词" value={negativeInput} setValue={setNegativeInput} tags={draft.negativeTags} onAdd={() => addTags("negativeTags", negativeInput, () => setNegativeInput(""))} onRemove={(index) => updateDraft("negativeTags", draft.negativeTags.filter((_, itemIndex) => itemIndex !== index))} />
          <div className="quality-analysis"><header><strong>质量词分析</strong><span>{qualityIssues.length ? `${qualityIssues.length} 项提醒` : "没有发现明确问题"}</span></header>{qualityIssues.map((issue) => <article className={issue.severity} key={issue.id}><b>{issue.title}</b><p>{issue.description}</p>{!!issue.tags.length && <div>{issue.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</article>)}</div>
        </section>

        <section className="panel debug-settings-panel">
          <div className="panel-heading"><div><span className="step">P</span><h2>本次参数</h2></div><span className="counter">仅记录，不会生图</span></div>
          <div className="debug-settings-grid"><label>宽度<input type="number" step="64" min="256" max="2048" value={draft.settings.width} onChange={(event) => updateSettings({ width: Number(event.target.value) })} /></label><label>高度<input type="number" step="64" min="256" max="2048" value={draft.settings.height} onChange={(event) => updateSettings({ height: Number(event.target.value) })} /></label><label>Steps<input type="number" min="1" max="50" value={draft.settings.steps} onChange={(event) => updateSettings({ steps: Number(event.target.value) })} /></label><label>Guidance<input type="number" min="0" max="20" step="0.1" value={draft.settings.guidance} onChange={(event) => updateSettings({ guidance: Number(event.target.value) })} /></label><label className="seed-field">Seed<input value={draft.settings.seed ?? ""} onChange={(event) => updateSettings({ seed: event.target.value === "" ? null : Number(event.target.value) })} placeholder="留空为随机" /></label></div>
        </section>
      </div>

      <div className="style-debug-results">
        <section className="panel trial-composer">
          <div className="panel-heading"><div><span className="step">＋</span><h2>记录本次实验</h2></div><span className="counter">{currentDifferences.length ? `改动：${currentDifferences.join("、")}` : "与基准一致"}</span></div>
          <div className="trial-form"><input value={trialName} onChange={(event) => setTrialName(event.target.value)} placeholder={`实验 ${trials.length + 1}`} /><textarea value={trialNote} onChange={(event) => setTrialNote(event.target.value)} placeholder="记录观察，例如：线条更干净，但脸部风格偏离……" /></div>
          <div className="trial-upload"><label><input type="file" accept="image/*" multiple onChange={importTrialImages} /><strong>＋ 上传本次试验图</strong><span>最多 5 张，图片保存在当前设备</span></label><div>{pendingImages.map((src, index) => <figure key={`${src.slice(-20)}-${index}`}><img src={src} alt={`待保存试验图 ${index + 1}`} /><button onClick={() => setPendingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></figure>)}</div></div>
          <details className="trial-prompt-preview"><summary>查看本次完整 Prompt 与负面词</summary><strong>Prompt</strong><p>{finalPrompt || "当前为空"}</p><strong>Undesired Content</strong><p>{effectiveTags.negative.join(", ") || "当前为空"}</p></details>
          <div className="trial-save-row"><span>{draft.settings.seed === null ? "当前使用随机 Seed，对比结果可能受随机性影响" : currentDifferences.length > 1 ? `本次同时改动 ${currentDifferences.length} 类变量` : pendingImages.length ? `${pendingImages.length} 张试验图待保存` : "参数已准备好，可以保存本次实验"}</span><button disabled={saving} onClick={saveTrial}>{saving ? "保存中…" : "保存本次实验"}</button></div>
        </section>

        <section className="panel trial-history-panel">
          <div className="panel-heading"><div><span className="step">LOG</span><h2>实验记录</h2></div><span className="counter">{trials.length} 次</span></div>
          {!trials.length ? <div className="trial-empty"><strong>还没有实验记录</strong><span>调整一个变量、上传对应试验图，再保存本次实验。</span></div> : <div className="trial-grid">{trials.map((trial) => {
            const differences = describeTrialDifferences(baseline, trial);
            return <article className="trial-card" key={trial.id}>
              <div className="trial-card-images">{trial.imageIds.length ? trial.imageIds.map((id, index) => imageUrls[id] ? <img src={imageUrls[id]} alt={`${trial.name} 试验图 ${index + 1}`} key={id} /> : <span key={id}>读取中…</span>) : <span>仅保存参数</span>}</div>
              <header><div><strong>{trial.name}</strong><time>{new Date(trial.createdAt).toLocaleString("zh-CN")}</time></div><button onClick={() => removeTrial(trial)}>删除</button></header>
              <div className="trial-differences">{differences.length ? differences.map((item) => <span key={item}>{item}</span>) : <span className="baseline">基准参数</span>}{differences.length > 1 && <em>多变量</em>}</div>
              <div className="trial-params"><span>{getQualityProfile(trial.modelId).label.replace("NAI Diffusion ", "")}</span><span>{trial.settings.width}×{trial.settings.height}</span><span>{trial.settings.steps} Steps</span><span>CFG {trial.settings.guidance}</span><span>Seed {trial.settings.seed ?? "随机"}</span></div>
              <p>{trial.note || "没有填写实验结论。"}</p>
              <details><summary>画师与质量词快照</summary><b>{trial.artists.filter((artist) => artist.enabled).map((artist) => `${artist.name} ${artist.weight}`).join(" · ") || "无启用画师"}</b><span>正面：{composeQualityTags(trial.modelId, trial.autoQuality, trial.ucPresetId, trial.positiveTags, trial.negativeTags).positive.join(", ") || "无"}</span><span>负面：{composeQualityTags(trial.modelId, trial.autoQuality, trial.ucPresetId, trial.positiveTags, trial.negativeTags).negative.join(", ") || "无"}</span></details>
              <button className="trial-load" onClick={() => loadTrial(trial)}>载入这组参数</button>
            </article>;
          })}</div>}
        </section>
      </div>
    </div>
  </section>;
}

function TagEditor({ label, value, setValue, tags, onAdd, onRemove }: { label: string; value: string; setValue: (value: string) => void; tags: string[]; onAdd: () => void; onRemove: (index: number) => void }) {
  return <div className="quality-tag-editor"><header><strong>{label}</strong><span>{tags.length} 项</span></header><div className="quality-tag-add"><input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} placeholder="输入英文标签，可用逗号分隔…" /><button onClick={onAdd}>添加</button></div><div className="quality-tag-chips">{tags.length ? tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}<button aria-label={`移除 ${tag}`} onClick={() => onRemove(index)}>×</button></span>) : <em>暂时留空</em>}</div></div>;
}
