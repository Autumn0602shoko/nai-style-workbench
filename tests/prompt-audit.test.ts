import assert from "node:assert/strict";
import test from "node:test";
import { auditPromptSections, removePromptAuditTag } from "../app/prompt-audit.ts";

const tag = (id: string, text: string, weight = 1) => ({ id, text, weight, enabled: true });
const sections = () => ({ character: [], features: [], clothing: [], action: [], composition: [], scene: [], quality: [], other: [], negative: [] });

test("detects clear prompt conflicts without flagging disabled tags", () => {
  const input = sections();
  input.character = [tag("subject", "1girl")];
  input.features = [tag("short", "short_hair"), tag("long", "long_hair"), { ...tag("closed", "closed_mouth"), enabled: false }];
  input.action = [tag("open", "open_mouth")];
  const issues = auditPromptSections(input);
  assert.ok(issues.some((issue) => issue.title === "发长互相冲突"));
  assert.ok(!issues.some((issue) => issue.title === "嘴部状态冲突"));
});

test("detects duplicates, redundant generic clothing and missing subjects", () => {
  const input = sections();
  input.clothing = [tag("dress", "dress"), tag("black", "black_dress")];
  input.other = [tag("other-dress", "dress")];
  const issues = auditPromptSections(input);
  assert.ok(issues.some((issue) => issue.id === "missing-subject"));
  assert.ok(issues.some((issue) => issue.title === "标签重复出现"));
  assert.ok(issues.some((issue) => issue.title === "通用词可能可以精简"));
});

test("removes a selected audit tag without changing the other sections", () => {
  const input = sections();
  input.character = [tag("subject", "1girl")];
  input.clothing = [tag("dress", "dress")];
  const next = removePromptAuditTag(input, "dress");
  assert.equal(next.clothing.length, 0);
  assert.equal(next.character[0].text, "1girl");
});
