"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseArtistTags } from "./artist-parser";
import { importPromptTags, normalizePromptSections, normalizeVisiblePromptSections } from "./prompt-import";
import { basicPromptSections, createEmptyPromptSections, createPromptTags, formatNegativePrompt, formatPromptSections, PromptSectionEditor, PromptSectionId, PromptSections } from "./prompt-section-editor";
import { addTagsToActivePromptBasket, countAllPromptBasketTags, countPromptBasketTags, createPromptBasketState, getActivePromptBasket, normalizePromptBasketState, PromptBasketGroups, PromptBasketState, updateActivePromptBasketGroups } from "./prompt-baskets";
import { auditPromptSections, PromptAuditIssue, removePromptAuditTag } from "./prompt-audit";
import { clonePromptSections, countPromptPresetTags, createPromptPreset, normalizePromptPresetState, PromptPreset } from "./prompt-presets";
import { StyleDebugLab } from "./style-debug-lab";
import type { StyleExperimentDraft } from "./style-experiments";
import type { Artist, Recipe } from "./workbench-types";
import { createWeightExperiments } from "./weight-experiments";

type ActiveView = "workbench" | "prompt" | "danbooru" | "favorites" | "debug";
type DanbooruPost = { id: number; rating: string; previewUrl: string; imageUrl: string; postUrl: string; artistTags: string[]; generalTags: string[]; characterTags: string[]; copyrightTags: string[]; metaTags: string[] };
type DanbooruResult = { selectedTag: string | null; totalCount?: number; suggestions: { name: string; count: number }[]; posts: DanbooruPost[]; error?: string };
type WorkbenchDraft = {
  version: 1;
  updatedAt: number;
  recipeName: string;
  artists: Artist[];
  suffix: string;
  promptSections: PromptSections;
  visiblePromptSections: PromptSectionId[];
  promptImportText: string;
  activeRecipeId: string | null;
  activeView: ActiveView;
  debugRecipeId?: string | null;
};
type OnlineTagDictionary = { version: string; updatedAt: string; entries: Record<string, string> };
type TranslationLookupResult = { candidates: string[]; source: string };

declare global {
  interface Window {
    naiDesktop?: { searchDanbooru: (request: { q: string; mode: "artist" | "tag"; tag?: string; combo?: string[]; page?: number }) => Promise<DanbooruResult>; suggestDanbooru: (request: { q: string; mode: "artist" | "tag" }) => Promise<{ name: string; count: number }[]>; loadDanbooruImage: (url: string) => Promise<string>; loadTagDictionary: () => Promise<OnlineTagDictionary>; lookupTranslation: (tag: string) => Promise<TranslationLookupResult> };
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
  const [suffix, setSuffix] = useState("");
  const [promptSections, setPromptSections] = useState<PromptSections>(createEmptyPromptSections);
  const [visiblePromptSections, setVisiblePromptSections] = useState<PromptSectionId[]>(basicPromptSections);
  const [promptImportText, setPromptImportText] = useState("");
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
  const [booruFilters, setBooruFilters] = useState<string[]>([]);
  const [activeCombo, setActiveCombo] = useState<string[]>([]);
  const [promptBasket, setPromptBasket] = useState<PromptBasketState>(createPromptBasketState);
  const [basketOpen, setBasketOpen] = useState(false);
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>([]);
  const [promptPresetName, setPromptPresetName] = useState("");
  const [auditHasRun, setAuditHasRun] = useState(false);
  const [ignoredAuditIssues, setIgnoredAuditIssues] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("workbench");
  const [debugRecipeId, setDebugRecipeId] = useState<string | null>(null);
  const [referencePreviewIndex, setReferencePreviewIndex] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<DanbooruPost[]>([]);
  const [focusedPost, setFocusedPost] = useState<DanbooruPost | null>(null);
  const [selectedDetailTags, setSelectedDetailTags] = useState<string[]>([]);
  const [pinnedPostId, setPinnedPostId] = useState<number | null>(null);
  const [detailImage, setDetailImage] = useState("");
  const [detailPosition, setDetailPosition] = useState({ top: 12, left: 24, maxHeight: 720 });
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailRequestId = useRef(0);
  const importRecipesRef = useRef<HTMLInputElement>(null);
  const autocompleteCache = useRef(new Map<string, { name: string; count: number }[]>());
  const draftHydrated = useRef(false);

  const suggestDanbooruTags = useCallback(async (query: string, mode: "artist" | "tag" = "tag") => {
    const cacheKey = `${mode}:${query.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = autocompleteCache.current.get(cacheKey);
    if (cached) return cached;
    let suggestions: { name: string; count: number }[];
    if (window.naiDesktop) suggestions = await window.naiDesktop.suggestDanbooru({ q: query, mode });
    else {
      const params = new URLSearchParams({ q: query, mode, suggest: "1" });
      const response = await fetch(`/api/danbooru?${params}`);
      const data = await response.json() as { suggestions: { name: string; count: number }[] };
      suggestions = data.suggestions || [];
    }
    autocompleteCache.current.set(cacheKey, suggestions);
    return suggestions;
  }, []);
  const suggestPromptTags = useCallback((query: string) => suggestDanbooruTags(query, "tag"), [suggestDanbooruTags]);
  const loadOnlineTagDictionary = useCallback(async (): Promise<OnlineTagDictionary> => {
    if (window.naiDesktop?.loadTagDictionary) return window.naiDesktop.loadTagDictionary();
    const response = await fetch("/tag-translations.zh-CN.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`公共词典返回 ${response.status}`);
    return response.json();
  }, []);
  const lookupTagTranslation = useCallback(async (tag: string): Promise<TranslationLookupResult> => {
    if (window.naiDesktop?.lookupTranslation) return window.naiDesktop.lookupTranslation(tag);
    const response = await fetch(`/api/translate?q=${encodeURIComponent(tag)}`);
    const data = await response.json() as TranslationLookupResult & { error?: string };
    if (!response.ok) throw new Error(data.error || `翻译服务返回 ${response.status}`);
    return data;
  }, []);

  useEffect(() => {
    try {
      setRecipes(JSON.parse(localStorage.getItem("nai-style-recipes") || "[]"));
    } catch {
      setRecipes([]);
    }
    try { setFavorites(JSON.parse(localStorage.getItem("nai-style-favorites") || "[]")); } catch { setFavorites([]); }
    try { setPromptBasket(normalizePromptBasketState(JSON.parse(localStorage.getItem("nai-prompt-basket") || "{}"))); } catch { setPromptBasket(createPromptBasketState()); }
    try { setPromptPresets(normalizePromptPresetState(JSON.parse(localStorage.getItem("nai-prompt-presets") || "{}")).presets); } catch { setPromptPresets([]); }
    try {
      const draft = JSON.parse(localStorage.getItem("nai-workbench-draft") || "null") as WorkbenchDraft | null;
      if (draft?.version === 1 && draft.promptSections && Array.isArray(draft.visiblePromptSections)) {
        setRecipeName(draft.recipeName || "未命名画师串");
        setArtists(Array.isArray(draft.artists) ? draft.artists : []);
        setSuffix(draft.suffix || "");
        setPromptSections(normalizePromptSections(draft.promptSections));
        setVisiblePromptSections(normalizeVisiblePromptSections(draft.visiblePromptSections));
        setPromptImportText(draft.promptImportText || "");
        setActiveRecipeId(draft.activeRecipeId || null);
        setDebugRecipeId(draft.debugRecipeId || null);
        if (["workbench", "prompt", "danbooru", "favorites", "debug"].includes(draft.activeView)) setActiveView(draft.activeView);
        setNotice("已恢复上次未完成的草稿");
      }
    } catch {
      localStorage.removeItem("nai-workbench-draft");
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const persistDraft = () => {
      const draft: WorkbenchDraft = { version: 1, updatedAt: Date.now(), recipeName, artists, suffix, promptSections, visiblePromptSections, promptImportText, activeRecipeId, activeView, debugRecipeId };
      localStorage.setItem("nai-workbench-draft", JSON.stringify(draft));
    };
    const timer = setTimeout(persistDraft, 500);
    window.addEventListener("pagehide", persistDraft);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", persistDraft); };
  }, [recipeName, artists, suffix, promptSections, visiblePromptSections, promptImportText, activeRecipeId, activeView, debugRecipeId]);

  useEffect(() => {
    if (!basketOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setBasketOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [basketOpen]);

  useEffect(() => {
    if (referencePreviewIndex === null) return;
    const handlePreviewKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReferencePreviewIndex(null);
      if (event.key === "ArrowLeft") setReferencePreviewIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setReferencePreviewIndex((current) => current === null ? null : (current + 1) % images.length);
    };
    window.addEventListener("keydown", handlePreviewKey);
    return () => window.removeEventListener("keydown", handlePreviewKey);
  }, [referencePreviewIndex, images.length]);

  useEffect(() => {
    const query = booruQuery.trim();
    if (query.length < 2) { setAutocomplete([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestDanbooruTags(query, booruMode);
        if (!cancelled) setAutocomplete(suggestions);
      } catch { if (!cancelled) setAutocomplete([]); }
    }, 320);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [booruQuery, booruMode, suggestDanbooruTags]);

  const artistPrompt = useMemo(() => artists
    .filter((artist) => artist.enabled)
    .map((artist) => `${formatWeight(artist.weight)}::artist:${artist.name}::`)
    .join(", "), [artists]);

  const prompt = useMemo(() =>
    [formatPromptSections(promptSections), artistPrompt, suffix.trim()].filter(Boolean).join(", "),
  [artistPrompt, promptSections, suffix]);

  const negativePrompt = useMemo(() => formatNegativePrompt(promptSections), [promptSections]);
  const promptAuditIssues = useMemo(() => auditPromptSections(promptSections), [promptSections]);
  const visiblePromptAuditIssues = useMemo(() => promptAuditIssues.filter((issue) => !ignoredAuditIssues.includes(issue.id)), [promptAuditIssues, ignoredAuditIssues]);

  const experiments = useMemo(
    () => createWeightExperiments(artists, experimentAmplitude),
    [artists, experimentAmplitude],
  );

  const promptForWeights = (weights: number[]) => {
    const artistPart = artists
      .filter((artist) => artist.enabled)
      .map((artist) => `${formatWeight(weights[artists.indexOf(artist)])}::artist:${artist.name}::`)
      .join(", ");
    return [formatPromptSections(promptSections), artistPart, suffix.trim()].filter(Boolean).join(", ");
  };

  const persistPromptPresets = (next: PromptPreset[]) => {
    setPromptPresets(next);
    localStorage.setItem("nai-prompt-presets", JSON.stringify({ version: 1, presets: next }));
  };

  const savePromptPreset = () => {
    const tagCount = Object.values(promptSections).reduce((total, tags) => total + tags.length, 0);
    if (!tagCount) return;
    const name = promptPresetName.trim() || `提示词方案 ${promptPresets.length + 1}`;
    const preset = createPromptPreset(name, promptSections, visiblePromptSections);
    persistPromptPresets([preset, ...promptPresets]);
    setPromptPresetName("");
    setNotice(`已保存提示词方案「${preset.name}」`);
  };

  const applyPromptPreset = (preset: PromptPreset) => {
    setPromptSections(clonePromptSections(preset.sections));
    setVisiblePromptSections([...preset.visibleSections]);
    setNotice(`已应用提示词方案「${preset.name}」`);
  };

  const overwritePromptPreset = (preset: PromptPreset) => {
    const updated = createPromptPreset(preset.name, promptSections, visiblePromptSections, preset.id);
    updated.createdAt = preset.createdAt;
    persistPromptPresets(promptPresets.map((item) => item.id === preset.id ? updated : item));
    setNotice(`已用当前标签覆盖「${preset.name}」`);
  };

  const removePromptPreset = (preset: PromptPreset) => {
    persistPromptPresets(promptPresets.filter((item) => item.id !== preset.id));
    setNotice(`已删除提示词方案「${preset.name}」`);
  };

  const runPromptAudit = () => {
    setIgnoredAuditIssues([]);
    setAuditHasRun(true);
    setNotice(promptAuditIssues.length ? `体检发现 ${promptAuditIssues.length} 项需要确认` : "提示词体检完成，没有发现明确问题");
  };

  const locateAuditIssue = (issue: PromptAuditIssue) => {
    const section = issue.tags[0]?.section;
    if (!section) return;
    setVisiblePromptSections((current) => current.includes(section) ? current : [...current, section]);
    setTimeout(() => document.getElementById(`prompt-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
  };

  const removeAuditTag = (issue: PromptAuditIssue, tagId: string) => {
    const removed = issue.tags.find((tag) => tag.id === tagId);
    setPromptSections((current) => removePromptAuditTag(current, tagId));
    setNotice(removed ? `已移除 ${removed.text}` : "已移除标签");
  };

  const parse = () => {
    const next = parseArtistTags(raw).map((artist) => ({ ...artist, id: uid(), enabled: true }));
    setArtists(next);
    setNotice(next.length ? `已提取 ${next.length} 位画师` : "没有识别到 artist: 画师标签");
  };

  const importFullPrompt = () => {
    const importedArtists = parseArtistTags(promptImportText);
    const importedTags = importPromptTags(promptImportText);
    if (!importedArtists.length && !importedTags.length) {
      setNotice("没有识别到可导入的提示词");
      return;
    }

    setArtists((current) => {
      const existing = new Set(current.map((artist) => artist.name.toLowerCase()));
      return [...current, ...importedArtists
        .filter((artist) => !existing.has(artist.name.toLowerCase()))
        .map((artist) => ({ ...artist, id: uid(), enabled: true }))];
    });
    setPromptSections((current) => {
      const next: PromptSections = Object.fromEntries(Object.entries(current).map(([id, tags]) => [id, [...tags]])) as PromptSections;
      const existing = new Set(Object.values(current).flat().map((tag) => tag.text.trim().toLowerCase()));
      for (const imported of importedTags) {
        const key = imported.text.trim().toLowerCase();
        if (existing.has(key)) continue;
        existing.add(key);
        next[imported.section].push({ ...createPromptTags([imported.text])[0], weight: imported.weight });
      }
      return next;
    });
    const usedSections = [...new Set(importedTags.map((tag) => tag.section))];
    setVisiblePromptSections((current) => [...current, ...usedSections.filter((id) => !current.includes(id))]);
    setPromptImportText("");
    setNotice(`已导入 ${importedTags.length} 个普通标签${importedArtists.length ? `和 ${importedArtists.length} 位画师` : ""}`);
  };

  const updateArtist = (id: string, patch: Partial<Artist>) =>
    setArtists((current) => current.map((artist) => (artist.id === id ? { ...artist, ...patch } : artist)));

  const startNewRecipe = () => {
    setRaw("");
    setRecipeName("新画师串");
    setArtists([]);
    setPromptSections(createEmptyPromptSections());
    setVisiblePromptSections(basicPromptSections);
    setPromptImportText("");
    setSuffix("");
    setImages([]);
    setActiveRecipeId(null);
    setDebugRecipeId(null);
    setAuditHasRun(false);
    setIgnoredAuditIssues([]);
    setReferencePreviewIndex(null);
    setActiveView("workbench");
    setNotice("已新建空白画师串");
  };

  const persistRecipes = (next: Recipe[]) => {
    setRecipes(next);
    localStorage.setItem("nai-style-recipes", JSON.stringify(next));
  };

  const saveRecipe = () => {
    const recipe: Recipe = { id: activeRecipeId || uid(), name: recipeName.trim() || "未命名画师串", artists, suffix, promptSections, visiblePromptSections, images, createdAt: Date.now() };
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
    if (recipe.promptSections) {
      setPromptSections(normalizePromptSections(recipe.promptSections));
      setVisiblePromptSections(normalizeVisiblePromptSections(recipe.visiblePromptSections));
      setSuffix(recipe.suffix || "");
    } else {
      const migrated = createEmptyPromptSections();
      migrated.other = createPromptTags((recipe.suffix || "").split(","));
      setPromptSections(migrated);
      setVisiblePromptSections(migrated.other.length ? [...basicPromptSections, "other"] : basicPromptSections);
      setSuffix("");
    }
    setImages(recipe.images);
    setActiveRecipeId(recipe.id);
    setNotice(`已载入「${recipe.name}」`);
  };

  const removeRecipe = (id: string) => {
    const next = recipes.filter((recipe) => recipe.id !== id);
    persistRecipes(next);
    if (activeRecipeId === id) setActiveRecipeId(null);
  };

  const openStyleDebug = (recipe: Recipe) => {
    setDebugRecipeId(recipe.id);
    setActiveView("debug");
    setNotice(`已打开「${recipe.name}」调试模式`);
  };

  const debugSections = (recipe: Recipe, draft: StyleExperimentDraft) => {
    const sections = normalizePromptSections(recipe.promptSections);
    sections.quality = createPromptTags(draft.positiveTags);
    sections.negative = createPromptTags(draft.negativeTags);
    return sections;
  };

  const applyStyleDebugDraft = (recipe: Recipe, draft: StyleExperimentDraft) => {
    const sections = debugSections(recipe, draft);
    setRecipeName(recipe.name);
    setArtists(draft.artists.map((artist) => ({ ...artist, id: uid() })));
    setPromptSections(sections);
    setVisiblePromptSections([...new Set([...normalizeVisiblePromptSections(recipe.visiblePromptSections), ...(draft.positiveTags.length ? ["quality" as PromptSectionId] : []), ...(draft.negativeTags.length ? ["negative" as PromptSectionId] : [])])]);
    setSuffix(recipe.suffix || "");
    setImages(recipe.images);
    setActiveRecipeId(recipe.id);
    setActiveView("workbench");
    setNotice("已把调试方案应用到工作台");
  };

  const overwriteStyleDebugRecipe = (recipe: Recipe, draft: StyleExperimentDraft) => {
    const updated: Recipe = {
      ...recipe,
      artists: draft.artists.map((artist) => ({ ...artist })),
      promptSections: debugSections(recipe, draft),
      styleDebug: { modelId: draft.modelId, autoQuality: draft.autoQuality, ucPresetId: draft.ucPresetId, settings: { ...draft.settings } },
    };
    persistRecipes([updated, ...recipes.filter((item) => item.id !== recipe.id)]);
    setNotice(`已覆盖保存「${recipe.name}」的画师与质量参数`);
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
  const debugRecipe = useMemo(() => recipes.find((recipe) => recipe.id === debugRecipeId) || null, [recipes, debugRecipeId]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setNotice("新版 Prompt 已复制");
  };

  const copyArtistPrompt = async () => {
    await navigator.clipboard.writeText(artistPrompt);
    setNotice("画师串已复制");
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

  const searchDanbooru = async (tag?: string, page = 1, combined: string[] = []) => {
    if (!booruQuery.trim() && !tag && !combined.length) return;
    setBooruLoading(true);
    try {
      let data: DanbooruResult;
      if (window.naiDesktop) {
        data = await window.naiDesktop.searchDanbooru({ q: booruQuery, mode: booruMode, tag, combo: combined, page });
      } else {
        const params = new URLSearchParams({ q: booruQuery, mode: booruMode });
        if (tag) params.set("tag", tag);
        if (combined.length) params.set("combo", combined.join(","));
        params.set("page", String(page));
        const response = await fetch(`/api/danbooru?${params}`);
        data = await response.json() as DanbooruResult;
        if (!response.ok) throw new Error(data.error || "查询失败");
      }
      setBooruResult((current) => ({
        ...data,
        totalCount: data.totalCount || (current?.selectedTag === data.selectedTag ? current.totalCount : undefined),
        suggestions: data.suggestions.length ? data.suggestions : current?.suggestions || [],
      }));
      setBooruPage(page);
      setBooruPageInput(String(page));
      setActiveCombo(combined);
      setAutocomplete([]);
      setNotice(data.posts.length ? `已载入第 ${page} 页，共 ${data.posts.length} 张参考图` : "这一页没有参考图");
    } catch (error) {
      const message = error instanceof Error ? error.message : "查询失败";
      setBooruResult((current) => current ? { ...current, error: message } : { selectedTag: null, suggestions: [], posts: [], error: message });
      setNotice("Danbooru 查询失败，请稍后重试");
    } finally {
      setBooruLoading(false);
    }
  };

  const totalBooruPages = Math.max(1, Math.ceil((booruResult?.totalCount || 0) / 24));
  const searchBooruPage = (page: number) => searchDanbooru(activeCombo.length ? undefined : booruResult?.selectedTag || undefined, page, activeCombo);
  const jumpBooruPage = () => {
    const page = Math.max(1, Math.min(totalBooruPages, Number(booruPageInput) || 1));
    searchBooruPage(page);
  };

  const addBooruFilter = (value?: string) => {
    const tag = (value || booruResult?.selectedTag || booruQuery).trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag || tag.includes(" ")) return;
    setBooruFilters((current) => current.includes(tag) ? current : [...current, tag]);
    setNotice(`已把 ${tag} 加入组合查询`);
  };

  const persistPromptBasket = (next: PromptBasketState) => {
    setPromptBasket(next);
    localStorage.setItem("nai-prompt-basket", JSON.stringify(next));
  };

  const addToPromptBasket = (label: string, tags: string[]) => {
    const active = getActivePromptBasket(promptBasket);
    const previous = active.groups[label] || [];
    const next = addTagsToActivePromptBasket(promptBasket, label, tags);
    const nextTags = getActivePromptBasket(next).groups[label] || [];
    persistPromptBasket(next);
    const added = nextTags.length - previous.length;
    setNotice(added ? `已把 ${added} 项${label}标签加入「${active.name}」` : "这些标签已经在当前小篮子中");
  };

  const clearPromptBasket = () => persistPromptBasket(updateActivePromptBasketGroups(promptBasket, () => ({})));
  const removePromptBasketTag = (label: string, tag: string) => {
    persistPromptBasket(updateActivePromptBasketGroups(promptBasket, (groups) => {
      const remaining = (groups[label] || []).filter((item) => item !== tag);
      const next = { ...groups };
      if (remaining.length) next[label] = remaining;
      else delete next[label];
      return next;
    }));
  };

  const activePromptBasket = getActivePromptBasket(promptBasket);
  const basketTagCount = countPromptBasketTags(activePromptBasket);
  const allBasketTagCount = countAllPromptBasketTags(promptBasket);

  const createMiniBasket = () => {
    const number = promptBasket.baskets.length + 1;
    const id = `basket-${Date.now()}-${uid()}`;
    persistPromptBasket({ ...promptBasket, baskets: [...promptBasket.baskets, { id, name: `小篮子 ${number}`, groups: {} }] });
    setNotice(`已新建「小篮子 ${number}」，当前接收目标仍是「${activePromptBasket.name}」`);
  };

  const renameActiveBasket = (name: string) => persistPromptBasket({
    ...promptBasket,
    baskets: promptBasket.baskets.map((basket) => basket.id === activePromptBasket.id ? { ...basket, name: name.slice(0, 30) } : basket),
  });

  const deleteActiveBasket = () => {
    if (promptBasket.baskets.length <= 1) return;
    const baskets = promptBasket.baskets.filter((basket) => basket.id !== activePromptBasket.id);
    persistPromptBasket({ ...promptBasket, activeId: baskets[0].id, baskets });
    setNotice(`已删除「${activePromptBasket.name}」，现在启用「${baskets[0].name}」`);
  };

  const addTagsToPromptSection = (id: PromptSectionId, tags: string[]) => {
    const readable = tags.map((tag) => tag.replace(/_/g, " ").trim()).filter(Boolean);
    setPromptSections((current) => {
      const existing = new Set(current[id].map((tag) => tag.text.toLowerCase()));
      return { ...current, [id]: [...current[id], ...createPromptTags(readable.filter((tag) => !existing.has(tag.toLowerCase())))] };
    });
    if (!basicPromptSections.includes(id)) setVisiblePromptSections((current) => current.includes(id) ? current : [...current, id]);
  };

  const promptSectionForLabel = (label: string): PromptSectionId => {
    if (label === "人物衣着") return "clothing";
    if (label === "动作") return "action";
    if (label === "构图视角") return "composition";
    if (["作品", "成人内容", "分级与审查", "其他提示词", "元数据"].includes(label)) return "other";
    if (["发色", "眼睛", "表情", "角色特征", "身体特征"].includes(label)) return "features";
    return "character";
  };

  const sendBasketToWorkbench = () => {
    const groups = activePromptBasket.groups;
    const basketArtists = (groups["画师"] || []).map((tag) => tag.replace(/_/g, " "));
    const newArtists = basketArtists.filter((name) => !artists.some((artist) => artist.name.toLowerCase() === name.toLowerCase()));
    setArtists((current) => [...current, ...newArtists.map((name) => ({ id: uid(), name, weight: 1, enabled: true }))]);
    Object.entries(groups).filter(([label]) => label !== "画师").forEach(([label, tags]) => addTagsToPromptSection(promptSectionForLabel(label), tags));
    setActiveView("prompt");
    clearPromptBasket();
    setBasketOpen(false);
    setNotice(`已发送「${activePromptBasket.name}」中的 ${basketTagCount} 项并清空该篮`);
  };

  const useDanbooruTag = (tag: string) => {
    const normalized = tag.replace(/_/g, " ");
    if (booruMode === "artist") {
      if (!artists.some((artist) => artist.name.toLowerCase() === normalized.toLowerCase())) {
        setArtists((current) => [...current, { id: uid(), name: normalized, weight: 1, enabled: true }]);
      }
      setNotice(`已把画师 ${normalized} 加入当前画师串`);
    } else {
      addTagsToPromptSection("other", [tag]);
      setActiveView("prompt");
      setNotice(`已把提示词 ${normalized} 加入提示词编辑器`);
    }
  };

  const toggleFavorite = (post: DanbooruPost) => {
    const next = favorites.some((item) => item.id === post.id) ? favorites.filter((item) => item.id !== post.id) : [post, ...favorites];
    setFavorites(next);
    localStorage.setItem("nai-style-favorites", JSON.stringify(next));
  };

  const positionPostDetail = (anchor?: HTMLElement) => {
    const viewportHeight = Math.max(320, window.innerHeight - 24);
    if (!anchor || window.innerWidth <= 650) { setDetailPosition({ top: 12, left: 12, maxHeight: viewportHeight }); return; }
    const rect = anchor.getBoundingClientRect();
    const gap = 12;
    const width = Math.min(850, window.innerWidth - 32);
    const rightSide = rect.right + gap;
    const leftSide = rect.left - width - gap;
    const left = rightSide + width <= window.innerWidth - 12
      ? rightSide
      : leftSide >= 12 ? leftSide : Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const estimatedHeight = Math.min(720, viewportHeight);
    const centeredTop = rect.top + rect.height / 2 - estimatedHeight / 2;
    const top = Math.max(12, Math.min(centeredTop, window.innerHeight - estimatedHeight - 12));
    setDetailPosition({ top, left, maxHeight: window.innerHeight - top - 12 });
  };

  const showPost = async (post: DanbooruPost, pinned = false, anchor?: HTMLElement) => {
    const requestId = ++detailRequestId.current;
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    positionPostDetail(anchor);
    if (focusedPost?.id !== post.id) setSelectedDetailTags([]);
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
    const groups = generalGroups(post.generalTags);
    addTagsToPromptSection("character", [...post.copyrightTags, ...post.characterTags, ...groups.subjects, ...groups.hairColor, ...groups.eyes, ...groups.expressions, ...groups.features, ...groups.body]);
    addTagsToPromptSection("clothing", groups.clothing);
    addTagsToPromptSection("action", groups.actions);
    if (groups.composition.length) addTagsToPromptSection("composition", groups.composition);
    if ([...groups.adult, ...groups.censorship, ...groups.other].length) addTagsToPromptSection("other", [...groups.adult, ...groups.censorship, ...groups.other]);
    setActiveView("prompt");
    setNotice(`已发送作品 #${post.id} 的画师和提示词到提示词编辑器`);
  };

  function generalGroups(tags: string[]) {
    const subjectWords = /^(?:solo|1girl|1boy|2girls|2boys|3girls|3boys|4girls|4boys|multiple_girls|multiple_boys|male_focus|female_focus)$/;
    const clothingWords = /dress|shirt|skirt|pants|shorts|uniform|jacket|coat|sleeve|shoes|boots|hat|gloves|swimsuit|bikini|lingerie|clothes|hoodie|kimono|armor|stockings|thighhighs|pantyhose|bra|necktie|ribbon|collar|choker|apron|robe|sweater|cardigan|socks|footwear|bare_shoulders|off_shoulder|cleavage|navel|midriff/;
    const censorWords = /^(?:censored|uncensored|mosaic_censoring|bar_censor|blank_censor|blur_censor|convenient_censoring|light_censor|identity_censor|fake_censor|partially_censored)$/;
    const adultWords = /anal|fellatio|cum|sex|masturbation|butt_plug|dildo|vibrator|penetration|paizuri|handjob|footjob|oral|orgasm|ejaculation|nipple_stimulation|bondage|tentacle|groping/;
    const expressionWords = /blush|smile|smiling|grin|open_mouth|closed_mouth|frown|crying|tears|angry|surprised|embarrassed|expressionless|tongue|winking/;
    const actionWords = /sitting|standing|walking|running|lying|looking|holding|fighting|dancing|jumping|kneeling|pose|reaching|sleeping|eating|drinking|grabbing|pulling|hugging|kissing|arms_|hand_on|hands_on|head_tilt/;
    const compositionWords = /focus|foreshortening|perspective|view|angle|close-up|upper_body|lower_body|full_body|cowboy_shot|portrait|from_above|from_below|dutch_angle|depth_of_field|cropped|out_of_frame/;
    const hairColorWords = /(?:black|brown|blonde|yellow|red|orange|green|blue|purple|pink|white|grey|gray|silver|aqua|multicolored|two-tone)_hair/;
    const eyeWords = /(?:black|brown|yellow|red|orange|green|blue|purple|pink|white|grey|gray|aqua|heterochromia)_eyes|closed_eyes|one_eye_closed/;
    const featureWords = /long_hair|short_hair|medium_hair|very_long_hair|twintails|ponytail|braid|bangs|ahoge|hair_between_eyes|hair_ornament|bald|animal_ears|cat_ears|fox_ears|dog_ears|horns|tail|wings|fang|freckles|mole|dark_skin|dark-skinned|dark_skinned|pale_skin|tan|muscular|petite|curvy|glasses/;
    const bodyWords = /^(?:ass|anus|feet|foot|breasts|large_breasts|medium_breasts|small_breasts|flat_chest|nipples|navel|thighs|legs|armpits|back|stomach|penis|pussy)$/;
    const subjects = tags.filter((tag) => subjectWords.test(tag));
    const clothing = tags.filter((tag) => clothingWords.test(tag));
    const censorship = tags.filter((tag) => censorWords.test(tag));
    const adult = tags.filter((tag) => adultWords.test(tag) && !censorWords.test(tag));
    const hairColor = tags.filter((tag) => hairColorWords.test(tag));
    const eyes = tags.filter((tag) => eyeWords.test(tag));
    const features = tags.filter((tag) => featureWords.test(tag) && !hairColorWords.test(tag) && !eyeWords.test(tag));
    const body = tags.filter((tag) => bodyWords.test(tag));
    const expressions = tags.filter((tag) => expressionWords.test(tag) && !eyeWords.test(tag));
    const actions = tags.filter((tag) => actionWords.test(tag) && !adultWords.test(tag));
    const composition = tags.filter((tag) => compositionWords.test(tag) && !clothingWords.test(tag));
    const ordered = [subjects, clothing, hairColor, eyes, features, body, expressions, actions, composition, adult, censorship];
    return {
      subjects,
      clothing,
      hairColor,
      eyes,
      features,
      body,
      expressions,
      actions,
      composition,
      adult,
      censorship,
      other: tags.filter((tag) => !ordered.some((group) => group.includes(tag))),
    };
  }

  const copyTagGroup = async (label: string, tags: string[]) => {
    await navigator.clipboard.writeText(tags.join(", "));
    setNotice(`已复制${label}标签，共 ${tags.length} 项`);
  };

  const toggleDetailTag = (tag: string) => setSelectedDetailTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);

  const copySelectedDetailTags = async () => {
    if (!selectedDetailTags.length) return;
    await navigator.clipboard.writeText(selectedDetailTags.join(", "));
    setNotice(`已复制选中的 ${selectedDetailTags.length} 项标签`);
  };

  const detailTagGroups: [string, string[]][] = focusedPost ? [
    ["画师", focusedPost.artistTags],
    ["角色", focusedPost.characterTags],
    ["作品", focusedPost.copyrightTags],
    ["人物数量", generalGroups(focusedPost.generalTags).subjects],
    ["发色", generalGroups(focusedPost.generalTags).hairColor],
    ["眼睛", generalGroups(focusedPost.generalTags).eyes],
    ["表情", generalGroups(focusedPost.generalTags).expressions],
    ["角色特征", generalGroups(focusedPost.generalTags).features],
    ["身体特征", generalGroups(focusedPost.generalTags).body],
    ["人物衣着", generalGroups(focusedPost.generalTags).clothing],
    ["动作", generalGroups(focusedPost.generalTags).actions],
    ["构图视角", generalGroups(focusedPost.generalTags).composition],
    ["成人内容", generalGroups(focusedPost.generalTags).adult],
    ["分级与审查", generalGroups(focusedPost.generalTags).censorship],
    ["其他提示词", generalGroups(focusedPost.generalTags).other],
    ["元数据", focusedPost.metaTags],
  ] : [];

  const addSelectedTagsToBasket = () => {
    if (!selectedDetailTags.length) return;
    const selected = new Set(selectedDetailTags);
    let groups: PromptBasketGroups = { ...activePromptBasket.groups };
    for (const [label, tags] of detailTagGroups) {
      const picked = tags.filter((tag) => selected.has(tag));
      if (picked.length) groups = { ...groups, [label]: [...new Set([...(groups[label] || []), ...picked])] };
    }
    persistPromptBasket(updateActivePromptBasketGroups(promptBasket, () => groups));
    setNotice(`已把选中的 ${selectedDetailTags.length} 项标签加入「${activePromptBasket.name}」`);
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
          <button className={activeView === "prompt" ? "active" : ""} onClick={() => setActiveView("prompt")}>提示词编辑器</button>
          <button className={activeView === "danbooru" ? "active" : ""} onClick={() => setActiveView("danbooru")}>Danbooru 画廊</button>
          <button className={activeView === "favorites" ? "active" : ""} onClick={() => setActiveView("favorites")}>收藏 {favorites.length ? `(${favorites.length})` : ""}</button>
          {(debugRecipe || activeRecipeId) && <button className={activeView === "debug" ? "active" : ""} onClick={() => { const recipe = debugRecipe || recipes.find((item) => item.id === activeRecipeId); if (recipe) openStyleDebug(recipe); }}>画师调试</button>}
        </nav>
        <div className="top-actions">
          <span className="status">{notice || "本地保存 · 不上传图片"}</span>
          <button className={`basket-toggle ${allBasketTagCount ? "has-items" : ""}`} onClick={() => setBasketOpen((current) => !current)}>暂存篮<span>{allBasketTagCount}</span></button>
          {activeView === "workbench" && <><button className="button secondary" onClick={startNewRecipe}>＋ 新建</button>
          <button className="button primary" onClick={saveRecipe}>{activeRecipeId ? "更新配方" : "保存配方"}</button></>}
        </div>
      </header>

      {basketOpen && <><button className="basket-backdrop" aria-label="关闭 Tag 暂存篮" onClick={() => setBasketOpen(false)} /><aside className="basket-drawer" role="dialog" aria-label="Tag 暂存篮">
        <header><div><strong>Tag 小篮子</strong><span>仅有一个接收目标 · 共暂存 {allBasketTagCount} 项</span></div><button aria-label="关闭 Tag 暂存篮" onClick={() => setBasketOpen(false)}>×</button></header>
        <div className="basket-tabs"><div>{promptBasket.baskets.map((basket) => <button className={basket.id === activePromptBasket.id ? "active" : ""} key={basket.id} onClick={() => persistPromptBasket({ ...promptBasket, activeId: basket.id })}><span>{basket.name}</span><small>{countPromptBasketTags(basket)}</small></button>)}</div><button className="basket-create" onClick={createMiniBasket}>＋ 新建小篮子</button></div>
        <div className="basket-active-settings"><label><span>当前启用</span><input value={activePromptBasket.name} onChange={(event) => renameActiveBasket(event.target.value)} /></label><span>新标签会进入这个小篮子</span><button disabled={promptBasket.baskets.length <= 1} onClick={deleteActiveBasket}>删除此篮</button></div>
        <div className="basket-drawer-body">{basketTagCount ? <div className="basket-drawer-groups">{Object.entries(activePromptBasket.groups).filter(([, tags]) => tags.length).map(([label, tags]) => <section key={label}><header><b>{label}</b><small>{tags.length} 项</small></header><div>{tags.map((tag) => <span key={tag}>{tag}<button aria-label={`从暂存篮移除 ${tag}`} onClick={() => removePromptBasketTag(label, tag)}>×</button></span>)}</div></section>)}</div> : <div className="basket-drawer-empty"><b>这个小篮子还是空的</b><span>在作品预览框中点击标签右侧的“＋”，标签就会进入当前启用的小篮子。</span><button onClick={() => { setBasketOpen(false); setActiveView("danbooru"); }}>前往 Danbooru 画廊</button></div>}</div>
        <footer><button className="clear" disabled={!basketTagCount} onClick={clearPromptBasket}>清空当前篮</button><button className="send" disabled={!basketTagCount} onClick={sendBasketToWorkbench}>发送当前篮并清空</button></footer>
      </aside></>}

      {activeView === "debug" && debugRecipe && <StyleDebugLab recipe={debugRecipe} onBack={() => setActiveView("workbench")} onApply={(draft) => applyStyleDebugDraft(debugRecipe, draft)} onOverwrite={(draft) => overwriteStyleDebugRecipe(debugRecipe, draft)} />}
      {activeView === "debug" && !debugRecipe && <section className="style-debug-missing"><strong>没有找到要调试的画师串</strong><span>请先在“已保存的画师串”中点击“调试”。</span><button className="button primary" onClick={() => setActiveView("workbench")}>返回工作台</button></section>}

      {activeView === "danbooru" && <section className="gallery-page">
        <div className="gallery-title"><div><p className="eyebrow">DANBOORU EXPLORER</p><h2>画师与提示词参考画廊</h2><p>查询标签、浏览作品，并把画师或提示词送回工作台。</p></div><button className="button secondary" onClick={() => setActiveView("workbench")}>返回工作台</button></div>
        <section className="panel danbooru-panel">
          <div className="panel-heading"><div><span className="step">DB</span><h2>Danbooru 参考库</h2></div><span className="safe-badge">全部分级</span></div>
          <div className="booru-search">
            <select value={booruMode} onChange={(event) => { setBooruMode(event.target.value as "artist" | "tag"); setBooruResult(null); setBooruPage(1); }} aria-label="查询类型"><option value="artist">画师</option><option value="tag">提示词</option></select>
            <div className="booru-input-wrap"><input value={booruQuery} onChange={(event) => setBooruQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchDanbooru(); }} placeholder={booruMode === "artist" ? "输入画师名，如 honashi" : "输入英文标签，如 cinematic lighting"} />{!!autocomplete.length && <div className="booru-autocomplete">{autocomplete.map((tag) => <button key={tag.name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setBooruQuery(tag.name); searchDanbooru(tag.name, 1); }}><span>{tag.name}</span><small>{tag.count.toLocaleString()} 张</small></button>)}</div>}</div>
            <button className="button primary" disabled={booruLoading} onClick={() => searchDanbooru()}>{booruLoading ? "查询中…" : "查询"}</button>
          </div>
          <div className="combo-builder">
            <div><strong>组合查询</strong>{booruFilters.length ? booruFilters.map((tag) => <button className="combo-chip" key={tag} onClick={() => setBooruFilters((current) => current.filter((item) => item !== tag))}>{tag}<span>×</span></button>) : <span>把角色、衣着、动作等标签组合起来查询</span>}</div>
            <div><button className="button secondary" onClick={() => addBooruFilter()}>＋ 加入当前标签</button><button className="button primary" disabled={!booruFilters.length || booruLoading} onClick={() => searchDanbooru(undefined, 1, booruFilters)}>查询组合</button>{!!booruFilters.length && <button className="text-button" onClick={() => setBooruFilters([])}>清空</button>}</div>
          </div>
          {booruResult?.error && <div className="booru-error">{booruResult.error}</div>}
          {!!booruResult?.suggestions.length && <div className="booru-suggestions">{booruResult.suggestions.map((tag) => <button className={tag.name === booruResult.selectedTag ? "active" : ""} key={tag.name} onClick={() => searchDanbooru(tag.name)}>{tag.name}<small>{tag.count.toLocaleString()}</small></button>)}</div>}
          {booruResult?.selectedTag && <div className="booru-selected"><span>当前：{booruResult.selectedTag}</span><button onClick={() => useDanbooruTag(booruResult.selectedTag!)}>{booruMode === "artist" ? "＋ 加入画师串" : "＋ 加入提示词"}</button></div>}
          {!!booruResult?.posts.length && <><div className="booru-grid">{booruResult.posts.map((post) => <article className="booru-card" key={post.id} onMouseEnter={(event) => { keepPostOpen(); showPost(post, false, event.currentTarget); }} onMouseLeave={() => schedulePostClose(post.id)}><button className={`favorite-star ${favorites.some((item) => item.id === post.id) ? "active" : ""}`} aria-label="收藏作品" onClick={(event) => { event.stopPropagation(); toggleFavorite(post); }}>★</button><button className="booru-image-button" onClick={(event) => showPost(post, true, event.currentTarget.parentElement || event.currentTarget)}><img src={post.previewUrl} alt={`${booruResult.selectedTag} 参考图`} loading="lazy" /><span>#{post.id} · {post.rating.toUpperCase()}</span></button></article>)}</div><div className="booru-pages"><button disabled={booruPage === 1 || booruLoading} onClick={() => searchBooruPage(1)}>首页</button><button disabled={booruPage === 1 || booruLoading} onClick={() => searchBooruPage(booruPage - 1)}>上一页</button><label>第 <input type="number" min="1" max={totalBooruPages} value={booruPageInput} onChange={(event) => setBooruPageInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") jumpBooruPage(); }} /> / {totalBooruPages} 页</label><button disabled={booruLoading} onClick={jumpBooruPage}>跳转</button><button disabled={booruLoading || booruPage >= totalBooruPages} onClick={() => searchBooruPage(booruPage + 1)}>下一页</button></div></>}
          {!booruResult && <div className="booru-intro">查询 Danbooru 的画师标签和提示词参考图。图片版权归原作者，点击缩略图可查看原帖。</div>}
        </section>
      </section>}

      {activeView === "favorites" && <section className="gallery-page"><div className="gallery-title"><div><p className="eyebrow">LOCAL FAVORITES</p><h2>收藏的参考作品</h2><p>收藏仅保存在当前设备。</p></div></div>{favorites.length ? <div className="favorite-grid">{favorites.map((post) => <article className="favorite-card" key={post.id}><button className="favorite-star active" onClick={() => toggleFavorite(post)}>★</button><button className="booru-image-button" onClick={(event) => showPost(post, true, event.currentTarget.parentElement || event.currentTarget)}><img src={post.previewUrl} alt={`收藏作品 ${post.id}`} /><span>#{post.id}</span></button></article>)}</div> : <div className="library-empty">还没有收藏作品，请在 Danbooru 画廊点击图片左上角的星号。</div>}</section>}

      {activeView === "prompt" && <section className="prompt-page">
        <div className="gallery-title"><div><p className="eyebrow">NOVELAI PROMPT EDITOR</p><h2>分区提示词编辑器</h2><p>只添加画面真正需要的内容，最终自动整理为 NovelAI 格式 · 草稿自动保存在本机。</p></div><button className="button secondary" onClick={() => setActiveView("workbench")}>调整画师串</button></div>
        <div className="prompt-page-grid">
          <div className="prompt-page-main">
            <section className="panel prompt-import-panel">
              <div className="panel-heading"><div><span className="step">IN</span><h2>导入已有 Prompt</h2></div><span className="counter">只追加，不覆盖</span></div>
              <p>粘贴完整的 NovelAI Prompt，程序会保留数字权重与大括号、方括号强弱关系，并自动整理分类。</p>
              <textarea value={promptImportText} onChange={(event) => setPromptImportText(event.target.value)} placeholder="例如：1girl, pink_hair, 1.2::smile::, black_dress, from_above…" />
              <div className="prompt-import-actions"><button className="button primary" disabled={!promptImportText.trim()} onClick={importFullPrompt}>智能分类并加入</button><button className="button secondary" disabled={!promptImportText} onClick={() => setPromptImportText("")}>清空</button></div>
            </section>
            <PromptSectionEditor sections={promptSections} setSections={setPromptSections} visibleSections={visiblePromptSections} setVisibleSections={setVisiblePromptSections} suggestTags={suggestPromptTags} loadOnlineDictionary={loadOnlineTagDictionary} lookupTranslation={lookupTagTranslation} />
          </div>
          <aside className="prompt-page-side">
            <section className="panel artist-context-panel">
              <div className="panel-heading"><div><span className="step">A</span><h2>当前画师串</h2></div><button className="text-button" onClick={() => setActiveView("workbench")}>编辑</button></div>
              <div className="artist-context-copy"><strong>{recipeName}</strong><span>{artists.filter((artist) => artist.enabled).length} 位启用画师</span></div>
              <pre>{artistPrompt || "尚未添加画师，可先只编辑普通提示词。"}</pre>
            </section>
            <section className="panel output-panel prompt-final-output">
              <div className="panel-heading"><div><span className="step">OUT</span><h2>最终 Prompt</h2></div><button className="button primary" disabled={!prompt} onClick={copyPrompt}>复制 Prompt</button></div>
              <pre>{prompt || "添加标签或画师后，这里会实时生成结果。"}</pre>
              {negativePrompt && <><div className="negative-label">Undesired Content</div><pre className="negative-output">{negativePrompt}</pre></>}
            </section>
            <section className="panel prompt-audit-panel">
              <div className="panel-heading"><div><span className="step">QC</span><h2>提示词体检</h2></div><button className="prompt-audit-run" onClick={runPromptAudit}>{auditHasRun ? "重新体检" : "开始体检"}</button></div>
              {!auditHasRun ? <div className="prompt-audit-intro"><strong>检查明确问题，不评价画风</strong><span>找出冲突、重复、可精简词和明显错放的分类；不会自动删除任何标签。</span></div> : <>
                <div className={`prompt-audit-summary ${visiblePromptAuditIssues.length ? "has-issues" : "clean"}`}><strong>{visiblePromptAuditIssues.length ? `还有 ${visiblePromptAuditIssues.length} 项需要确认` : "没有发现明确问题"}</strong><span>{promptAuditIssues.length - visiblePromptAuditIssues.length ? `已忽略 ${promptAuditIssues.length - visiblePromptAuditIssues.length} 项` : "体检结果会随当前标签实时更新"}</span></div>
                <div className="prompt-audit-list">{visiblePromptAuditIssues.map((issue) => {
                  const removableTags = issue.suggestedRemovalIds?.length ? issue.tags.filter((tag) => issue.suggestedRemovalIds?.includes(tag.id)) : issue.severity === "conflict" ? issue.tags : [];
                  return <article className={`prompt-audit-issue ${issue.severity}`} key={issue.id}>
                    <header><span>{issue.severity === "conflict" ? "冲突" : issue.severity === "warning" ? "提醒" : "可精简"}</span><strong>{issue.title}</strong></header>
                    <p>{issue.description}</p>
                    {!!issue.tags.length && <div className="prompt-audit-tags">{issue.tags.map((tag) => <span key={`${tag.section}-${tag.id}`}>{tag.text}</span>)}</div>}
                    <div className="prompt-audit-actions">{!!issue.tags.length && <button onClick={() => locateAuditIssue(issue)}>定位</button>}{removableTags.map((tag) => <button className="remove" key={tag.id} onClick={() => removeAuditTag(issue, tag.id)}>移除 {tag.text}</button>)}<button className="ignore" onClick={() => setIgnoredAuditIssues((current) => [...current, issue.id])}>忽略</button></div>
                  </article>;
                })}</div>
              </>}
            </section>
            <section className="panel prompt-preset-panel">
              <div className="panel-heading"><div><span className="step">S</span><h2>提示词方案</h2></div><span className="counter">{promptPresets.length} 个</span></div>
              <p>保存当前全部分区，之后可一键恢复不同角色与衣着搭配。</p>
              <div className="prompt-preset-create"><input value={promptPresetName} maxLength={40} onChange={(event) => setPromptPresetName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") savePromptPreset(); }} placeholder={`提示词方案 ${promptPresets.length + 1}`} /><button disabled={!Object.values(promptSections).some((tags) => tags.length)} onClick={savePromptPreset}>保存当前</button></div>
              <div className="prompt-preset-list">{promptPresets.length ? promptPresets.map((preset) => <article key={preset.id}><div><strong>{preset.name}</strong><span>{countPromptPresetTags(preset)} 个标签 · {new Date(preset.updatedAt).toLocaleDateString("zh-CN")}</span></div><div><button className="apply" onClick={() => applyPromptPreset(preset)}>应用</button><button onClick={() => overwritePromptPreset(preset)}>覆盖</button><button className="remove" onClick={() => removePromptPreset(preset)}>删除</button></div></article>) : <div className="prompt-preset-empty">还没有保存方案。整理好一套标签后，可在这里留下快照。</div>}</div>
            </section>
          </aside>
        </div>
      </section>}

      {focusedPost && <aside className={`post-detail ${pinnedPostId === focusedPost.id ? "pinned" : ""}`} style={{ top: detailPosition.top, left: detailPosition.left, maxHeight: detailPosition.maxHeight }} onMouseEnter={keepPostOpen} onMouseLeave={() => schedulePostClose(focusedPost.id)}><button className="detail-close" onClick={() => { keepPostOpen(); setFocusedPost(null); setPinnedPostId(null); setSelectedDetailTags([]); setDetailImage(""); }}>×</button><div className="detail-image">{detailImage ? <img src={detailImage} alt={`作品 ${focusedPost.id} 高清预览`} /> : <span>高清图加载中…</span>}</div><div className="detail-copy"><div className="detail-title"><h3>作品 #{focusedPost.id}</h3><span>{pinnedPostId === focusedPost.id ? "已固定" : "移入面板可暂留 · 点击图片固定"}</span></div><div className="selected-tags-toolbar"><span>已选 {selectedDetailTags.length} 项</span><button disabled={!selectedDetailTags.length} onClick={copySelectedDetailTags}>复制已选</button><button disabled={!selectedDetailTags.length} onClick={addSelectedTagsToBasket}>暂存已选</button><button disabled={!selectedDetailTags.length} onClick={() => setSelectedDetailTags([])}>清空选择</button></div>{detailTagGroups.map(([label, tags]) => !!tags.length && <section className="tag-group" key={label}><header><h4>{label}</h4><div className="group-actions"><button className="copy-group" onClick={() => copyTagGroup(label, tags)}>复制全部</button><button className="basket-group" onClick={() => addToPromptBasket(label, tags)}>＋ 暂存</button></div></header><div className="tag-list">{tags.map((tag) => <span className={`detail-tag ${selectedDetailTags.includes(tag) ? "selected" : ""}`} key={tag}><button className="tag-copy" title={`单独复制 ${tag}`} onClick={() => { navigator.clipboard.writeText(tag); setNotice(`已复制 ${tag}`); }}>{tag}</button><button className="tag-select" title={`${selectedDetailTags.includes(tag) ? "取消选择" : "选择"} ${tag}`} aria-label={`${selectedDetailTags.includes(tag) ? "取消选择" : "选择"} ${tag}`} onClick={() => toggleDetailTag(tag)}>✓</button><button className="tag-add" title={`单独暂存 ${tag}`} aria-label={`单独暂存 ${tag}`} onClick={() => addToPromptBasket(label, [tag])}>＋</button></span>)}</div></section>)}<div className="detail-actions"><button className="button primary" onClick={() => sendPostToWorkbench(focusedPost)}>发送提示词到工作台</button><a className="button secondary" href={focusedPost.postUrl} target="_blank" rel="noreferrer">打开 Danbooru 原帖</a></div></div></aside>}

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
                  <button className="reference-preview-button" aria-label={`双击预览参考图 ${index + 1}`} title="双击查看大图" onDoubleClick={() => setReferencePreviewIndex(index)}><img src={src} alt={`参考图 ${index + 1}`} /></button>
                  <button aria-label={`删除参考图 ${index + 1}`} onDoubleClick={(event) => event.stopPropagation()} onClick={() => { setImages((current) => current.filter((_, i) => i !== index)); if (referencePreviewIndex === index) setReferencePreviewIndex(null); }}>×</button>
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
            <div className="panel-heading"><div><span className="step">04</span><h2>画师串输出</h2></div><button className="button primary" disabled={!artistPrompt} onClick={copyArtistPrompt}>复制画师串</button></div>
            <pre>{artistPrompt || "等待添加画师……"}</pre>
            <div className="prompt-editor-entry"><span>角色、衣着、动作等普通标签已移至独立页面。</span><button onClick={() => setActiveView("prompt")}>打开提示词编辑器 →</button></div>
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
              <div className="recipe-actions"><button onClick={() => loadRecipe(recipe)}>载入</button><button className="debug" onClick={() => openStyleDebug(recipe)}>调试</button><button className="delete" onClick={() => removeRecipe(recipe.id)}>删除</button></div>
            </article>
          ))}
        </div>
      </section>
      </>}
      {referencePreviewIndex !== null && images[referencePreviewIndex] && <><button className="reference-lightbox-backdrop" aria-label="关闭参考图预览" onClick={() => setReferencePreviewIndex(null)} /><aside className="reference-lightbox" role="dialog" aria-modal="true" aria-label={`参考图 ${referencePreviewIndex + 1} 大图预览`}><header><div><strong>参考图 {referencePreviewIndex + 1}</strong><span>双击缩略图打开 · 方向键切换 · Esc 关闭</span></div><button aria-label="关闭大图预览" onClick={() => setReferencePreviewIndex(null)}>×</button></header><div><img src={images[referencePreviewIndex]} alt={`参考图 ${referencePreviewIndex + 1} 大图`} /></div>{images.length > 1 && <footer><button onClick={() => setReferencePreviewIndex((referencePreviewIndex - 1 + images.length) % images.length)}>← 上一张</button><span>{referencePreviewIndex + 1} / {images.length}</span><button onClick={() => setReferencePreviewIndex((referencePreviewIndex + 1) % images.length)}>下一张 →</button></footer>}</aside></>}
    </main>
  );
}
