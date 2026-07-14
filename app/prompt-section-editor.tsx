"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { movePromptTagToSection } from "./prompt-import";
import { getBuiltInTranslationCount, normalizeTranslationKey, translateDanbooruTag } from "./tag-translation";

export type PromptSectionId = "character" | "clothing" | "action" | "composition" | "scene" | "quality" | "other" | "negative";
export type PromptTag = { id: string; text: string; weight: number; enabled: boolean };
export type PromptSections = Record<PromptSectionId, PromptTag[]>;

export const promptSectionDefinitions: { id: PromptSectionId; label: string; hint: string; optional?: boolean }[] = [
  { id: "character", label: "角色与外貌", hint: "人物数量、角色名、发色、眼睛、表情等" },
  { id: "clothing", label: "人物衣着", hint: "服装、配饰、鞋袜等" },
  { id: "action", label: "动作与姿态", hint: "动作、姿势、视线和角色互动" },
  { id: "composition", label: "构图与视角", hint: "镜头、景别、角度和画面焦点", optional: true },
  { id: "scene", label: "场景与背景", hint: "地点、时间、天气和背景元素", optional: true },
  { id: "quality", label: "质量与年代", hint: "按需要手动添加，不自动填充", optional: true },
  { id: "other", label: "其他提示词", hint: "无法归入以上分类的必要标签", optional: true },
  { id: "negative", label: "Undesired Content", hint: "希望模型避免出现的内容", optional: true },
];

export const basicPromptSections: PromptSectionId[] = ["character", "clothing", "action"];
const positiveOrder: PromptSectionId[] = ["character", "clothing", "action", "composition", "scene", "quality", "other"];
const makeId = () => Math.random().toString(36).slice(2, 10);

export const createEmptyPromptSections = (): PromptSections => ({ character: [], clothing: [], action: [], composition: [], scene: [], quality: [], other: [], negative: [] });
export const createPromptTags = (tags: string[]): PromptTag[] => [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].map((text) => ({ id: makeId(), text, weight: 1, enabled: true }));

const formatTag = (tag: PromptTag) => tag.weight === 1 ? tag.text.trim() : `${Number(tag.weight.toFixed(2))}::${tag.text.trim()}::`;
export const formatPromptSections = (sections: PromptSections) => positiveOrder.flatMap((id) => sections[id]).filter((tag) => tag.enabled && tag.text.trim()).map(formatTag).join(", ");
export const formatNegativePrompt = (sections: PromptSections) => sections.negative.filter((tag) => tag.enabled && tag.text.trim()).map(formatTag).join(", ");

type Props = {
  sections: PromptSections;
  setSections: Dispatch<SetStateAction<PromptSections>>;
  visibleSections: PromptSectionId[];
  setVisibleSections: Dispatch<SetStateAction<PromptSectionId[]>>;
  suggestTags?: (query: string) => Promise<{ name: string; count: number }[]>;
  loadOnlineDictionary?: () => Promise<{ version: string; updatedAt: string; entries: Record<string, string> }>;
  lookupTranslation?: (tag: string) => Promise<{ candidates: string[]; source: string }>;
};

const ONLINE_DICTIONARY_CACHE_KEY = "nai-online-tag-translations";
const ONLINE_DICTIONARY_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const normalizeOnlineEntries = (source: unknown) => {
  if (!source || typeof source !== "object") return {};
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(source).slice(0, 20_000)) {
    const key = normalizeTranslationKey(rawKey);
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (key && key.length <= 120 && value && value.length <= 120) result[key] = value;
  }
  return result;
};

export function PromptSectionEditor({ sections, setSections, visibleSections, setVisibleSections, suggestTags, loadOnlineDictionary, lookupTranslation }: Props) {
  const [inputs, setInputs] = useState<Partial<Record<PromptSectionId, string>>>({});
  const [addSection, setAddSection] = useState<PromptSectionId>("composition");
  const [activeSuggestionSection, setActiveSuggestionSection] = useState<PromptSectionId | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<{ name: string; count: number }[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showTranslations, setShowTranslations] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [customTranslations, setCustomTranslations] = useState<Record<string, string>>({});
  const [onlineTranslations, setOnlineTranslations] = useState<Record<string, string>>({});
  const [onlineDictionaryMeta, setOnlineDictionaryMeta] = useState<{ version: string; updatedAt: string; checkedAt: number } | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryStatus, setDictionaryStatus] = useState("");
  const [dictionaryTag, setDictionaryTag] = useState("");
  const [dictionaryTranslation, setDictionaryTranslation] = useState("");
  const [translationCandidates, setTranslationCandidates] = useState<string[]>([]);
  const [translationLookupLoading, setTranslationLookupLoading] = useState(false);
  const [translationLookupStatus, setTranslationLookupStatus] = useState("");
  const [translationLookupRevision, setTranslationLookupRevision] = useState(0);
  const [undoDeletion, setUndoDeletion] = useState<{ sections: PromptSections; message: string } | null>(null);
  const suggestionRequest = useRef(0);
  const translationRequest = useRef(0);
  const counts = useMemo(() => Object.values(sections).flat().reduce<Record<string, number>>((result, tag) => {
    const key = tag.text.trim().toLowerCase();
    if (key) result[key] = (result[key] || 0) + 1;
    return result;
  }, {}), [sections]);
  const allTagIds = useMemo(() => visibleSections.flatMap((id) => sections[id].map((tag) => tag.id)), [sections, visibleSections]);
  const mergedTranslations = useMemo(() => ({ ...onlineTranslations, ...customTranslations }), [onlineTranslations, customTranslations]);

  const updateSection = (id: PromptSectionId, updater: (tags: PromptTag[]) => PromptTag[]) => setSections((current) => ({ ...current, [id]: updater(current[id]) }));
  const addValues = (id: PromptSectionId, values: string[]) => updateSection(id, (current) => {
    const existing = new Set(current.map((tag) => tag.text.toLowerCase()));
    return [...current, ...createPromptTags(values.filter((tag) => !existing.has(tag.toLowerCase())))];
  });
  const addInputTags = (id: PromptSectionId) => {
    const values = (inputs[id] || "").split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean);
    if (!values.length) return;
    addValues(id, values);
    setInputs((current) => ({ ...current, [id]: "" }));
    setTagSuggestions([]);
  };
  const moveTag = (id: PromptSectionId, index: number, direction: -1 | 1) => updateSection(id, (current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const changeTagSection = (from: PromptSectionId, to: PromptSectionId, tagId: string) => {
    setSections((current) => movePromptTagToSection(current, from, to, tagId));
    setVisibleSections((current) => current.includes(to) ? current : [...current, to]);
  };
  const removeTag = (section: PromptSectionId, tagId: string) => {
    const removed = sections[section].find((item) => item.id === tagId);
    setUndoDeletion({ sections, message: removed ? `已删除 ${removed.text}` : "已删除标签" });
    updateSection(section, (current) => current.filter((item) => item.id !== tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
    setSelectedTagId((current) => current === tagId ? null : current);
  };
  const toggleBulkTag = (tagId: string) => setSelectedTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
  const deleteSelectedTags = () => {
    if (!selectedTagIds.length) return;
    setUndoDeletion({ sections, message: `已删除 ${selectedTagIds.length} 个标签` });
    const selected = new Set(selectedTagIds);
    setSections((current) => Object.fromEntries(Object.entries(current).map(([id, tags]) => [id, tags.filter((tag) => !selected.has(tag.id))])) as PromptSections);
    setSelectedTagIds([]);
    setSelectedTagId(null);
  };
  const persistCustomTranslations = (next: Record<string, string>) => {
    setCustomTranslations(next);
    localStorage.setItem("nai-tag-translations", JSON.stringify(next));
  };
  const saveCustomTranslation = () => {
    const key = normalizeTranslationKey(dictionaryTag);
    const translation = dictionaryTranslation.trim();
    if (!key || !translation) return;
    persistCustomTranslations({ ...customTranslations, [key]: translation });
    setTranslationLookupStatus("已保存并应用到当前提示词");
  };
  const openTranslationDictionary = (tag = "") => {
    const key = normalizeTranslationKey(tag);
    setDictionaryTag(tag);
    setDictionaryTranslation(key ? mergedTranslations[key] || "" : "");
    setTranslationCandidates([]);
    setTranslationLookupStatus("");
    setDictionaryOpen(true);
  };
  const selectSuggestedTag = (id: PromptSectionId, name: string) => {
    const values = (inputs[id] || "").split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean);
    if (values.length) values.pop();
    addValues(id, [...values, name]);
    setInputs((current) => ({ ...current, [id]: "" }));
    setTagSuggestions([]);
    setActiveSuggestionSection(null);
  };

  const refreshOnlineDictionary = useCallback(async (silent = false) => {
    if (!loadOnlineDictionary) return;
    if (!silent) setDictionaryLoading(true);
    try {
      const payload = await loadOnlineDictionary();
      const entries = normalizeOnlineEntries(payload.entries);
      if (!Object.keys(entries).length) throw new Error("公共词典内容为空");
      const cached = {
        version: String(payload.version || "未知版本"),
        updatedAt: String(payload.updatedAt || ""),
        checkedAt: Date.now(),
        entries,
      };
      localStorage.setItem(ONLINE_DICTIONARY_CACHE_KEY, JSON.stringify(cached));
      setOnlineTranslations(entries);
      setOnlineDictionaryMeta({ version: cached.version, updatedAt: cached.updatedAt, checkedAt: cached.checkedAt });
      setDictionaryStatus(`已更新到 ${cached.version}`);
    } catch {
      setDictionaryStatus("联网更新失败，继续使用本机缓存");
    } finally {
      if (!silent) setDictionaryLoading(false);
    }
  }, [loadOnlineDictionary]);

  useEffect(() => {
    const raw = activeSuggestionSection ? inputs[activeSuggestionSection] || "" : "";
    const query = raw.split(/[,\n]+/).at(-1)?.trim() || "";
    const requestId = ++suggestionRequest.current;
    if (!suggestTags || query.length < 2) { setTagSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestTags(query);
        if (suggestionRequest.current === requestId) setTagSuggestions(suggestions.slice(0, 16));
      } catch {
        if (suggestionRequest.current === requestId) setTagSuggestions([]);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [activeSuggestionSection, inputs, suggestTags]);

  useEffect(() => {
    const tag = dictionaryTag.trim();
    const requestId = ++translationRequest.current;
    if (!dictionaryOpen || !lookupTranslation || tag.length < 2) {
      setTranslationCandidates([]);
      setTranslationLookupLoading(false);
      return;
    }
    setTranslationLookupLoading(true);
    setTranslationLookupStatus("正在联网查找可能的中文释义…");
    const timer = setTimeout(async () => {
      try {
        const result = await lookupTranslation(tag);
        if (translationRequest.current !== requestId) return;
        setTranslationCandidates(result.candidates);
        setTranslationLookupStatus(result.candidates.length ? `找到 ${result.candidates.length} 个候选 · ${result.source}` : "没有找到合适候选，可以手动填写");
      } catch {
        if (translationRequest.current === requestId) {
          setTranslationCandidates([]);
          setTranslationLookupStatus("联网查询失败，可以手动填写后保存");
        }
      } finally {
        if (translationRequest.current === requestId) setTranslationLookupLoading(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [dictionaryOpen, dictionaryTag, lookupTranslation, translationLookupRevision]);
  useEffect(() => {
    if (!undoDeletion) return;
    const timer = setTimeout(() => setUndoDeletion(null), 6500);
    return () => clearTimeout(timer);
  }, [undoDeletion]);
  useEffect(() => {
    if (!dictionaryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDictionaryOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dictionaryOpen]);

  useEffect(() => {
    try { setCustomTranslations(JSON.parse(localStorage.getItem("nai-tag-translations") || "{}")); }
    catch { setCustomTranslations({}); }
  }, []);
  useEffect(() => {
    let shouldRefresh = true;
    try {
      const cached = JSON.parse(localStorage.getItem(ONLINE_DICTIONARY_CACHE_KEY) || "null");
      const entries = normalizeOnlineEntries(cached?.entries);
      if (Object.keys(entries).length) {
        const checkedAt = Number(cached.checkedAt || 0);
        setOnlineTranslations(entries);
        setOnlineDictionaryMeta({
          version: String(cached.version || "未知版本"),
          updatedAt: String(cached.updatedAt || ""),
          checkedAt,
        });
        shouldRefresh = Date.now() - checkedAt > ONLINE_DICTIONARY_MAX_AGE;
      }
    } catch {
      localStorage.removeItem(ONLINE_DICTIONARY_CACHE_KEY);
    }
    if (shouldRefresh) void refreshOnlineDictionary(true);
  }, [refreshOnlineDictionary]);
  const available = promptSectionDefinitions.filter((section) => section.optional && !visibleSections.includes(section.id));

  return <section className="panel prompt-editor-panel">
    <div className="panel-heading"><div><span className="step">P</span><h2>NovelAI 分区提示词</h2></div><div className="prompt-heading-actions"><button className={showTranslations ? "active" : ""} onClick={() => setShowTranslations((current) => !current)}>中英对照</button><button className={bulkMode ? "active" : ""} onClick={() => { setBulkMode((current) => !current); setSelectedTagIds([]); setSelectedTagId(null); }}>批量管理</button><span className="counter">{Object.values(sections).flat().filter((tag) => tag.enabled).length} 个启用标签</span></div></div>
    <div className="prompt-editor-note">标签采用流式排列。点击标签可编辑英文、权重与分类；勾选按钮用于临时启用或停用，最终输出仍保持 NovelAI 英文格式。</div>
    {bulkMode && <div className="prompt-bulk-toolbar"><div><strong>批量选择</strong><span>已选 {selectedTagIds.length} / {allTagIds.length} 项</span></div><div><button disabled={!allTagIds.length || selectedTagIds.length === allTagIds.length} onClick={() => setSelectedTagIds(allTagIds)}>全选</button><button disabled={!selectedTagIds.length} onClick={() => setSelectedTagIds([])}>清空选择</button><button className="danger" disabled={!selectedTagIds.length} onClick={deleteSelectedTags}>删除选中</button></div></div>}
    {!dictionaryOpen && <button className="translation-float-launcher" onClick={() => openTranslationDictionary()}>译<span>小词典</span></button>}
    {dictionaryOpen && <aside className="translation-float" role="dialog" aria-label="翻译小词典">
      <header><div><strong>翻译小词典</strong><span>联网查找当前 Danbooru 标签</span></div><button aria-label="关闭翻译小词典" onClick={() => setDictionaryOpen(false)}>×</button></header>
      <div className="translation-float-body">
        <label>英文标签<input autoFocus value={dictionaryTag} onChange={(event) => { setDictionaryTag(event.target.value); setDictionaryTranslation(""); setTranslationCandidates([]); }} placeholder="例如 stocking" /></label>
        <div className={`translation-lookup-state ${translationLookupLoading ? "loading" : ""}`}><span>{translationLookupStatus || "输入标签后会自动联网查找"}</span><button disabled={translationLookupLoading || dictionaryTag.trim().length < 2 || !lookupTranslation} onClick={() => setTranslationLookupRevision((current) => current + 1)}>重新查找</button></div>
        {!!translationCandidates.length && <div className="translation-candidates">{translationCandidates.map((candidate) => <button className={dictionaryTranslation === candidate ? "active" : ""} key={candidate} onClick={() => setDictionaryTranslation(candidate)}>{candidate}</button>)}</div>}
        <label>采用的中文释义<input value={dictionaryTranslation} onChange={(event) => setDictionaryTranslation(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCustomTranslation(); }} placeholder="可选择候选，也可以自己修改" /></label>
        <div className="translation-float-actions"><button className="primary" disabled={!dictionaryTag.trim() || !dictionaryTranslation.trim()} onClick={saveCustomTranslation}>保存并应用</button></div>
        <div className="translation-float-meta"><span>只会联网发送当前英文标签，不会发送整段 Prompt</span><button disabled={dictionaryLoading || !loadOnlineDictionary} onClick={() => void refreshOnlineDictionary(false)}>{dictionaryLoading ? "更新中…" : "更新基础词库"}</button></div>
        <details><summary>我的翻译 {Object.keys(customTranslations).length} 条 · 基础词库 {getBuiltInTranslationCount() + Object.keys(onlineTranslations).length} 条</summary>{dictionaryStatus && <p>{dictionaryStatus}</p>}{onlineDictionaryMeta && <p>公共词典 {onlineDictionaryMeta.version} · {onlineDictionaryMeta.updatedAt}</p>}{!!Object.keys(customTranslations).length && <div className="dictionary-entries">{Object.entries(customTranslations).map(([tag, translation]) => <span key={tag}><b>{tag}</b><em>{translation}</em><button aria-label={`删除 ${tag} 的翻译`} onClick={() => { const next = { ...customTranslations }; delete next[tag]; persistCustomTranslations(next); }}>×</button></span>)}</div>}</details>
      </div>
    </aside>}
    <div className="prompt-section-list">{visibleSections.map((id) => {
      const definition = promptSectionDefinitions.find((section) => section.id === id)!;
      const selectedTag = sections[id].find((tag) => tag.id === selectedTagId);
      const selectedIndex = selectedTag ? sections[id].findIndex((tag) => tag.id === selectedTag.id) : -1;
      return <article className="prompt-section-card" key={id}>
        <header><div><h3>{definition.label}<small>{sections[id].length} 项</small></h3><p>{definition.hint}</p></div>{definition.optional && <button onClick={() => { if (selectedTag) setSelectedTagId(null); const hiddenIds = new Set(sections[id].map((tag) => tag.id)); setSelectedTagIds((current) => current.filter((tagId) => !hiddenIds.has(tagId))); setVisibleSections((current) => current.filter((item) => item !== id)); }}>收起</button>}</header>
        <div className="prompt-tag-input"><input value={inputs[id] || ""} onFocus={() => setActiveSuggestionSection(id)} onBlur={() => setTimeout(() => setActiveSuggestionSection((current) => current === id ? null : current), 120)} onChange={(event) => { setInputs((current) => ({ ...current, [id]: event.target.value })); setActiveSuggestionSection(id); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addInputTags(id); } }} placeholder={`添加${definition.label}标签…`} /><button onClick={() => addInputTags(id)}>添加</button></div>
        {activeSuggestionSection === id && !!tagSuggestions.length && <div className="prompt-tag-suggestions">{tagSuggestions.map((suggestion) => <button key={suggestion.name} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestedTag(id, suggestion.name)}><span>{suggestion.name}</span><small>{suggestion.count.toLocaleString()} 张</small></button>)}</div>}
        {!sections[id].length ? <div className="prompt-section-empty">暂时留空，不会向最终 Prompt 添加任何内容。</div> : <div className="prompt-tag-cloud">{sections[id].map((tag) => {
          const translation = showTranslations ? translateDanbooruTag(tag.text, mergedTranslations) : null;
          return <div className={`prompt-chip ${tag.enabled ? "" : "disabled"} ${selectedTagId === tag.id ? "selected" : ""} ${selectedTagIds.includes(tag.id) ? "bulk-selected" : ""} ${counts[tag.text.trim().toLowerCase()] > 1 ? "duplicate" : ""}`} key={tag.id}>
            <button className="prompt-chip-toggle" title={tag.enabled ? "停用标签" : "启用标签"} onClick={() => updateSection(id, (current) => current.map((item) => item.id === tag.id ? { ...item, enabled: !item.enabled } : item))}>{tag.enabled ? "✓" : "–"}</button>
            <button className="prompt-chip-main" onClick={() => bulkMode ? toggleBulkTag(tag.id) : setSelectedTagId((current) => current === tag.id ? null : tag.id)}><span>{tag.text}</span>{translation ? <small>{translation}</small> : showTranslations ? <small className="translation-missing">待补充</small> : null}{tag.weight !== 1 && <b>{Number(tag.weight.toFixed(2))}</b>}</button>
            <button className="prompt-chip-delete" aria-label={`删除 ${tag.text}`} title="删除标签" onClick={() => removeTag(id, tag.id)}>×</button>
          </div>;
        })}</div>}
        {selectedTag && !bulkMode && <div className="prompt-tag-inspector">
          <div className="prompt-inspector-title"><strong>编辑标签</strong><span>{showTranslations ? translateDanbooruTag(selectedTag.text, mergedTranslations) || "暂无本地翻译" : "英文标签将用于最终输出"}</span>{showTranslations && !translateDanbooruTag(selectedTag.text, mergedTranslations) && <button onClick={() => openTranslationDictionary(selectedTag.text)}>添加翻译</button>}<button onClick={() => setSelectedTagId(null)}>收起</button></div>
          <div className="prompt-inspector-fields">
            <input aria-label="英文提示词" value={selectedTag.text} onChange={(event) => updateSection(id, (current) => current.map((item) => item.id === selectedTag.id ? { ...item, text: event.target.value } : item))} />
            <select value={id} aria-label={`移动 ${selectedTag.text} 到分类`} onChange={(event) => changeTagSection(id, event.target.value as PromptSectionId, selectedTag.id)}>{promptSectionDefinitions.map((section) => <option value={section.id} key={section.id}>{section.label}</option>)}</select>
            <label>权重<input type="number" min="-9" max="9" step="0.05" value={selectedTag.weight} onChange={(event) => updateSection(id, (current) => current.map((item) => item.id === selectedTag.id ? { ...item, weight: Number(event.target.value) || 0 } : item))} /></label>
            <button disabled={selectedIndex === 0} onClick={() => moveTag(id, selectedIndex, -1)}>前移</button><button disabled={selectedIndex === sections[id].length - 1} onClick={() => moveTag(id, selectedIndex, 1)}>后移</button>
            <button className="prompt-tag-remove" onClick={() => removeTag(id, selectedTag.id)}>删除</button>
          </div>
        </div>}
      </article>;
    })}</div>
    {!!available.length && <div className="add-prompt-section"><select value={available.some((section) => section.id === addSection) ? addSection : available[0].id} onChange={(event) => setAddSection(event.target.value as PromptSectionId)}>{available.map((section) => <option value={section.id} key={section.id}>{section.label}</option>)}</select><button onClick={() => { const id = available.some((section) => section.id === addSection) ? addSection : available[0].id; setVisibleSections((current) => [...current, id]); }}>＋ 添加分类</button></div>}
    {undoDeletion && <div className="prompt-undo-toast" role="status"><span>{undoDeletion.message}</span><button onClick={() => { setSections(undoDeletion.sections); setUndoDeletion(null); }}>撤销</button><button className="dismiss" aria-label="关闭撤销提示" onClick={() => setUndoDeletion(null)}>×</button></div>}
  </section>;
}
