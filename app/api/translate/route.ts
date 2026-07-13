import { NextRequest, NextResponse } from "next/server";
import { lookupTagTranslation } from "../../translation-lookup";

export async function GET(request: NextRequest) {
  const tag = (request.nextUrl.searchParams.get("q") || "").trim();
  if (tag.length < 2) return NextResponse.json({ candidates: [], source: "MyMemory" });
  try {
    return NextResponse.json(await lookupTagTranslation(tag), { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "暂时无法取得联网翻译，请稍后重试" }, { status: 502 });
  }
}
