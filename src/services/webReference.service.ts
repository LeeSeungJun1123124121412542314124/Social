// src/services/webReference.service.ts
// 네이버 블로그 검색 API → 상위 결과 순차 크롤링 → 본문 추출 서비스

import * as cheerio from "cheerio";
import { getDecryptedKey } from "./settings.service";
import { logger } from "@/lib/logger";

const NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_EXCERPT_LENGTH = 2_000;
const MIN_TEXT_LENGTH = 500;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface WebReference {
  title: string;
  url: string;
  source: string;        // 블로그명
  contentExcerpt: string; // 최대 2,000자 truncate
  rank: 1 | 2 | 3;
}

interface NaverBlogItem {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

interface NaverSearchResponse {
  items: NaverBlogItem[];
}

// HTML 태그 제거 헬퍼 (네이버 API 응답의 <b> 태그 등)
function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").trim();
}

// 본문 텍스트 추출 (cheerio 기반)
function extractBodyText(html: string): string {
  const $ = cheerio.load(html);

  // 불필요한 요소 제거
  $("script, style, nav, header, footer, aside, noscript, iframe").remove();

  // 네이버 블로그 본문 선택자 순서 폴백
  const selectors = [
    ".se-main-container",   // 스마트에디터 ONE
    "#postViewArea",        // 구버전 네이버 블로그
    ".post-view",           // 일부 테마
    "article",              // 일반 HTML
    ".entry-content",       // 워드프레스 등
  ];

  let text = "";
  for (const sel of selectors) {
    if ($(sel).length > 0) {
      text = $(sel).text();
      break;
    }
  }

  // 어느 선택자도 충분하지 않으면 body 전체
  if (text.trim().length < MIN_TEXT_LENGTH) {
    text = $("body").text();
  }

  // 공백/개행 정규화
  return text.replace(/\s+/g, " ").trim();
}

// 본문 2,000자 truncate
function truncateExcerpt(text: string): string {
  if (text.length <= MAX_EXCERPT_LENGTH) return text;
  return text.slice(0, MAX_EXCERPT_LENGTH) + "...";
}

// 단일 URL 크롤링 시도 → 본문 텍스트 반환 (실패 시 null)
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = extractBodyText(html);
    return text.length >= MIN_TEXT_LENGTH ? text : null;
  } catch {
    return null;
  }
}

/**
 * 주제를 네이버 블로그 검색 → 상위 1~3개 순차 크롤링 → 성공한 첫 결과 반환.
 * 3건 모두 실패하면 null 반환 (fail-open 처리는 호출부 책임).
 */
export async function fetchTopReference(topic: string): Promise<WebReference | null> {
  const clientId = await getDecryptedKey("naver_client_id");
  const clientSecret = await getDecryptedKey("naver_client_secret");

  if (!clientId || !clientSecret) {
    throw new Error("네이버 검색 API 키가 설정되지 않았습니다.");
  }

  // 네이버 블로그 검색 API 호출
  const qs = new URLSearchParams({
    query: topic,
    display: "3",
    sort: "sim",
  });
  const searchRes = await fetch(`${NAVER_SEARCH_URL}?${qs.toString()}`, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!searchRes.ok) {
    throw new Error(`네이버 검색 API 오류: ${searchRes.status}`);
  }

  const searchData = (await searchRes.json()) as NaverSearchResponse;
  const items = searchData.items ?? [];

  // 상위 3개 순차 크롤링
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i]!;
    const rank = (i + 1) as 1 | 2 | 3;

    const text = await fetchPageText(item.link);
    if (text) {
      logger.info(`네이버 블로그 참고자료 수집 성공 (${rank}등): ${item.bloggername}`);
      return {
        title: stripHtml(item.title),
        url: item.link,
        source: item.bloggername,
        contentExcerpt: truncateExcerpt(text),
        rank,
      };
    }

    // 크롤링 실패 시 검색 description 폴백 (500자 미만이어도 허용)
    const desc = stripHtml(item.description);
    if (desc.length >= 50) {
      logger.info(`네이버 블로그 참고자료 — 크롤링 실패, description 사용 (${rank}등): ${item.bloggername}`);
      return {
        title: stripHtml(item.title),
        url: item.link,
        source: item.bloggername,
        contentExcerpt: truncateExcerpt(desc),
        rank,
      };
    }
  }

  logger.info(`네이버 블로그 참고자료 수집 실패: 주제 "${topic}", 상위 3건 모두 실패`);
  return null;
}
