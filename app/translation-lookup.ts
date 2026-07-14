export type TranslationLookupResult = { candidates: string[]; source: string };

export const prepareTranslationQuery = (tag: string) => tag.trim().replace(/_/g, " ").replace(/\s+/g, " ").slice(0, 120);
const simplifyCandidate = (value: string) => value.replace(/[絲襪髮體視動裝顏頭側畫圖單雙後與門開閉藍綠黃紅暈臉腳褲襯領]/g, (character) => (({ 絲: "丝", 襪: "袜", 髮: "发", 體: "体", 視: "视", 動: "动", 裝: "装", 顏: "颜", 頭: "头", 側: "侧", 畫: "画", 圖: "图", 單: "单", 雙: "双", 後: "后", 與: "与", 門: "门", 開: "开", 閉: "闭", 藍: "蓝", 綠: "绿", 黃: "黄", 紅: "红", 暈: "晕", 臉: "脸", 腳: "脚", 褲: "裤", 襯: "衬", 領: "领" } as Record<string, string>)[character] || character));

export const extractTranslationCandidates = (payload: unknown): string[] => {
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const responseData = data.responseData && typeof data.responseData === "object" ? data.responseData as Record<string, unknown> : {};
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const values = [responseData.translatedText, ...matches.map((match) => match && typeof match === "object" ? (match as Record<string, unknown>).translation : null)];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => simplifyCandidate(value.trim().replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")))
    .filter((value) => value.length > 0 && value.length <= 120 && /[\u3400-\u9fff]/.test(value)))]
    .slice(0, 6);
};

export async function lookupTagTranslation(tag: string): Promise<TranslationLookupResult> {
  const query = prepareTranslationQuery(tag);
  if (query.length < 2) return { candidates: [], source: "MyMemory" };
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", query);
  url.searchParams.set("langpair", "en|zh-CN");
  url.searchParams.set("mt", "1");
  const response = await fetch(url, { headers: { "User-Agent": "NAI-Style-Workbench/0.18.0" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`翻译服务返回 ${response.status}`);
  return { candidates: extractTranslationCandidates(await response.json()), source: "MyMemory" };
}
