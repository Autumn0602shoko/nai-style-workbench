import type { PromptSectionId, PromptSections } from "./prompt-section-editor";
import type { NovelAIModelId, UcPresetId } from "./quality-profiles";

export type Artist = { id: string; name: string; weight: number; enabled: boolean; locked?: boolean };

export type Recipe = {
  id: string;
  name: string;
  artists: Artist[];
  suffix: string;
  promptSections?: PromptSections;
  visiblePromptSections?: PromptSectionId[];
  images: string[];
  createdAt: number;
  styleDebug?: { modelId: NovelAIModelId; autoQuality: boolean; ucPresetId: UcPresetId; settings: { width: number; height: number; steps: number; guidance: number; seed: number | null } };
};
