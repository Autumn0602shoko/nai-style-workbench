import assert from "node:assert/strict";
import test from "node:test";
import { parseArtistTags } from "../app/artist-parser.ts";

test("parses numeric, plain, and escaped artist tags", () => {
  assert.deepEqual(
    parseArtistTags("1.25::artist:satou kuuki::, artist:jackdempa, artist:last\\, first"),
    [
      { name: "satou kuuki", weight: 1.25 },
      { name: "jackdempa", weight: 1 },
      { name: "last, first", weight: 1 },
    ],
  );
});

test("converts balanced NovelAI emphasis brackets into weights", () => {
  assert.deepEqual(parseArtistTags("{{artist:strong}}, [[artist:soft]]"), [
    { name: "strong", weight: 1.1025 },
    { name: "soft", weight: 0.907 },
  ]);
});

test("finds tags in copied JSON and removes duplicates case-insensitively", () => {
  const json = JSON.stringify({ prompt: "artist:Honashi, 0.8::artist:dk.senie::, artist:honashi" });
  assert.deepEqual(parseArtistTags(json), [
    { name: "Honashi", weight: 1 },
    { name: "dk.senie", weight: 0.8 },
  ]);
});

