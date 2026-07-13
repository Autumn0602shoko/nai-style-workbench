import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateDanbooruTag } from "../app/tag-translation.ts";

test("translates common Danbooru phrases locally", () => {
  assert.equal(translateDanbooruTag("hina_(blue_archive)"), "空崎日奈（蔚蓝档案）");
  assert.equal(translateDanbooruTag("very_long_hair"), "超长发");
  assert.equal(translateDanbooruTag("looking_at_viewer"), "看向观众");
});

test("composes colors and common features", () => {
  assert.equal(translateDanbooruTag("purple_eyes"), "紫色眼睛");
  assert.equal(translateDanbooruTag("black_horns"), "黑色角");
  assert.equal(translateDanbooruTag("white_dress"), "白色连衣裙");
  assert.equal(translateDanbooruTag("unknown_rare_tag"), null);
});

test("prefers user dictionary translations", () => {
  assert.equal(translateDanbooruTag("halo", { halo: "光环" }), "光环");
  assert.equal(translateDanbooruTag("white_hair", { "white hair": "银白发" }), "银白发");
});

test("covers common face and hair tags from imported prompts", () => {
  assert.equal(translateDanbooruTag("demon_girl"), "恶魔女孩");
  assert.equal(translateDanbooruTag("sidelocks"), "鬓发");
  assert.equal(translateDanbooruTag("hairclip"), "发夹");
  assert.equal(translateDanbooruTag("halo"), "光环");
  assert.equal(translateDanbooruTag("forehead"), "额头");
});

test("ships a versioned public translation dictionary", async () => {
  const payload = JSON.parse(await readFile(new URL("../public/tag-translations.zh-CN.json", import.meta.url), "utf8"));
  assert.match(payload.version, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
  assert.equal(payload.entries.halo, "光环");
  assert.ok(Object.keys(payload.entries).length > 80);
});
