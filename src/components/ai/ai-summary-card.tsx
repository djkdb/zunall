import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AnnouncementSummary } from "@/services/ai/schemas";

/** 활동에 적용된 AI 공고 분석 요약 카드 */
export function AISummaryCard({ summary }: { summary: AnnouncementSummary }) {
  return (
    <Card className="border-primary/30 bg-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" /> AI Summary
        </CardTitle>
        {summary.summary && (
          <p className="text-xs text-muted-foreground">{summary.summary}</p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {summary.schedule.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">핵심 일정</h4>
            <ul className="space-y-1 text-sm">
              {summary.schedule.map((s, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{s.label}</span>
                  <span className="font-medium">{s.date ? formatDate(s.date) : "-"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.requirements.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">필수 제출물</h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {summary.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.criteria.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">주요 평가 기준</h4>
            <ul className="space-y-1 text-sm">
              {summary.criteria.map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{c.name}</span>
                  <Badge variant="secondary">{c.weight}%</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.cautions.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">주의사항</h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {summary.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
