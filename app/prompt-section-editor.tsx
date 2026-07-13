"use client";

import { Dispatch, SetStateAction, useMemo, useState } from "react";

export type PromptSectionId = "character" | "clothing" | "action" | "composition" | "scene" | "quality" | "other" | "negative";
export type PromptTag = { id: string; text: string; weight: number; enabled: boolean };
export type PromptSections = Record<PromptSectionId, PromptTag[]>;

export const promptSectionDefinitions: { id: PromptSectionId; label: string; hint: string; optional?: boolean }[] = [
  { id: "character", label: "角色与外貌", hint: "人物数量、角色名、发色、眼睛、表情等" },
  { id: "clothing", label: "人物衣着", hint: "服装、配饰、鞋袜等" },
  { id: "action", label: "动作与姿态", hint: "动作、姿势、视线和角色互动" },
  { id: "composition", label: "构图与视角", hint: "镜头、景别、角度和画面焦点", optional: true },
  { id: "scene", label: "场景与背景", hint: "地点、时间、天气和背景元素", optional: true },
  { id: "quality", label: "质量与年代", hint: "按需要手动添加，不自动填充", optional: true },
  { id: "other", label: "其他提示词", hint: "无法归入以上分类的必要标签", optional: true },
  { id: "negative", label: "Undesired Content", hint: "希望模型避免出现的内容", optional: true },
];

export const basicPromptSections: PromptSectionId[] = ["character", "clothing", "action"];
const positiveOrder: PromptSectionId[] = ["character", "clothing", "action", "composition", "scene", "quality", "other"];
const makeId = () => Math.random().toString(36).slice(2, 10);

export const createEmptyPromptSections = (): PromptSections => ({ character: [], clothing: [], action: [], composition: [], scene: [], quality: [], other: [], negative: [] });
export const createPromptTags = (tags: string[]): PromptTag[] => [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].map((text) => ({ id: makeId(), text, weight: 1, enabled: true }));

const formatTag = (tag: PromptTag) => tag.weight === 1 ? tag.text.trim() : `${Number(tag.weight.toFixed(2))}::${tag.text.trim()}::`;
export const formatPromptSections = (sections: PromptSections) => positiveOrder.flatMap((id) => sections[id]).filter((tag) => tag.enabled && tag.text.trim()).map(formatTag).join(", ");
export const formatNegativePrompt = (sections: PromptSections) => sections.negative.filter((tag) => tag.enabled && tag.text.trim()).map(formatTag).join(", ");

type Props = {
  sections: PromptSections;
  setSections: Dispatch<SetStateAction<PromptSections>>;
  visibleSections: PromptSectionId[];
  setVisibleSections: Dispatch<SetStateAction<PromptSectionId[]>>;
};

export function PromptSectionEditor({ sections, setSections, visibleSections, setVisibleSections }: Props) {
  const [inputs, setInputs] = useState<Partial<Record<PromptSectionId, string>>>({});
  const [addSection, setAddSection] = useState<PromptSectionId>("composition");
  const counts = useMemo(() => Object.values(sections).flat().reduce<Record<string, number>>((result, tag) => {
    const key = tag.text.trim().toLowerCase();
    if (key) result[key] = (result[key] || 0) + 1;
    return result;
  }, {}), [sections]);

  const updateSection = (id: PromptSectionId, updater: (tags: PromptTag[]) => PromptTag[]) => setSections((current) => ({ ...current, [id]: updater(current[id]) }));
  const addInputTags = (id: PromptSectionId) => {
    const values = (inputs[id] || "").split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean);
    if (!values.length) return;
    updateSection(id, (current) => {
      const existing = new Set(current.map((tag) => tag.text.toLowerCase()));
      return [...current, ...createPromptTags(values.filter((tag) => !existing.has(tag.toLowerCase())))];
    });
    setInputs((current) => ({ ...current, [id]: "" }));
  };
  const moveTag = (id: PromptSectionId, index: number, direction: -1 | 1) => updateSection(id, (current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const available = promptSectionDefinitions.filter((section) => section.optional && !visibleSections.includes(section.id));

  return <section className="panel prompt-editor-panel">
    <div className="panel-heading"><div><span className="step">P</span><h2>NovelAI 分区提示词</h2></div><span className="counter">{Object.values(sections).flat().filter((tag) => tag.enabled).length} 个启用标签</span></div>
    <div className="prompt-editor-note">保持必要标签在前，构图、场景和质量词只在需要时添加。输入逗号分隔的标签后按 Enter。</div>
    <div className="prompt-section-list">{visibleSections.map((id) => {
      const definition = promptSectionDefinitions.find((section) => section.id === id)!;
      return <article className="prompt-section-card" key={id}>
        <header><div><h3>{definition.label}</h3><p>{definition.hint}</p></div>{definition.optional && <button onClick={() => setVisibleSections((current) => current.filter((item) => item !== id))}>收起</button>}</header>
        <div className="prompt-tag-input"><input value={inputs[id] || ""} onChange={(event) => setInputs((current) => ({ ...current, [id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addInputTags(id); } }} placeholder={`添加${definition.label}标签…`} /><button onClick={() => addInputTags(id)}>添加</button></div>
        {!sections[id].length ? <div className="prompt-section-empty">暂时留空，不会向最终 Prompt 添加任何内容。</div> : <div className="editable-tag-list">{sections[id].map((tag, index) => <div className={`${tag.enabled ? "" : "disabled"} ${counts[tag.text.trim().toLowerCase()] > 1 ? "duplicate" : ""}`} key={tag.id}>
          <button className="prompt-tag-toggle" onClick={() => updateSection(id, (current) => current.map((item) => item.id === tag.id ? { ...item, enabled: !item.enabled } : item))}>{tag.enabled ? "✓" : "–"}</button>
          <input value={tag.text} onChange={(event) => updateSection(id, (current) => current.map((item) => item.id === tag.id ? { ...item, text: event.target.value } : item))} />
          <label>权重<input type="number" min="-9" max="9" step="0.05" value={tag.weight} onChange={(event) => updateSection(id, (current) => current.map((item) => item.id === tag.id ? { ...item, weight: Number(event.target.value) || 0 } : item))} /></label>
          <button disabled={index === 0} onClick={() => moveTag(id, index, -1)}>↑</button><button disabled={index === sections[id].length - 1} onClick={() => moveTag(id, index, 1)}>↓</button>
          <button className="prompt-tag-remove" onClick={() => updateSection(id, (current) => current.filter((item) => item.id !== tag.id))}>×</button>
          {counts[tag.text.trim().toLowerCase()] > 1 && <small>重复</small>}
        </div>)}</div>}
      </article>;
    })}</div>
    {!!available.length && <div className="add-prompt-section"><select value={available.some((section) => section.id === addSection) ? addSection : available[0].id} onChange={(event) => setAddSection(event.target.value as PromptSectionId)}>{available.map((section) => <option value={section.id} key={section.id}>{section.label}</option>)}</select><button onClick={() => { const id = available.some((section) => section.id === addSection) ? addSection : available[0].id; setVisibleSections((current) => [...current, id]); }}>＋ 添加分类</button></div>}
  </section>;
}
