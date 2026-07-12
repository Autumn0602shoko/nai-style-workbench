import { NextRequest, NextResponse } from "next/server";

const DANBOORU = "https://danbooru.donmai.us";
const headers = { "User-Agent": "NAI-Style-Workbench/0.3 (reference browser)" };

type DanbooruTag = { name: string; post_count: number; category: number };
type DanbooruPost = {
  id: number;
  rating: string;
  preview_file_url?: string | null;
  large_file_url?: string | null;
  file_url?: string | null;
  source?: string | null;
  tag_string_artist?: string;
  tag_string_general?: string;
};

const fetchJson = async <T,>(url: URL): Promise<T> => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Danbooru returned ${response.status}`);
  return response.json() as Promise<T>;
};

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/\s+/g, "_");
  const mode = request.nextUrl.searchParams.get("mode") === "tag" ? "tag" : "artist";
  const chosen = (request.nextUrl.searchParams.get("tag") || "").trim().toLowerCase();
  if (!query && !chosen) return NextResponse.json({ error: "请输入画师或提示词" }, { status: 400 });

  try {
    const tagsUrl = new URL("/tags.json", DANBOORU);
    tagsUrl.searchParams.set("limit", "8");
    tagsUrl.searchParams.set("search[name_matches]", `${query || chosen}*`);
    tagsUrl.searchParams.set("search[category]", mode === "artist" ? "1" : "0");
    tagsUrl.searchParams.set("search[order]", "count");
    const tags = await fetchJson<DanbooruTag[]>(tagsUrl);
    const selectedTag = chosen || tags.find((tag) => tag.name === query)?.name || tags[0]?.name;

    if (!selectedTag) return NextResponse.json({ suggestions: [], posts: [], selectedTag: null });

    const postsUrl = new URL("/posts.json", DANBOORU);
    postsUrl.searchParams.set("limit", "18");
    postsUrl.searchParams.set("tags", `${selectedTag} rating:g`);
    const posts = await fetchJson<DanbooruPost[]>(postsUrl);

    return NextResponse.json({
      selectedTag,
      suggestions: tags.map((tag) => ({ name: tag.name, count: tag.post_count })),
      posts: posts
        .filter((post) => post.rating === "g" && post.preview_file_url)
        .map((post) => ({
          id: post.id,
          previewUrl: post.preview_file_url,
          imageUrl: post.large_file_url || post.file_url || post.preview_file_url,
          source: post.source || null,
          artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
          generalTags: (post.tag_string_general || "").split(" ").filter(Boolean).slice(0, 18),
          postUrl: `${DANBOORU}/posts/${post.id}`,
        })),
    }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "暂时无法连接 Danbooru，请稍后重试" }, { status: 502 });
  }
}

