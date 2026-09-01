import Link from "next/link";
import { Building2, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  STATUS_BADGE_CLASSES,
  type ActivityType,
  type ActivityStatus,
} from "@/lib/constants";
import { cn, ddayColorClass, ddayDotClass, ddayLabel } from "@/lib/utils";
import type { ActivityMeta } from "@/lib/queries";

export function ActivityCard({ activity }: { activity: ActivityMeta }) {
  const deadline = activity.nearestDeadline;
  const progress =
    activity.taskTotal > 0 ? Math.round((activity.taskDone / activity.taskTotal) * 100) : null;

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: activity.color }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-snug group-hover:text-primary">
              {activity.name}
            </p>
            {activity.organizer && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{activity.organizer}</span>
              </p>
            )}
          </div>
        </div>
        {deadline && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold",
              ddayColorClass(deadline.days),
            )}
            title={`${deadline.label} ${deadline.date}`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", ddayDotClass(deadline.days))} />
            {ddayLabel(deadline.days)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{ACTIVITY_TYPES[activity.type as ActivityType] ?? activity.type}</Badge>
        <Badge className={STATUS_BADGE_CLASSES[activity.status as ActivityStatus] ?? ""}>
          {ACTIVITY_STATUSES[activity.status as ActivityStatus] ?? activity.status}
        </Badge>
        {activity.aiScore !== null && (
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-3 w-3" /> AI {activity.aiScore}
          </Badge>
        )}
      </div>

      {activity.tagNames.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">
          {activity.tagNames.map((t) => `#${t}`).join(" ")}
        </p>
      )}

      {progress !== null && (
        <div className="mt-auto space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              작업 {activity.taskDone}/{activity.taskTotal}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </Link>
  );
}
