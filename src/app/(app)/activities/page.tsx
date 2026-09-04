import type { Metadata } from "next";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getActivitiesWithMeta, getUserTags } from "@/lib/queries";
import { ActivityCard } from "@/components/activities/activity-card";
import { StatusBoard } from "@/components/activities/status-board";
import { ViewToggle } from "@/components/activities/view-toggle";
import { ActivityFilters } from "@/components/activities/activity-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ONGOING_STATUSES, FINISHED_STATUSES, ACTIVITY_STATUSES, type ActivityStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "활동" };

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const type = typeof params.type === "string" ? params.type : "all";
  const tag = typeof params.tag === "string" ? params.tag : "all";
  const view = params.view === "board" ? "board" : "list";

  const [initialItems, allTags] = await Promise.all([
    getActivitiesWithMeta(user.id),
    getUserTags(user.id),
  ]);
  let items = initialItems;

  if (filter === "ongoing") {
    items = items.filter((a) => (ONGOING_STATUSES as string[]).includes(a.status));
  } else if (filter === "finished") {
    items = items.filter((a) => (FINISHED_STATUSES as string[]).includes(a.status));
  } else if (filter === "interested") {
    items = items.filter((a) => a.status === "interested");
  } else if (filter === "imminent") {
    items = items.filter((a) => a.nearestDeadline !== null && a.nearestDeadline.days <= 7);
  }

  if (type !== "all") items = items.filter((a) => a.type === type);
  if (tag !== "all") items = items.filter((a) => a.tagNames.includes(tag));

  if (q) {
    items = items.filter((a) => {
      const statusLabel = ACTIVITY_STATUSES[a.status as ActivityStatus] ?? "";
      const haystack = [a.name, a.organizer ?? "", a.memo ?? "", statusLabel, ...a.tagNames]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // 마감 임박순 → 최근 수정순 정렬
  items.sort((a, b) => {
    const da = a.nearestDeadline?.days ?? Infinity;
    const db_ = b.nearestDeadline?.days ?? Infinity;
    if (da !== db_) return da - db_;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">활동</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            총 {items.length}개의 활동
          </p>
        </div>
        <Link href="/activities/new">
          <Button>
            <Plus className="h-4 w-4" /> 새 활동
          </Button>
        </Link>
      </div>

      <ViewToggle view={view} />

      <ActivityFilters tags={allTags} />

      {view === "board" && items.length > 0 ? (
        <StatusBoard
          items={items.map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
            type: a.type,
            color: a.color,
            nearestDeadline: a.nearestDeadline,
          }))}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q || filter !== "all" || type !== "all" ? "조건에 맞는 활동이 없습니다" : "아직 등록된 활동이 없습니다"}
          description="공모전, 대외활동, 해커톤 등 참여 중인 활동을 등록하고 한곳에서 관리해보세요."
          action={
            <Link href="/activities/new">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" /> 첫 활동 만들기
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
