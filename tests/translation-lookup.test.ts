import assert from "node:assert/strict";
import test from "node:test";
import { extractTranslationCandidates, prepareTranslationQuery } from "../app/translation-lookup.ts";

test("prepares Danbooru tags for translation lookup", () => {
  assert.equal(prepareTranslationQuery("black_thighhighs"), "black thighhighs");
});

test("keeps unique Chinese translation candidates", () => {
  const candidates = extractTranslationCandidates({
    responseData: { translatedText: "长筒袜" },
    matches: [{ translation: "絲襪" }, { translation: "长筒袜" }, { translation: "stocking" }],
  });
  assert.deepEqual(candidates, ["长筒袜", "丝袜"]);
});
