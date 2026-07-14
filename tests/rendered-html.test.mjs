import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the artist workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>画师串工作台<\/title>/i);
  assert.match(html, /NOVELAI STYLE WORKBENCH/);
  assert.match(html, /粘贴与解析/);
  assert.match(html, /调整画师与权重/);
  assert.match(html, /已保存的画师串/);
});

test("includes local library and prompt editing capabilities", async () => {
  const [page, layout, promptEditor] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/prompt-section-editor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /nai-style-recipes/);
  assert.match(page, /exportRecipes/);
  assert.match(page, /importRecipes/);
  assert.match(page, /dropImages/);
  assert.match(page, /moveArtist/);
  assert.match(page, /importFullPrompt/);
  assert.match(page, /智能分类并加入/);
  assert.match(promptEditor, /changeTagSection/);
  assert.match(promptEditor, /prompt-tag-suggestions/);
  assert.match(promptEditor, /prompt-tag-cloud/);
  assert.match(promptEditor, /中英对照/);
  assert.match(promptEditor, /prompt-chip-delete/);
  assert.match(promptEditor, /deleteSelectedTags/);
  assert.match(promptEditor, /nai-tag-translations/);
  assert.match(promptEditor, /translation-missing/);
  assert.match(page, /suggestDanbooruTags/);
  assert.match(page, /loadOnlineTagDictionary/);
  assert.match(promptEditor, /nai-online-tag-translations/);
  assert.match(promptEditor, /联网更新/);
  assert.match(promptEditor, /translation-float/);
  assert.match(promptEditor, /lookupTranslation/);
  assert.match(page, /lookupTagTranslation/);
  assert.match(page, /nai-workbench-draft/);
  assert.match(page, /basket-drawer/);
  assert.match(page, /暂存已选/);
  assert.match(page, /发送到编辑器并清空/);
  assert.match(promptEditor, /prompt-undo-toast/);
  assert.match(layout, /title:\s*"画师串工作台"/);
});
