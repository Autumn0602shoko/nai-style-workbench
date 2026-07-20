export type ParsedArtist = {
  name: string;
  weight: number;
};

type MatchCandidate = ParsedArtist & { start: number; end: number };

const cleanName = (value: string) =>
  value
    .replace(/\\,/g, ",")
    .trim()
    .replace(/^['"\\\s]+|['"\\\s]+$/g, "");

const bracketWeight = (opening: string, closing: string) => {
  const strong = Math.min(
    [...opening].filter((char) => char === "{").length,
    [...closing].filter((char) => char === "}").length,
  );
  const weak = Math.min(
    [...opening].filter((char) => char === "[").length,
    [...closing].filter((char) => char === "]").length,
  );
  return 1.05 ** (strong - weak);
};

/** Parse artist tags from NovelAI prompts, copied metadata, or JSON text. */
export function parseArtistTags(input: string): ParsedArtist[] {
  const candidates: MatchCandidate[] = [];
  const occupied: Array<[number, number]> = [];

  const add = (start: number, end: number, name: string, weight: number) => {
    const cleaned = cleanName(name);
    if (!cleaned || occupied.some(([from, to]) => start < to && end > from)) return;
    candidates.push({ start, end, name: cleaned, weight });
    occupied.push([start, end]);
  };

  // Numeric emphasis: 1.25::artist:name::
  const numeric = /(-?\d+(?:\.\d+)?)::\s*artist:((?:\\,|[^,:\n])+?)\s*::/gi;
  for (const match of input.matchAll(numeric)) {
    add(match.index, match.index + match[0].length, match[2], Number(match[1]));
  }

  // Bracket emphasis: {{artist:name}} or [[artist:name]].
  const bracketed = /([\[{]+)\s*artist:((?:\\,|[^,:\n\]}])+?)\s*([\]}]+)/gi;
  for (const match of input.matchAll(bracketed)) {
    add(match.index, match.index + match[0].length, match[2], bracketWeight(match[1], match[3]));
  }

  // Unweighted tags, including those embedded in copied JSON metadata.
  const plain = /artist:((?:\\,|[^,:\n\]}])+)/gi;
  for (const match of input.matchAll(plain)) {
    add(match.index, match.index + match[0].length, match[1], 1);
  }

  const unique = new Map<string, ParsedArtist>();
  for (const candidate of candidates.sort((a, b) => a.start - b.start)) {
    const key = candidate.name.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, { name: candidate.name, weight: Number(candidate.weight.toFixed(4)) });
    }
  }
  return [...unique.values()];
}
