import { desc, eq } from "drizzle-orm";
import {
  PlusCircle,
  RefreshCw,
  FileText,
  Package,
  Sparkles,
  ListTodo,
  CalendarDays,
  StickyNote,
  BookMarked,
} from "lucide-react";
import { db, activityHistory, type ActivityRow } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioForm } from "@/components/activities/portfolio-form";
import { formatDateTime } from "@/lib/utils";
import type { HistoryKind } from "@/lib/constants";

const KIND_ICONS: Record<HistoryKind, React.ComponentType<{ className?: string }>> = {
  created: PlusCircle,
  status: RefreshCw,
  updated: RefreshCw,
  file: FileText,
  submission: Package,
  ai: Sparkles,
  task: ListTodo,
  event: CalendarDays,
  note: StickyNote,
};

export function HistoryTab({ activity }: { activity: ActivityRow }) {
  const history = db
    .select()
    .from(activityHistory)
    .where(eq(activityHistory.activityId, activity.id))
    .orderBy(desc(activityHistory.createdAt))
    .all();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          진행 기록
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">기록이 없습니다.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {history.map((entry) => {
              const Icon = KIND_ICONS[entry.kind as HistoryKind] ?? RefreshCw;
              return (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-secondary ring-4 ring-background">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                  <p className="text-sm">{entry.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <BookMarked className="h-4 w-4 text-muted-foreground" /> 활동 기록 (포트폴리오)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              역할, 성과, 배운 점을 기록해두면 나중에 포트폴리오로 활용할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent>
            <PortfolioForm activity={activity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
