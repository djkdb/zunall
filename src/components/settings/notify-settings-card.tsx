"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { saveNotifySettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/constants";
import { THRESHOLD_CHOICES, type NotifySettings } from "@/services/notification/settings";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 언제·무엇을 알릴지 고르는 카드 */
export function NotifySettingsCard({ initial }: { initial: NotifySettings }) {
  const [thresholds, setThresholds] = React.useState<number[]>(initial.thresholds);
  const [types, setTypes] = React.useState<NotificationType[]>(initial.types);
  const [quietOn, setQuietOn] = React.useState(initial.quietStart !== null && initial.quietEnd !== null);
  const [quietStart, setQuietStart] = React.useState(initial.quietStart ?? 22);
  const [quietEnd, setQuietEnd] = React.useState(initial.quietEnd ?? 7);
  const [weekly, setWeekly] = React.useState(initial.weeklyReport);
  const [weeklyDay, setWeeklyDay] = React.useState(initial.weeklyDay);
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  async function save() {
    setPending(true);
    setSaved(false);
    await saveNotifySettings({
      thresholds,
      types,
      quietStart: quietOn ? quietStart : null,
      quietEnd: quietOn ? quietEnd : null,
      weeklyReport: weekly,
      weeklyDay,
      // 브라우저가 알려주는 시간대를 그대로 저장한다 (한국은 540)
      timezoneOffset: -new Date().getTimezoneOffset(),
    });
    setPending(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-1.5">
        <Label>마감 며칠 전에 알릴까요?</Label>
        <div className="flex flex-wrap gap-1.5">
          {THRESHOLD_CHOICES.map((day) => (
            <Chip
              key={day}
              on={thresholds.includes(day)}
              onClick={() => setThresholds((t) => toggle(t, day))}
            >
              {day === 0 ? "당일" : `D-${day}`}
            </Chip>
          ))}
        </div>
        {thresholds.length === 0 && (
          <p className="text-xs text-muted-foreground">하나도 고르지 않으면 마감 알림을 받지 않습니다.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>받을 알림 종류</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map((key) => (
            <Chip key={key} on={types.includes(key)} onClick={() => setTypes((t) => toggle(t, key))}>
              {NOTIFICATION_TYPES[key]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={quietOn}
            onChange={(e) => setQuietOn(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          조용한 시간에는 푸시를 보내지 않기
        </label>
        {quietOn && (
          <div className="flex items-center gap-2 pl-6 text-sm">
            <HourSelect id="quiet-start" value={quietStart} onChange={setQuietStart} label="조용한 시간 시작" />
            <span className="text-muted-foreground">부터</span>
            <HourSelect id="quiet-end" value={quietEnd} onChange={setQuietEnd} label="조용한 시간 끝" />
            <span className="text-muted-foreground">까지</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          이 시간에도 앱 안의 알림함에는 그대로 쌓입니다. 소리만 울리지 않습니다.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={weekly}
            onChange={(e) => setWeekly(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          주간 리포트 받기
        </label>
        {weekly && (
          <div className="flex items-center gap-2 pl-6 text-sm">
            <Label htmlFor="weekly-day" className="sr-only">
              주간 리포트 요일
            </Label>
            <Select
              id="weekly-day"
              value={String(weeklyDay)}
              onChange={(e) => setWeeklyDay(Number(e.target.value))}
              className="w-24"
            >
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}요일
                </option>
              ))}
            </Select>
            <span className="text-muted-foreground">에 이번 주 마감·지난 주 성과를 정리해 보냅니다</span>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={pending} size="sm">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "저장했습니다" : "알림 설정 저장"}
      </Button>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function HourSelect({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select id={id} value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="w-24">
        {Array.from({ length: 24 }, (_, hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}시
          </option>
        ))}
      </Select>
    </>
  );
}
