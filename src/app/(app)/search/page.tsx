import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { FileText, FolderKanban, StickyNote, PenLine, Search as SearchIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, activities, documents, notes, essayDrafts, essayQuestions } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchBox } from "@/components/search/search-box";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";

export const metadata: Metadata = { title: "검색" };

/** 검색어 주변 문장을 잘라 보여준다 */
function snippet(text: string, query: string, span = 90): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, span * 2).trim();
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + query.length + span);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  if (query.length < 2) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">검색</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            활동뿐 아니라 업로드한 문서 본문, 메모, 자소서 답변까지 함께 찾습니다.
          </p>
        </div>
        <SearchBox defaultValue={query} />
        <EmptyState
          icon={SearchIcon}
          title="두 글자 이상 입력해주세요"
          description="예: '데이터 분석', '마감', '지원 동기'"
        />
      </div>
    );
  }

  const like = `%${query}%`;

  // 대상별 검색은 서로 독립적이라 한 번에 보낸다.
  const [actRows, docRows, noteRows, essayRows, nameRows] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, user.id),
          or(
            ilike(activities.name, like),
            ilike(sql`coalesce(${activities.organizer}, '')`, like),
            ilike(sql`coalesce(${activities.memo}, '')`, like),
          ),
        ),
      )
      .orderBy(desc(activities.updatedAt))
      .limit(20),
    db
      .select({
        id: documents.id,
        activityId: documents.activityId,
        name: documents.name,
        text: documents.extractedText,
      })
      .from(documents)
      .where(
        and(
          eq(documents.userId, user.id),
          or(ilike(documents.name, like), ilike(sql`coalesce(${documents.extractedText}, '')`, like)),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(20),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, user.id), ilike(notes.content, like)))
      .orderBy(desc(notes.updatedAt))
      .limit(20),
    db
      .select({
        id: essayDrafts.id,
        content: essayDrafts.content,
        version: essayDrafts.version,
        question: essayQuestions.question,
        activityId: essayQuestions.activityId,
      })
      .from(essayDrafts)
      .innerJoin(essayQuestions, eq(essayDrafts.questionId, essayQuestions.id))
      .where(and(eq(essayDrafts.userId, user.id), ilike(essayDrafts.content, like)))
      .orderBy(desc(essayDrafts.createdAt))
      .limit(20),
    db
      .select({ id: activities.id, name: activities.name })
      .from(activities)
      .where(eq(activities.userId, user.id)),
  ]);

  const activityNames = new Map(nameRows.map((a) => [a.id, a.name]));

  const total = actRows.length + docRows.length + noteRows.length + essayRows.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">검색</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          &lsquo;{query}&rsquo; 검색 결과 {total}건
        </p>
      </div>
      <SearchBox defaultValue={query} />

      {total === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="결과가 없습니다"
          description="다른 단어로 찾아보세요. 문서는 업로드 시 추출된 본문에서 검색합니다."
        />
      ) : (
        <div className="space-y-4">
          <ResultGroup
            title="활동"
            icon={FolderKanban}
            items={actRows.map((a) => ({
              key: a.id,
              href: `/activities/${a.id}`,
              title: a.name,
              badge: ACTIVITY_TYPES[a.type as ActivityType] ?? a.type,
              body: a.memo ? snippet(a.memo, query) : (a.organizer ?? ""),
            }))}
          />
          <ResultGroup
            title="문서 본문"
            icon={FileText}
            items={docRows.map((d) => ({
              key: d.id,
              href: `/activities/${d.activityId}?tab=documents`,
              title: d.name,
              badge: activityNames.get(d.activityId) ?? "",
              body: d.text ? snippet(d.text, query) : "",
            }))}
          />
          <ResultGroup
            title="메모"
            icon={StickyNote}
            items={noteRows.map((n) => ({
              key: n.id,
              href: n.activityId ? `/activities/${n.activityId}?tab=notes` : "/activities",
              title: n.activityId ? (activityNames.get(n.activityId) ?? "메모") : "메모",
              badge: "",
              body: snippet(n.content, query),
            }))}
          />
          <ResultGroup
            title="자기소개서 답변"
            icon={PenLine}
            items={essayRows.map((e) => ({
              key: e.id,
              href: `/activities/${e.activityId}?tab=essay`,
              title: e.question,
              badge: `v${e.version}`,
              body: snippet(e.content, query),
            }))}
          />
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ key: string; href: string; title: string; badge: string; body: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title} {items.length}건
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <Link key={item.key} href={item.href}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
                </div>
                {item.body && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
