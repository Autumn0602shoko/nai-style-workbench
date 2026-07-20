import assert from "node:assert/strict";
import test from "node:test";
import { createRecipeExperimentDraft, createStyleTrial, describeTrialDifferences, normalizeStyleExperimentStore } from "../app/style-experiments.ts";

const recipe = {
  id: "recipe-1",
  name: "测试画师串",
  artists: [{ id: "a", name: "honashi", weight: 1, enabled: true }],
  suffix: "year 2025",
  promptSections: {
    character: [{ id: "c", text: "1girl", weight: 1, enabled: true }],
    features: [], clothing: [], action: [], composition: [], scene: [], other: [],
    quality: [{ id: "q", text: "masterpiece", weight: 1, enabled: true }],
    negative: [{ id: "n", text: "lowres", weight: 1, enabled: true }],
  },
  visiblePromptSections: ["character"],
  images: [],
  createdAt: 1,
} as const;

test("creates a reproducible debug baseline from a saved recipe", () => {
  const draft = createRecipeExperimentDraft(recipe);
  assert.equal(draft.artists[0].name, "honashi");
  assert.deepEqual(draft.positiveTags, ["masterpiece"]);
  assert.deepEqual(draft.negativeTags, ["lowres"]);
  assert.match(draft.basePrompt, /1girl/);
  assert.match(draft.basePrompt, /year 2025/);
});

test("describes changes against the saved baseline", () => {
  const base = createRecipeExperimentDraft(recipe);
  const changed = { ...base, artists: [{ ...base.artists[0], weight: 1.2 }], settings: { ...base.settings, seed: 1234 } };
  assert.deepEqual(describeTrialDifferences(base, changed), ["画师串", "Seed"]);
  const trial = createStyleTrial(recipe.id, "权重测试", "更锐利", changed, ["image-1"], "trial-1");
  assert.equal(trial.name, "权重测试");
  assert.deepEqual(trial.imageIds, ["image-1"]);
});

test("normalizes damaged experiment storage", () => {
  const normalized = normalizeStyleExperimentStore({ sessions: { "recipe-1": [{ id: "trial", artists: [] }, null], broken: "no" } });
  assert.equal(normalized.sessions["recipe-1"].length, 1);
  assert.equal(normalized.sessions.broken, undefined);
});
