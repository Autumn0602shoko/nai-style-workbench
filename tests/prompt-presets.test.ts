import assert from "node:assert/strict";
import test from "node:test";
import { countPromptPresetTags, createPromptPreset, normalizePromptPresetState } from "../app/prompt-presets.ts";

const emptySections = () => ({ character: [], features: [], clothing: [], action: [], composition: [], scene: [], quality: [], other: [], negative: [] });

test("creates a self-contained prompt preset snapshot", () => {
  const sections = emptySections();
  sections.character = ["1girl", "hina_(blue_archive)"].map((text, index) => ({ id: `tag-${index}`, text, weight: 1, enabled: true }));
  const preset = createPromptPreset("日常服", sections, ["character", "clothing"]);
  sections.character[0].text = "changed";
  assert.equal(preset.sections.character[0].text, "1girl");
  assert.equal(countPromptPresetTags(preset), 2);
  assert.deepEqual(preset.visibleSections, ["character", "clothing"]);
});

test("normalizes damaged preset data safely", () => {
  const state = normalizePromptPresetState({
    version: 1,
    presets: [{ id: "one", name: "  测试  ", sections: { clothing: [{ text: "black_dress", weight: 99 }] }, visibleSections: ["clothing", "unknown"] }],
  });
  assert.equal(state.presets[0].name, "测试");
  assert.equal(state.presets[0].sections.clothing[0].weight, 9);
  assert.deepEqual(state.presets[0].visibleSections, ["clothing"]);
});
