import type { Artist, Recipe } from "./workbench-types";
import type { NovelAIModelId, UcPresetId } from "./quality-profiles";

export type GenerationSettings = { width: number; height: number; steps: number; guidance: number; seed: number | null };

export type StyleExperimentDraft = {
  artists: Artist[];
  basePrompt: string;
  modelId: NovelAIModelId;
  autoQuality: boolean;
  ucPresetId: UcPresetId;
  positiveTags: string[];
  negativeTags: string[];
  settings: GenerationSettings;
};

export type StyleTrial = StyleExperimentDraft & {
  id: string;
  recipeId: string;
  name: string;
  note: string;
  imageIds: string[];
  createdAt: number;
};

export type StyleExperimentStore = { version: 1; sessions: Record<string, StyleTrial[]> };

const cloneArtists = (artists: Artist[]) => artists.map((artist) => ({ ...artist }));
const formatTag = (tag: { text: string; weight: number; enabled: boolean }) => !tag.enabled || !tag.text.trim() ? "" : tag.weight === 1 ? tag.text.trim() : `${Number(tag.weight.toFixed(2))}::${tag.text.trim()}::`;

export function createRecipeExperimentDraft(recipe: Recipe): StyleExperimentDraft {
  const quality = recipe.promptSections?.quality || [];
  const negative = recipe.promptSections?.negative || [];
  const positiveOrder = ["character", "features", "clothing", "action", "composition", "scene", "other"] as const;
  const basePrompt = [
    ...(recipe.promptSections ? positiveOrder.flatMap((section) => recipe.promptSections?.[section] || []).map(formatTag).filter(Boolean) : []),
    recipe.suffix?.trim(),
  ].filter(Boolean).join(", ");
  return {
    artists: cloneArtists(recipe.artists),
    basePrompt,
    modelId: recipe.styleDebug?.modelId || "nai-diffusion-4-5-full",
    autoQuality: recipe.styleDebug?.autoQuality ?? true,
    ucPresetId: recipe.styleDebug?.ucPresetId || "human",
    positiveTags: quality.filter((tag) => tag.enabled).map((tag) => tag.text.trim()).filter(Boolean),
    negativeTags: negative.filter((tag) => tag.enabled).map((tag) => tag.text.trim()).filter(Boolean),
    settings: recipe.styleDebug?.settings ? { ...recipe.styleDebug.settings } : { width: 832, height: 1216, steps: 28, guidance: 5, seed: null },
  };
}

export function createStyleTrial(recipeId: string, name: string, note: string, draft: StyleExperimentDraft, imageIds: string[], id = Math.random().toString(36).slice(2, 10)): StyleTrial {
  return {
    ...draft,
    id,
    recipeId,
    name: name.trim() || "未命名实验",
    note: note.trim(),
    imageIds: [...imageIds],
    artists: cloneArtists(draft.artists),
    positiveTags: [...draft.positiveTags],
    negativeTags: [...draft.negativeTags],
    settings: { ...draft.settings },
    createdAt: Date.now(),
  };
}

const artistSignature = (artists: Artist[]) => artists.filter((artist) => artist.enabled).map((artist) => `${artist.name.trim().toLowerCase()}:${artist.weight.toFixed(2)}`).join("|");
const tagSignature = (tags: string[]) => tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).join("|");

export function describeTrialDifferences(base: StyleExperimentDraft, trial: StyleExperimentDraft): string[] {
  const differences: string[] = [];
  if (artistSignature(base.artists) !== artistSignature(trial.artists)) differences.push("画师串");
  if (base.modelId !== trial.modelId) differences.push("模型");
  if (base.autoQuality !== trial.autoQuality || tagSignature(base.positiveTags) !== tagSignature(trial.positiveTags)) differences.push("正面质量词");
  if (base.ucPresetId !== trial.ucPresetId || tagSignature(base.negativeTags) !== tagSignature(trial.negativeTags)) differences.push("负面质量词");
  if (base.settings.width !== trial.settings.width || base.settings.height !== trial.settings.height) differences.push("尺寸");
  if (base.settings.steps !== trial.settings.steps) differences.push("Steps");
  if (base.settings.guidance !== trial.settings.guidance) differences.push("Guidance");
  if (base.settings.seed !== trial.settings.seed) differences.push("Seed");
  return differences;
}

export function normalizeStyleExperimentStore(value: unknown): StyleExperimentStore {
  const source = value && typeof value === "object" ? value as Partial<StyleExperimentStore> : {};
  const sessions: Record<string, StyleTrial[]> = {};
  if (source.sessions && typeof source.sessions === "object") {
    for (const [recipeId, entries] of Object.entries(source.sessions)) {
      if (!Array.isArray(entries)) continue;
      sessions[recipeId] = entries.filter((entry): entry is StyleTrial => !!entry && typeof entry === "object" && typeof (entry as StyleTrial).id === "string" && Array.isArray((entry as StyleTrial).artists)).slice(0, 200);
    }
  }
  return { version: 1, sessions };
}
