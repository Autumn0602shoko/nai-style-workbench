import assert from "node:assert/strict";
import test from "node:test";
import { classifyPromptTag, importPromptTags, movePromptTagToSection, normalizePromptSections, normalizeVisiblePromptSections } from "../app/prompt-import.ts";

test("imports NovelAI prompt weights and ignores artist tags", () => {
  const tags = importPromptTags("1girl, 1.2::pink_hair::, {{smile}}, [looking_at_viewer], 1.1::artist:honashi::");
  assert.deepEqual(tags.map(({ text, weight }) => ({ text, weight })), [
    { text: "1girl", weight: 1 },
    { text: "pink_hair", weight: 1.2 },
    { text: "smile", weight: 1.1025 },
    { text: "looking_at_viewer", weight: 0.9524 },
  ]);
});

test("classifies common prompt groups", () => {
  assert.equal(classifyPromptTag("black_thighhighs"), "clothing");
  assert.equal(classifyPromptTag("dark-skinned_male"), "features");
  assert.equal(classifyPromptTag("hina_(blue_archive)"), "character");
  assert.equal(classifyPromptTag("holding_sword"), "action");
  assert.equal(classifyPromptTag("from_above"), "composition");
  assert.equal(classifyPromptTag("city_background"), "scene");
  assert.equal(classifyPromptTag("year_2025"), "quality");
});

test("moves a tag between prompt sections without losing its settings", () => {
  const tag = { id: "tag-1", text: "black_dress", weight: 1.25, enabled: false };
  const sections = {
    character: [tag], features: [], clothing: [], action: [], composition: [], scene: [], quality: [], other: [], negative: [],
  };
  const moved = movePromptTagToSection(sections, "character", "clothing", tag.id);
  assert.deepEqual(moved.character, []);
  assert.deepEqual(moved.clothing, [tag]);
});

test("migrates the old combined character section", () => {
  const identity = { id: "identity", text: "hina_(blue_archive)", weight: 1, enabled: true };
  const feature = { id: "feature", text: "white_hair", weight: 1, enabled: true };
  const sections = normalizePromptSections({ character: [identity, feature], clothing: [], action: [] });
  assert.deepEqual(sections.character, [identity]);
  assert.deepEqual(sections.features, [feature]);
  assert.deepEqual(normalizeVisiblePromptSections(["character", "clothing", "scene"]), ["character", "features", "clothing", "action", "scene"]);
});
