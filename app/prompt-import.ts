import type { PromptSectionId, PromptSections } from "./prompt-section-editor";

export type ImportedPromptTag = {
  text: string;
  weight: number;
  section: PromptSectionId;
};

const subjectWords = /^(?:solo|1girl|1boy|2girls|2boys|3girls|3boys|4girls|4boys|multiple_girls|multiple_boys|male_focus|female_focus)$/;
const clothingWords = /dress|shirt|skirt|pants|shorts|uniform|jacket|coat|sleeve|shoes|boots|hat|gloves|swimsuit|bikini|lingerie|clothes|hoodie|kimono|armor|stockings|thighhighs|pantyhose|bra|necktie|ribbon|collar|choker|apron|robe|sweater|cardigan|socks|footwear|bare_shoulders|off_shoulder|cleavage|navel|midriff/;
const characterWords = /(?:black|brown|blonde|yellow|red|orange|green|blue|purple|pink|white|grey|gray|silver|aqua|multicolored|two-tone)_hair|(?:black|brown|yellow|red|orange|green|blue|purple|pink|white|grey|gray|aqua|heterochromia)_eyes|closed_eyes|one_eye_closed|blush|smile|smiling|grin|open_mouth|closed_mouth|frown|crying|tears|angry|surprised|embarrassed|expressionless|tongue|winking|long_hair|short_hair|medium_hair|very_long_hair|twintails|ponytail|braid|bangs|ahoge|hair_between_eyes|hair_ornament|bald|animal_ears|cat_ears|fox_ears|dog_ears|horns|tail|wings|fang|freckles|mole|dark_skin|dark-skinned|dark_skinned|pale_skin|tan|muscular|petite|curvy|glasses|breasts|flat_chest|nipples|thighs|legs|armpits/;
const actionWords = /sitting|standing|walking|running|lying|looking|holding|fighting|dancing|jumping|kneeling|pose|reaching|sleeping|eating|drinking|grabbing|pulling|hugging|kissing|arms_|hand_on|hands_on|head_tilt/;
const compositionWords = /focus|foreshortening|perspective|view|angle|close-up|close_up|upper_body|lower_body|full_body|cowboy_shot|portrait|from_above|from_below|dutch_angle|depth_of_field|cropped|out_of_frame|wide_shot/;
const sceneWords = /background|indoors|outdoors|city|street|room|bedroom|classroom|school|beach|forest|ocean|sky|cloud|sunset|sunrise|night|day|weather|rain|snow|wind|garden|park|building|window|door|landscape/;
const qualityWords = /^(?:masterpiece|best_quality|amazing_quality|great_quality|normal_quality|low_quality|worst_quality|absurdres|highres|very_aesthetic|aesthetic|newest|recent|vintage|year_\d{4}|rating:.+)$/;

const splitPrompt = (input: string) => {
  const values: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of input.replace(/[\r\n]+/g, ",")) {
    if (escaped) {
      current += char === "," ? "\\," : `\\${char}`;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === ",") {
      if (current.trim()) values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (escaped) current += "\\";
  if (current.trim()) values.push(current.trim());
  return values;
};

const stripOuterQuotes = (value: string) => value.trim().replace(/^["']+|["']+$/g, "").trim();

const parseWeightedTag = (value: string) => {
  const numeric = value.match(/^(-?\d+(?:\.\d+)?)::\s*(.*?)\s*::$/);
  if (numeric) return { text: stripOuterQuotes(numeric[2]), weight: Number(numeric[1]) };

  const bracketed = value.match(/^([\[{]+)\s*(.*?)\s*([\]}]+)$/);
  if (bracketed) {
    const strong = Math.min([...bracketed[1]].filter((char) => char === "{").length, [...bracketed[3]].filter((char) => char === "}").length);
    const weak = Math.min([...bracketed[1]].filter((char) => char === "[").length, [...bracketed[3]].filter((char) => char === "]").length);
    return { text: stripOuterQuotes(bracketed[2]), weight: Number((1.05 ** (strong - weak)).toFixed(4)) };
  }

  return { text: stripOuterQuotes(value), weight: 1 };
};

export function classifyPromptTag(value: string): PromptSectionId {
  const tag = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (clothingWords.test(tag)) return "clothing";
  if (subjectWords.test(tag) || characterWords.test(tag) || /_\([^)]+\)$/.test(tag)) return "character";
  if (actionWords.test(tag)) return "action";
  if (compositionWords.test(tag)) return "composition";
  if (sceneWords.test(tag)) return "scene";
  if (qualityWords.test(tag)) return "quality";
  return "other";
}

/** Parse a positive NovelAI Prompt while preserving its order and emphasis. */
export function importPromptTags(input: string): ImportedPromptTag[] {
  const unique = new Set<string>();
  const result: ImportedPromptTag[] = [];
  for (const value of splitPrompt(input)) {
    const parsed = parseWeightedTag(value);
    if (!parsed.text || /^artist:/i.test(parsed.text)) continue;
    const key = parsed.text.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    result.push({ ...parsed, section: classifyPromptTag(parsed.text) });
  }
  return result;
}

/** Move one tag without changing its text, weight, enabled state, or id. */
export function movePromptTagToSection(sections: PromptSections, from: PromptSectionId, to: PromptSectionId, tagId: string): PromptSections {
  if (from === to) return sections;
  const tag = sections[from].find((item) => item.id === tagId);
  if (!tag) return sections;
  const duplicate = sections[to].some((item) => item.text.trim().toLowerCase() === tag.text.trim().toLowerCase());
  return {
    ...sections,
    [from]: sections[from].filter((item) => item.id !== tagId),
    [to]: duplicate ? sections[to] : [...sections[to], tag],
  };
}
