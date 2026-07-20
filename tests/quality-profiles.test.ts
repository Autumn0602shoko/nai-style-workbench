import assert from "node:assert/strict";
import test from "node:test";
import { analyzeQualityTags, composeQualityTags, getQualityProfile } from "../app/quality-profiles.ts";

test("uses model-specific automatic quality and UC presets", () => {
  const full = composeQualityTags("nai-diffusion-4-5-full", true, "light", [], []);
  const curated = composeQualityTags("nai-diffusion-4-5-curated", true, "light", [], []);
  assert.ok(full.positive.includes("very aesthetic"));
  assert.ok(!curated.positive.includes("very aesthetic"));
  assert.ok(curated.positive.includes("rating:general"));
  assert.ok(full.negative.includes("worst quality"));
  assert.equal(getQualityProfile("nai-diffusion-4-5-full").label, "NAI Diffusion V4.5 Full");
});

test("finds duplicated automatic tags and positive-negative conflicts", () => {
  const issues = analyzeQualityTags("nai-diffusion-4-5-full", true, "light", ["masterpiece", "blur"], ["blur", "lowres"]);
  assert.ok(issues.some((issue) => issue.id === "automatic-duplicate"));
  assert.ok(issues.some((issue) => issue.id === "positive-negative-conflict"));
  assert.ok(issues.some((issue) => issue.id === "preset-duplicate"));
});

test("deduplicates effective quality tags without dropping weighted tags", () => {
  const result = composeQualityTags("nai-diffusion-4-5-curated", true, "none", ["feet", "masterpiece"], []);
  assert.equal(result.positive.filter((tag) => tag.includes("feet")).length, 1);
  assert.equal(result.positive.filter((tag) => tag === "masterpiece").length, 1);
});
