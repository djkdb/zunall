"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import { saveDashboardWidgets } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DASHBOARD_WIDGETS, DEFAULT_WIDGETS, type WidgetKey } from "@/lib/dashboard-widgets";

/** 대시보드에 어떤 카드를 띄울지 고른다 (사람마다 중요한 카드가 다르다) */
export function DashboardSettingsButton({ current }: { current: WidgetKey[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<WidgetKey[]>(current);
  const [pending, setPending] = React.useState(false);

  const toggle = (key: WidgetKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="대시보드 구성" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="대시보드 구성">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            보고 싶은 카드만 남겨두세요. 언제든 다시 켤 수 있습니다.
          </p>

          <ul className="space-y-1.5">
            {(Object.keys(DASHBOARD_WIDGETS) as WidgetKey[]).map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={selected.includes(key)}
                    onChange={() => toggle(key)}
                  />
                  {DASHBOARD_WIDGETS[key]}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(DEFAULT_WIDGETS)}
            >
              기본값으로
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  await saveDashboardWidgets(selected);
                  setPending(false);
                  setOpen(false);
                  router.refresh();
                }}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                저장
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
