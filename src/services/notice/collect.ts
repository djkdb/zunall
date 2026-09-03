import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, noticeSources, noticeItems, type NoticeSourceRow } from "@/lib/db";
import { validateNoticeUrl } from "@/services/document/html-text";
import { pushNotification } from "@/lib/history";
import { newId } from "@/lib/utils";
import { filterByKeywords, parseNoticeList } from "./parse";

/**
 * 등록한 사이트를 훑어 새 공고를 찾아 저장한다.
 *
 * - 처음 확인할 때는 알림을 보내지 않는다 (그동안 쌓인 글이 한꺼번에 알림으로 오면 곤란하다).
 * - 같은 소스 안에서 URL 이 같으면 이미 본 공고로 본다.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
/** 한 번에 저장할 최대 개수 — 목록이 아주 긴 사이트에서 폭주하지 않도록 */
const MAX_PER_CHECK = 40;
/** 소스 하나가 쌓아둘 수 있는 최대 개수 */
const MAX_KEPT = 200;

export interface CollectResult {
  ok: boolean;
  found: number;
  error?: string;
}

export async function collectSource(source: NoticeSourceRow): Promise<CollectResult> {
  const firstCheck = source.lastCheckedAt === null;
  const fetched = await fetchList(source.url);

  if (!fetched.ok) {
    await db
      .update(noticeSources)
      .set({ lastCheckedAt: Date.now(), lastError: fetched.error, lastFound: 0 })
      .where(eq(noticeSources.id, source.id));
    return { ok: false, found: 0, error: fetched.error };
  }

  const parsed = filterByKeywords(
    parseNoticeList(fetched.body, source.url, fetched.contentType),
    source.keywords,
  ).slice(0, MAX_PER_CHECK);

  let inserted = 0;
  if (parsed.length > 0) {
    // 이미 본 URL 은 건너뛴다 (조회 한 번으로 확인)
    const known = new Set(
      (
        await db
          .select({ url: noticeItems.url })
          .from(noticeItems)
          .where(
            and(
              eq(noticeItems.sourceId, source.id),
              inArray(noticeItems.url, parsed.map((p) => p.url)),
            ),
          )
      ).map((row) => row.url),
    );

    const fresh = parsed.filter((item) => !known.has(item.url));
    if (fresh.length > 0) {
      await db.insert(noticeItems).values(
        fresh.map((item) => ({
          id: newId(),
          userId: source.userId,
          sourceId: source.id,
          url: item.url,
          title: item.title.slice(0, 300),
          publishedAt: item.publishedAt ?? null,
          status: "new",
          foundAt: Date.now(),
        })),
      );
      inserted = fresh.length;
    }
  }

  await db
    .update(noticeSources)
    .set({ lastCheckedAt: Date.now(), lastError: null, lastFound: inserted })
    .where(eq(noticeSources.id, source.id));

  await pruneOld(source.id);

  // 첫 확인은 "지금까지 올라온 글"이라 알림을 보내지 않는다.
  if (inserted > 0 && !firstCheck) {
    await pushNotification({
      userId: source.userId,
      type: "notice",
      title: `${source.name}에 새 공고 ${inserted}건`,
      body: "기회 > 수집 화면에서 확인하세요.",
    });
  }

  return { ok: true, found: inserted };
}

/** 사용자의 소스를 모두 확인한다 (오래 확인하지 않은 것부터) */
export async function collectForUser(userId: string, limit = 10): Promise<{ found: number; checked: number }> {
  const sources = await db
    .select()
    .from(noticeSources)
    .where(and(eq(noticeSources.userId, userId), eq(noticeSources.active, 1)));

  const ordered = [...sources].sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0)).slice(0, limit);

  let found = 0;
  for (const source of ordered) {
    const result = await collectSource(source);
    found += result.found;
  }
  return { found, checked: ordered.length };
}

/** 오래된 항목 정리 — 처리된 것부터, 개수를 넘으면 오래된 순으로 지운다 */
async function pruneOld(sourceId: string): Promise<void> {
  const rows = await db
    .select({ id: noticeItems.id, foundAt: noticeItems.foundAt })
    .from(noticeItems)
    .where(eq(noticeItems.sourceId, sourceId));
  if (rows.length <= MAX_KEPT) return;

  const excess = [...rows].sort((a, b) => a.foundAt - b.foundAt).slice(0, rows.length - MAX_KEPT);
  await db.delete(noticeItems).where(inArray(noticeItems.id, excess.map((r) => r.id)));
}

interface FetchedList {
  ok: boolean;
  body: string;
  contentType: string;
  error?: string;
}

/**
 * 목록 페이지를 가져온다.
 * 본문 추출용 fetchNotice 와 달리 RSS/Atom(XML)도 받아야 해서 따로 둔다.
 * 주소 검증(SSRF 차단)은 같은 함수를 쓴다.
 */
async function fetchList(raw: string): Promise<FetchedList> {
  const checked = validateNoticeUrl(raw);
  if ("error" in checked) return { ok: false, body: "", contentType: "", error: checked.error };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(checked.url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CaveroBot/1.0; +https://github.com/djkdb/zunall)",
        accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.9",
        "accept-language": "ko,en;q=0.8",
      },
    });
    if (!response.ok) {
      return { ok: false, body: "", contentType: "", error: `가져오지 못했습니다 (HTTP ${response.status}).` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/html|xml|rss|atom|text\/plain/i.test(contentType)) {
      return {
        ok: false,
        body: "",
        contentType,
        error: `읽을 수 없는 형식입니다 (${contentType.split(";")[0] || "형식 불명"}).`,
      };
    }

    return { ok: true, body: await readCapped(response), contentType };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      body: "",
      contentType: "",
      error: aborted ? "시간이 너무 오래 걸려 중단했습니다." : "사이트에 접속하지 못했습니다.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      size += value.byteLength;
    }
  }
  await reader.cancel().catch(() => undefined);

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk.subarray(0, Math.min(chunk.byteLength, size - offset)), offset);
    offset += chunk.byteLength;
    if (offset >= size) break;
  }
  return new TextDecoder("utf-8").decode(merged);
}
