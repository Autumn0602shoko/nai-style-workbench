import assert from "node:assert/strict";
import test from "node:test";
import { addTagsToActivePromptBasket, countAllPromptBasketTags, createPromptBasketState, getActivePromptBasket, normalizePromptBasketState } from "../app/prompt-baskets.ts";

test("migrates the old single basket into the first mini basket", () => {
  const state = normalizePromptBasketState({ 角色: ["hina_(blue_archive)"], 角色特征: ["white_hair"] });
  assert.equal(state.version, 2);
  assert.equal(state.baskets.length, 1);
  assert.deepEqual(getActivePromptBasket(state).groups.角色, ["hina_(blue_archive)"]);
  assert.equal(countAllPromptBasketTags(state), 2);
});

test("adds tags only to the active mini basket", () => {
  const first = createPromptBasketState();
  const state = { ...first, baskets: [...first.baskets, { id: "basket-2", name: "衣着", groups: {} }], activeId: "basket-2" };
  const next = addTagsToActivePromptBasket(state, "人物衣着", ["black_dress"]);
  assert.deepEqual(next.baskets[0].groups, {});
  assert.deepEqual(next.baskets[1].groups.人物衣着, ["black_dress"]);
});
