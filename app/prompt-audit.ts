import { classifyPromptTag } from "./prompt-import.ts";
import type { PromptSectionId, PromptSections, PromptTag } from "./prompt-section-editor";

export type PromptAuditSeverity = "conflict" | "warning" | "info";
export type PromptAuditTagRef = { section: PromptSectionId; id: string; text: string };
export type PromptAuditIssue = {
  id: string;
  severity: PromptAuditSeverity;
  title: string;
  description: string;
  tags: PromptAuditTagRef[];
  suggestedRemovalIds?: string[];
};

type IndexedTag = PromptAuditTagRef & { normalized: string; weight: number };

const positiveSections: PromptSectionId[] = ["character", "features", "clothing", "action", "composition", "scene", "quality", "other"];
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");
const issueId = (kind: string, tags: PromptAuditTagRef[] = []) => `${kind}:${tags.map((tag) => `${tag.section}/${tag.id}`).sort().join("|")}`;

const conflictRules: { id: string; title: string; description: string; left: RegExp; right: RegExp }[] = [
  { id: "hair-length", title: "发长互相冲突", description: "短发和长发通常不应同时描述同一个主体。", left: /^(?:short_hair|bald)$/, right: /^(?:long_hair|very_long_hair)$/ },
  { id: "mouth-state", title: "嘴部状态冲突", description: "张嘴和闭嘴无法在同一时刻同时成立。", left: /^open_mouth$/, right: /^closed_mouth$/ },
  { id: "location", title: "场景位置冲突", description: "室内和室外会向模型传递相反的场景要求。", left: /^indoors$/, right: /^outdoors$/ },
  { id: "time", title: "时间状态冲突", description: "白天和夜晚同时出现时，画面时间可能变得不稳定。", left: /^(?:day|daytime)$/, right: /^(?:night|nighttime)$/ },
  { id: "pose", title: "主体姿态冲突", description: "站立与躺卧通常不能同时作为主体的主要姿态。", left: /^standing$/, right: /^(?:lying|lying_down)$/ },
  { id: "rating", title: "分级状态冲突", description: "censored 与 uncensored 表达了相反的画面状态。", left: /^censored$/, right: /^uncensored$/ },
  { id: "human-state", title: "主体类型冲突", description: "人物数量标签与 no_humans 不能同时成立。", left: /^(?:\d+(?:girl|boy|girls|boys)|solo|multiple_girls|multiple_boys)$/, right: /^no_humans$/ },
];

const colorOrMaterial = /^(?:black|blue|brown|green|grey|gray|orange|pink|purple|red|white|yellow|gold|silver|transparent|striped|plaid|denim|leather)_(.+)$/;
const redundantBaseWords = new Set(["dress", "shirt", "skirt", "pants", "shorts", "jacket", "coat", "gloves", "boots", "shoes", "socks", "thighhighs", "pantyhose", "swimsuit", "bikini", "hair", "eyes"]);

const indexTags = (sections: PromptSections): IndexedTag[] => positiveSections.flatMap((section) => sections[section]
  .filter((tag) => tag.enabled && tag.text.trim())
  .map((tag) => ({ section, id: tag.id, text: tag.text.trim(), normalized: normalize(tag.text), weight: tag.weight })));

const refs = (tags: IndexedTag[]): PromptAuditTagRef[] => tags.map(({ section, id, text }) => ({ section, id, text }));

export function auditPromptSections(sections: PromptSections): PromptAuditIssue[] {
  const tags = indexTags(sections);
  const issues: PromptAuditIssue[] = [];
  const byText = new Map<string, IndexedTag[]>();
  for (const tag of tags) byText.set(tag.normalized, [...(byText.get(tag.normalized) || []), tag]);

  for (const [text, matches] of byText) {
    if (matches.length < 2) continue;
    const tagRefs = refs(matches);
    const weightConflict = new Set(matches.map((tag) => Number(tag.weight.toFixed(3)))).size > 1;
    issues.push({
      id: issueId(weightConflict ? `weight-${text}` : `duplicate-${text}`, tagRefs),
      severity: weightConflict ? "warning" : "info",
      title: weightConflict ? "同一标签使用了不同权重" : "标签重复出现",
      description: weightConflict ? "保留一个权重更明确，避免后出现的写法覆盖前面的意图。" : "完全相同的标签只需保留一次。",
      tags: tagRefs,
      suggestedRemovalIds: matches.slice(1).map((tag) => tag.id),
    });
  }

  for (const rule of conflictRules) {
    const left = tags.filter((tag) => rule.left.test(tag.normalized));
    const right = tags.filter((tag) => rule.right.test(tag.normalized));
    if (!left.length || !right.length) continue;
    const pair = [left[0], right[0]];
    issues.push({ id: issueId(rule.id, refs(pair)), severity: "conflict", title: rule.title, description: rule.description, tags: refs(pair) });
  }

  const solo = tags.find((tag) => tag.normalized === "solo");
  const plural = tags.find((tag) => /^(?:[2-9]\d*(?:girls|boys)|multiple_girls|multiple_boys)$/.test(tag.normalized));
  if (solo && plural) {
    const pair = [solo, plural];
    issues.push({ id: issueId("solo-count", refs(pair)), severity: "conflict", title: "人数与 solo 冲突", description: "solo 表示单个主体，不能与多人数量标签同时成立。", tags: refs(pair) });
  }

  for (const specific of tags) {
    const match = specific.normalized.match(colorOrMaterial);
    if (!match || !redundantBaseWords.has(match[1])) continue;
    const generic = byText.get(match[1])?.[0];
    if (!generic || generic.id === specific.id) continue;
    const pair = [specific, generic];
    issues.push({
      id: issueId(`redundant-${specific.normalized}`, refs(pair)),
      severity: "info",
      title: "通用词可能可以精简",
      description: `${specific.text} 已包含更具体的信息，通常不必再单独添加 ${generic.text}。`,
      tags: refs(pair),
      suggestedRemovalIds: [generic.id],
    });
  }

  const subjectPattern = /^(?:\d+(?:girl|boy|girls|boys)|solo|multiple_girls|multiple_boys|no_humans)$/;
  const hasSubject = tags.some((tag) => subjectPattern.test(tag.normalized) || (tag.section === "character" && /\(.+\)/.test(tag.normalized)));
  if (!hasSubject && tags.length) issues.unshift({
    id: "missing-subject",
    severity: "warning",
    title: "缺少基础主体",
    description: "建议先明确 1girl、1boy、no_humans 或具体角色，再补充外观与动作。",
    tags: [],
  });

  for (const tag of tags.filter((item) => item.section === "other")) {
    const classified = classifyPromptTag(tag.normalized);
    if (classified === "other" || classified === "negative") continue;
    issues.push({
      id: issueId(`misclassified-${classified}`, refs([tag])),
      severity: "info",
      title: "标签可能放错分类",
      description: `${tag.text} 更适合放入“${sectionLabels[classified]}”。`,
      tags: refs([tag]),
    });
  }

  for (const section of positiveSections) {
    const sectionTags = tags.filter((tag) => tag.section === section);
    if (sectionTags.length <= 18) continue;
    issues.push({
      id: `dense:${section}`,
      severity: "warning",
      title: `${sectionLabels[section]}标签较多`,
      description: `当前有 ${sectionTags.length} 项启用标签，建议确认每一项都对画面有明确作用。`,
      tags: [],
    });
  }

  const rank: Record<PromptAuditSeverity, number> = { conflict: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

const sectionLabels: Record<PromptSectionId, string> = {
  character: "人物与角色",
  features: "角色特征",
  clothing: "人物衣着",
  action: "动作与姿态",
  composition: "构图与视角",
  scene: "场景与背景",
  quality: "质量与年代",
  other: "其他提示词",
  negative: "Undesired Content",
};

export function removePromptAuditTag(sections: PromptSections, tagId: string): PromptSections {
  return Object.fromEntries(Object.entries(sections).map(([section, tags]) => [section, (tags as PromptTag[]).filter((tag) => tag.id !== tagId)])) as PromptSections;
}
