import { useState, useEffect } from "react";

export type NewsItem = {
  title: string;
  url: string;
};

// ── 한국 뉴스 RSS 피드 목록 (연합뉴스 — 문화, 과학, 경제) ─────
const FEED_URLS = [
  "https://www.yna.co.kr/rss/culture.xml",
  "https://www.yna.co.kr/rss/science.xml",
  "https://www.yna.co.kr/rss/economy.xml",
];

// ── 모듈 레벨 캐시 (15분) ────────────────────────────────────
let cachedItems: NewsItem[] | null = null;
let cacheTs = 0;
const CACHE_MS = 15 * 60 * 1000;

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\[.*?\]\s*$/, "")   // 끝의 [출처] 제거
    .replace(/\s*<!\[CDATA\[/, "")   // CDATA 제거
    .replace(/]]>\s*$/, "")
    .trim();
}

function isUsable(title: string): boolean {
  if (!title || title.length < 6 || title.length > 55) return false;
  // 너무 자극적인 단어 필터 (탕비실 분위기 유지)
  const blocked = /총격|폭탄|사망|살인|자살|테러|폭발|참사/;
  return !blocked.test(title);
}

async function fetchKoreanNews(): Promise<NewsItem[]> {
  // 피드 중 하나를 랜덤 선택
  const feedUrl = FEED_URLS[Math.floor(Math.random() * FEED_URLS.length)];
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;

  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error("proxy fetch failed");

  const json = await res.json();
  const xml: string = json.contents ?? "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);

  return items
    .map((item) => {
      const rawTitle = item.querySelector("title")?.textContent ?? "";
      const link =
        item.querySelector("link")?.nextSibling?.textContent?.trim() ??
        item.querySelector("link")?.textContent?.trim() ??
        item.querySelector("guid")?.textContent?.trim() ?? "";
      return {
        title: cleanTitle(rawTitle),
        url: link,
      };
    })
    .filter((item) => isUsable(item.title) && item.url.startsWith("http"))
    .slice(0, 5);
}

/** 한국 뉴스 훅 — 실패 시 빈 배열, 앱 절대 중단 없음 */
export function useNews(): NewsItem[] {
  const [news, setNews] = useState<NewsItem[]>(() => cachedItems ?? []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cachedItems && Date.now() - cacheTs < CACHE_MS) {
        if (!cancelled) setNews(cachedItems);
        return;
      }
      try {
        const items = await fetchKoreanNews();
        cachedItems = items;
        cacheTs = Date.now();
        if (!cancelled) setNews(items);
      } catch {
        // 조용히 실패 — 빈 배열 유지, 앰비언트 문구로 대체
      }
    };

    load();
    const interval = setInterval(load, CACHE_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return news;
}
