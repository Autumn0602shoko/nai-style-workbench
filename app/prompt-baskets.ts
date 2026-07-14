export type PromptBasketGroups = Record<string, string[]>;

export type PromptMiniBasket = {
  id: string;
  name: string;
  groups: PromptBasketGroups;
};

export type PromptBasketState = {
  version: 2;
  activeId: string;
  baskets: PromptMiniBasket[];
};

const cleanGroups = (source: unknown): PromptBasketGroups => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const groups: PromptBasketGroups = {};
  for (const [label, value] of Object.entries(source)) {
    if (!Array.isArray(value)) continue;
    const tags = [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))];
    if (label.trim() && tags.length) groups[label.trim()] = tags;
  }
  return groups;
};

export const createPromptBasketState = (groups: PromptBasketGroups = {}): PromptBasketState => ({
  version: 2,
  activeId: "basket-1",
  baskets: [{ id: "basket-1", name: "小篮子 1", groups: cleanGroups(groups) }],
});

export function normalizePromptBasketState(source: unknown): PromptBasketState {
  if (!source || typeof source !== "object" || Array.isArray(source)) return createPromptBasketState();
  const record = source as Partial<PromptBasketState> & PromptBasketGroups;
  if (record.version !== 2 || !Array.isArray(record.baskets)) return createPromptBasketState(cleanGroups(source));
  const baskets = record.baskets.map((basket, index) => ({
    id: typeof basket?.id === "string" && basket.id ? basket.id : `basket-${index + 1}`,
    name: typeof basket?.name === "string" && basket.name.trim() ? basket.name.trim().slice(0, 30) : `小篮子 ${index + 1}`,
    groups: cleanGroups(basket?.groups),
  }));
  if (!baskets.length) return createPromptBasketState();
  const activeId = baskets.some((basket) => basket.id === record.activeId) ? String(record.activeId) : baskets[0].id;
  return { version: 2, activeId, baskets };
}

export const getActivePromptBasket = (state: PromptBasketState) => state.baskets.find((basket) => basket.id === state.activeId) || state.baskets[0];
export const countPromptBasketTags = (basket: PromptMiniBasket | undefined) => basket ? Object.values(basket.groups).reduce((total, tags) => total + tags.length, 0) : 0;
export const countAllPromptBasketTags = (state: PromptBasketState) => state.baskets.reduce((total, basket) => total + countPromptBasketTags(basket), 0);

export function updateActivePromptBasketGroups(state: PromptBasketState, updater: (groups: PromptBasketGroups) => PromptBasketGroups): PromptBasketState {
  const active = getActivePromptBasket(state);
  return { ...state, baskets: state.baskets.map((basket) => basket.id === active.id ? { ...basket, groups: cleanGroups(updater(basket.groups)) } : basket) };
}

export function addTagsToActivePromptBasket(state: PromptBasketState, label: string, tags: string[]): PromptBasketState {
  return updateActivePromptBasketGroups(state, (groups) => ({ ...groups, [label]: [...new Set([...(groups[label] || []), ...tags])] }));
}
