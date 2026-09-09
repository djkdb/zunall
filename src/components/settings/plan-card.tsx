import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_FEATURES, PLAN_NOTE } from "@/lib/plans";

/** 지금 쓰는 요금제와 앞으로의 계획 */
export function PlanCard({ aiDailyLimit }: { aiDailyLimit: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>요금제</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            무료 이용 중
          </span>
          <span className="text-muted-foreground">
            {aiDailyLimit > 0
              ? `AI 분석은 하루 ${aiDailyLimit}회까지 쓸 수 있습니다.`
              : "지금은 AI 분석 횟수 제한 없이 쓸 수 있습니다."}
          </span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-3 font-medium text-muted-foreground">기능</th>
                <th className="py-1.5 pr-3 font-medium">무료</th>
                <th className="py-1.5 font-medium text-muted-foreground">Pro (예정)</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.label}</td>
                  <td className="py-1.5 pr-3">{row.free}</td>
                  <td className="py-1.5 text-muted-foreground">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{PLAN_NOTE}</p>
      </CardContent>
    </Card>
  );
}
