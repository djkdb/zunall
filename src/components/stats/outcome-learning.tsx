import { TrendingUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OutcomeBucket, OutcomeLearning } from "@/services/score/outcome";

/** 내가 실제로 지원하고 기록한 결과만으로 만든 통계 (예측이 아니라 사실) */
export function OutcomeLearningCard({ learning }: { learning: OutcomeLearning }) {
  if (learning.totalApplied === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>지원 결과 학습</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          아직 지원한 활동이 없습니다. 지원 후 결과(수상·탈락)를 기록하면, 어떤 조건에서 결과가
          좋았는지 알려드립니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          지원 결과 학습
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          지원 {learning.totalApplied}건 중 결과가 나온 {learning.decided}건을 기준으로 계산했습니다.
          {learning.overallWinRate !== null && ` 전체 합격률 ${learning.overallWinRate}%.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {learning.notice && (
          <p className="flex items-start gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {learning.notice}
          </p>
        )}

        {learning.insights.length > 0 && (
          <ul className="space-y-1.5">
            {learning.insights.map((insight, i) => (
              <li key={i} className="rounded-md bg-accent/60 px-3 py-2 text-sm">
                {insight}
              </li>
            ))}
          </ul>
        )}

        <BucketTable title="적합도 구간별" buckets={learning.byFit} />
        {learning.byRecommendation.length > 0 && (
          <BucketTable title="AI 판정별" buckets={learning.byRecommendation} />
        )}
        <BucketTable title="활동 유형별" buckets={learning.byType} />
      </CardContent>
    </Card>
  );
}

function BucketTable({ title, buckets }: { title: string; buckets: OutcomeBucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-1.5 text-left font-medium">구간</th>
              <th className="py-1.5 text-right font-medium">지원</th>
              <th className="py-1.5 text-right font-medium">수상</th>
              <th className="py-1.5 text-right font-medium">탈락</th>
              <th className="py-1.5 text-right font-medium">대기</th>
              <th className="py-1.5 text-right font-medium">합격률</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.label} className="border-b border-border/50 last:border-0">
                <td className="py-1.5">{bucket.label}</td>
                <td className="py-1.5 text-right">{bucket.applied}</td>
                <td className="py-1.5 text-right">{bucket.won}</td>
                <td className="py-1.5 text-right">{bucket.lost}</td>
                <td className="py-1.5 text-right text-muted-foreground">{bucket.pending}</td>
                <td className="py-1.5 text-right">
                  {bucket.winRate === null ? (
                    <span className="text-muted-foreground">-</span>
                  ) : bucket.enough ? (
                    <span className="font-semibold">{bucket.winRate}%</span>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {bucket.winRate}% · 표본 부족
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
