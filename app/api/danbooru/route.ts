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
  tag_string_character?: string;
  tag_string_copyright?: string;
  tag_string_meta?: string;
};

const fetchJson = async <T,>(url: URL, retry = true): Promise<T> => {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(retry ? 12_000 : 22_000) });
    if (!response.ok) {
      if (response.status >= 500 && retry) return fetchJson<T>(url, false);
      throw new Error(`Danbooru returned ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (retry) return fetchJson<T>(url, false);
    throw error;
  }
};

const fetchTagSuggestions = async (query: string, mode: "artist" | "tag", limit = 30) => {
  const fetchMatches = async (pattern: string) => {
    const url = new URL("/tags.json", DANBOORU);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("search[name_matches]", pattern);
    if (mode === "artist") url.searchParams.set("search[category]", "1");
    url.searchParams.set("search[order]", "count");
    return fetchJson<DanbooruTag[]>(url);
  };
  const [prefix, contains] = await Promise.all([
    fetchMatches(`${query}*`),
    fetchMatches(`*${query}*`),
  ]);
  return [...new Map([...prefix, ...contains].map((tag) => [tag.name, tag])).values()].slice(0, limit);
};

const fetchPosts = (tag: string, page: number) => {
  const postsUrl = new URL("/posts.json", DANBOORU);
  postsUrl.searchParams.set("limit", "24");
  postsUrl.searchParams.set("page", String(page));
  postsUrl.searchParams.set("tags", tag);
  return fetchJson<DanbooruPost[]>(postsUrl);
};

const fetchPostCount = async (tags: string) => {
  const countUrl = new URL("/counts/posts.json", DANBOORU);
  countUrl.searchParams.set("tags", tags);
  const data = await fetchJson<{ counts?: { posts?: number } }>(countUrl);
  return data.counts?.posts || 0;
};

export async function GET(request: NextRequest) {
  const image = request.nextUrl.searchParams.get("image");
  if (image) {
    try {
      const imageUrl = new URL(image);
      if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "cdn.donmai.us") throw new Error("invalid host");
      const response = await fetch(imageUrl, { headers, signal: AbortSignal.timeout(12_000) });
      if (!response.ok || !response.body) throw new Error("image unavailable");
      return new NextResponse(response.body, { headers: { "Content-Type": response.headers.get("content-type") || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }

  const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/\s+/g, "_");
  const mode = request.nextUrl.searchParams.get("mode") === "tag" ? "tag" : "artist";
  const chosen = (request.nextUrl.searchParams.get("tag") || "").trim().toLowerCase();
  const combo = (request.nextUrl.searchParams.get("combo") || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const page = Math.max(1, Math.min(1000, Number(request.nextUrl.searchParams.get("page")) || 1));
  if (!query && !chosen && !combo.length) return NextResponse.json({ error: "请输入画师或提示词" }, { status: 400 });

  try {
    const isSuggestion = request.nextUrl.searchParams.get("suggest") === "1";
    if (combo.length) {
      const expression = [...new Set(combo)].join(" ");
      const [posts, totalCount] = await Promise.all([fetchPosts(expression, page), fetchPostCount(expression).catch(() => 0)]);
      return NextResponse.json({
        selectedTag: expression,
        totalCount,
        suggestions: [],
        posts: posts.filter((post) => post.preview_file_url).map((post) => ({
          id: post.id,
          rating: post.rating,
          previewUrl: `/api/danbooru?image=${encodeURIComponent(post.preview_file_url!)}`,
          imageUrl: `/api/danbooru?image=${encodeURIComponent(post.large_file_url || post.file_url || post.preview_file_url!)}`,
          source: post.source || null,
          artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
          generalTags: (post.tag_string_general || "").split(" ").filter(Boolean),
          characterTags: (post.tag_string_character || "").split(" ").filter(Boolean),
          copyrightTags: (post.tag_string_copyright || "").split(" ").filter(Boolean),
          metaTags: (post.tag_string_meta || "").split(" ").filter(Boolean).slice(0, 12),
          postUrl: `${DANBOORU}/posts/${post.id}`,
        })),
      }, { headers: { "Cache-Control": "public, max-age=300" } });
    }
    const tagsPromise = chosen && page > 1 ? Promise.resolve([] as DanbooruTag[]) : fetchTagSuggestions(query || chosen, mode, isSuggestion ? 30 : 8);
    if (isSuggestion) {
      const tags = await tagsPromise;
      return NextResponse.json({ suggestions: tags.map((tag) => ({ name: tag.name, count: tag.post_count })) }, { headers: { "Cache-Control": "public, max-age=120" } });
    }
    let tags: DanbooruTag[];
    let posts: DanbooruPost[];
    let selectedTag: string | undefined;
    if (chosen) {
      selectedTag = chosen;
      [tags, posts] = await Promise.all([tagsPromise, fetchPosts(selectedTag, page)]);
    } else {
      tags = await tagsPromise;
      selectedTag = tags.find((tag) => tag.name === query)?.name || tags[0]?.name;
      posts = selectedTag ? await fetchPosts(selectedTag, page) : [];
    }

    if (!selectedTag) return NextResponse.json({ suggestions: [], posts: [], selectedTag: null });

    return NextResponse.json({
      selectedTag,
      totalCount: tags.find((tag) => tag.name === selectedTag)?.post_count || 0,
      suggestions: tags.map((tag) => ({ name: tag.name, count: tag.post_count })),
      posts: posts
        .filter((post) => post.preview_file_url)
        .map((post) => ({
          id: post.id,
          rating: post.rating,
          previewUrl: `/api/danbooru?image=${encodeURIComponent(post.preview_file_url!)}`,
          imageUrl: `/api/danbooru?image=${encodeURIComponent(post.large_file_url || post.file_url || post.preview_file_url!)}`,
          source: post.source || null,
          artistTags: (post.tag_string_artist || "").split(" ").filter(Boolean),
          generalTags: (post.tag_string_general || "").split(" ").filter(Boolean),
          characterTags: (post.tag_string_character || "").split(" ").filter(Boolean),
          copyrightTags: (post.tag_string_copyright || "").split(" ").filter(Boolean),
          metaTags: (post.tag_string_meta || "").split(" ").filter(Boolean).slice(0, 12),
          postUrl: `${DANBOORU}/posts/${post.id}`,
        })),
    }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "暂时无法连接 Danbooru，请稍后重试" }, { status: 502 });
  }
}
