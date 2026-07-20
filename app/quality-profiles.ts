export type NovelAIModelId = "nai-diffusion-4-5-full" | "nai-diffusion-4-5-curated" | "nai-diffusion-4-full" | "nai-diffusion-4-curated";
export type UcPresetId = "none" | "light" | "heavy" | "human" | "furry";

export type QualityProfile = {
  id: NovelAIModelId;
  label: string;
  automaticQuality: string[];
  ucPresets: Partial<Record<UcPresetId, string[]>>;
};

export type QualityAnalysisIssue = {
  id: string;
  severity: "warning" | "info";
  title: string;
  description: string;
  tags: string[];
};

export const qualityProfiles: QualityProfile[] = [
  {
    id: "nai-diffusion-4-5-full",
    label: "NAI Diffusion V4.5 Full",
    automaticQuality: ["location", "very aesthetic", "masterpiece", "no text"],
    ucPresets: {
      none: [],
      light: ["lowres", "artistic error", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "multiple views", "very displeasing", "too many watermarks", "negative space", "blank page"],
      heavy: ["lowres", "artistic error", "film grain", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "dithering", "halftone", "screentone", "multiple views", "logo", "too many watermarks", "negative space", "blank page"],
      human: ["lowres", "artistic error", "film grain", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "dithering", "halftone", "screentone", "multiple views", "logo", "too many watermarks", "negative space", "blank page", "@_@", "mismatched pupils", "glowing eyes", "bad anatomy"],
      furry: ["{worst quality}", "distracting watermark", "unfinished", "bad quality", "{widescreen}", "upscale", "{sequence}", "{{grandfathered content}}", "blurred foreground", "chromatic aberration", "sketch", "everyone", "[sketch background]", "simple", "[flat colors]", "ych (character)", "outline", "multiple scenes", "[[horror (theme)]]", "comic"],
    },
  },
  {
    id: "nai-diffusion-4-5-curated",
    label: "NAI Diffusion V4.5 Curated",
    automaticQuality: ["location", "masterpiece", "no text", "-0.8::feet::", "rating:general"],
    ucPresets: {
      none: [],
      light: ["blurry", "lowres", "upscaled", "artistic error", "scan artifacts", "jpeg artifacts", "logo", "too many watermarks", "negative space", "blank page"],
      heavy: ["blurry", "lowres", "upscaled", "artistic error", "film grain", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "halftone", "multiple views", "logo", "too many watermarks", "negative space", "blank page"],
      human: ["blurry", "lowres", "upscaled", "artistic error", "film grain", "scan artifacts", "bad anatomy", "bad hands", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "halftone", "multiple views", "logo", "too many watermarks", "@_@", "mismatched pupils", "glowing eyes", "negative space", "blank page"],
    },
  },
  {
    id: "nai-diffusion-4-full",
    label: "NAI Diffusion V4 Full",
    automaticQuality: ["no text", "best quality", "very aesthetic", "absurdres"],
    ucPresets: {
      none: [],
      light: ["blurry", "lowres", "error", "worst quality", "bad quality", "jpeg artifacts", "very displeasing"],
      heavy: ["blurry", "lowres", "error", "film grain", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "multiple views", "logo", "too many watermarks"],
    },
  },
  {
    id: "nai-diffusion-4-curated",
    label: "NAI Diffusion V4 Curated",
    automaticQuality: ["rating:general", "amazing quality", "very aesthetic", "absurdres"],
    ucPresets: {
      none: [],
      light: ["blurry", "lowres", "error", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "logo", "dated", "signature"],
      heavy: ["blurry", "lowres", "error", "film grain", "scan artifacts", "worst quality", "bad quality", "jpeg artifacts", "very displeasing", "chromatic aberration", "logo", "dated", "signature", "multiple views", "gigantic breasts"],
    },
  },
];

export const defaultNovelAIModel: NovelAIModelId = "nai-diffusion-4-5-full";

export const getQualityProfile = (modelId: NovelAIModelId) => qualityProfiles.find((profile) => profile.id === modelId) || qualityProfiles[0];

export const normalizeQualityTag = (value: string) => value.trim().toLowerCase()
  .replace(/^[{}\[\]]+|[{}\[\]]+$/g, "")
  .replace(/^-?\d+(?:\.\d+)?::(.+)::$/, "$1")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ");

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = normalizeQualityTag(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function composeQualityTags(modelId: NovelAIModelId, autoQuality: boolean, ucPresetId: UcPresetId, positiveTags: string[], negativeTags: string[]) {
  const profile = getQualityProfile(modelId);
  return {
    positive: uniqueTags([...(autoQuality ? profile.automaticQuality : []), ...positiveTags]),
    negative: uniqueTags([...(profile.ucPresets[ucPresetId] || []), ...negativeTags]),
  };
}

export function analyzeQualityTags(modelId: NovelAIModelId, autoQuality: boolean, ucPresetId: UcPresetId, positiveTags: string[], negativeTags: string[]): QualityAnalysisIssue[] {
  const profile = getQualityProfile(modelId);
  const issues: QualityAnalysisIssue[] = [];
  const automatic = new Set((autoQuality ? profile.automaticQuality : []).map(normalizeQualityTag));
  const presetNegative = new Set((profile.ucPresets[ucPresetId] || []).map(normalizeQualityTag));
  const positiveKeys = positiveTags.map(normalizeQualityTag);
  const negativeKeys = negativeTags.map(normalizeQualityTag);
  const duplicates = (keys: string[]) => [...new Set(keys.filter((key, index) => key && keys.indexOf(key) !== index))];
  const duplicatePositive = duplicates(positiveKeys);
  const duplicateNegative = duplicates(negativeKeys);
  const repeatedAutomatic = [...new Set(positiveKeys.filter((key) => automatic.has(key)))];
  const repeatedPreset = [...new Set(negativeKeys.filter((key) => presetNegative.has(key)))];
  const opposite = [...new Set(positiveKeys.filter((key) => negativeKeys.includes(key)))];

  if (opposite.length) issues.push({ id: "positive-negative-conflict", severity: "warning", title: "正负面存在相同标签", description: "同一概念同时要求出现和避免，会削弱画面控制。", tags: opposite });
  if (repeatedAutomatic.length) issues.push({ id: "automatic-duplicate", severity: "info", title: "手动质量词与官方自动词重复", description: "自动质量词开启时，这些手动标签可以暂时移除。", tags: repeatedAutomatic });
  if (repeatedPreset.length) issues.push({ id: "preset-duplicate", severity: "info", title: "自定义负面词与预设重复", description: "当前 UC 预设已经包含这些标签。", tags: repeatedPreset });
  if (duplicatePositive.length) issues.push({ id: "positive-duplicate", severity: "info", title: "正面质量词重复", description: "完全相同的质量标签只需保留一次。", tags: duplicatePositive });
  if (duplicateNegative.length) issues.push({ id: "negative-duplicate", severity: "info", title: "负面质量词重复", description: "完全相同的负面标签只需保留一次。", tags: duplicateNegative });
  if (!autoQuality && !positiveTags.length) issues.push({ id: "no-positive-quality", severity: "info", title: "当前没有正面质量词", description: "这不一定是问题；调试特殊画风时可以故意保持为空。", tags: [] });
  return issues;
}
