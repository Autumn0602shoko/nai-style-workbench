import type { PromptSectionId, PromptSections, PromptTag } from "./prompt-section-editor";

export type PromptPreset = {
  id: string;
  name: string;
  sections: PromptSections;
  visibleSections: PromptSectionId[];
  createdAt: number;
  updatedAt: number;
};

export type PromptPresetState = {
  version: 1;
  presets: PromptPreset[];
};

const sectionIds: PromptSectionId[] = ["character", "features", "clothing", "action", "composition", "scene", "quality", "other", "negative"];
const sectionIdSet = new Set<PromptSectionId>(sectionIds);
const makeId = () => Math.random().toString(36).slice(2, 10);

const cleanTag = (source: unknown): PromptTag | null => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const tag = source as Partial<PromptTag>;
  const text = typeof tag.text === "string" ? tag.text.trim() : "";
  if (!text) return null;
  const weight = Number(tag.weight);
  return {
    id: typeof tag.id === "string" && tag.id ? tag.id : makeId(),
    text: text.slice(0, 300),
    weight: Number.isFinite(weight) ? Math.max(-9, Math.min(9, weight)) : 1,
    enabled: tag.enabled !== false,
  };
};

export const clonePromptSections = (source: unknown): PromptSections => {
  const record = source && typeof source === "object" && !Array.isArray(source) ? source as Partial<PromptSections> : {};
  return Object.fromEntries(sectionIds.map((id) => [id, (Array.isArray(record[id]) ? record[id] : []).map(cleanTag).filter(Boolean)])) as PromptSections;
};

export const normalizePresetVisibleSections = (source: unknown): PromptSectionId[] => {
  if (!Array.isArray(source)) return ["character", "features", "clothing", "action"];
  const visible = [...new Set(source.filter((id): id is PromptSectionId => typeof id === "string" && sectionIdSet.has(id as PromptSectionId)))];
  return visible.length ? visible : ["character", "features", "clothing", "action"];
};

export const createPromptPreset = (name: string, sections: PromptSections, visibleSections: PromptSectionId[], id = `preset-${Date.now()}-${makeId()}`): PromptPreset => {
  const now = Date.now();
  return {
    id,
    name: name.trim().slice(0, 40) || "未命名方案",
    sections: clonePromptSections(sections),
    visibleSections: normalizePresetVisibleSections(visibleSections),
    createdAt: now,
    updatedAt: now,
  };
};

export const createPromptPresetState = (): PromptPresetState => ({ version: 1, presets: [] });

export function normalizePromptPresetState(source: unknown): PromptPresetState {
  if (!source || typeof source !== "object" || Array.isArray(source)) return createPromptPresetState();
  const record = source as Partial<PromptPresetState>;
  if (record.version !== 1 || !Array.isArray(record.presets)) return createPromptPresetState();
  const presets = record.presets.flatMap((sourcePreset, index) => {
    if (!sourcePreset || typeof sourcePreset !== "object" || Array.isArray(sourcePreset)) return [];
    const preset = sourcePreset as Partial<PromptPreset>;
    const createdAt = Number(preset.createdAt);
    const updatedAt = Number(preset.updatedAt);
    return [{
      id: typeof preset.id === "string" && preset.id ? preset.id : `preset-${index + 1}`,
      name: typeof preset.name === "string" && preset.name.trim() ? preset.name.trim().slice(0, 40) : `提示词方案 ${index + 1}`,
      sections: clonePromptSections(preset.sections),
      visibleSections: normalizePresetVisibleSections(preset.visibleSections),
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : Date.now(),
    }];
  });
  return { version: 1, presets: presets.slice(0, 100) };
}

export const countPromptPresetTags = (preset: PromptPreset) => Object.values(preset.sections).reduce((total, tags) => total + tags.length, 0);
