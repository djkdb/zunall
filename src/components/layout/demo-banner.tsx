import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * 둘러보기 계정임을 알려주는 띠.
 * 예시 자료라는 점과, 내 계정으로 옮기는 방법을 함께 보여준다.
 */
export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-primary/10 px-4 py-2 text-xs md:px-8">
      <span className="flex items-center gap-1.5 font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        둘러보기 중입니다
      </span>
      <span className="text-muted-foreground">
        예시 자료가 채워진 임시 계정입니다. 마음껏 눌러보세요. 3일 뒤 자동으로 지워집니다.
      </span>
      <Link href="/signup" className="ml-auto font-medium text-primary hover:underline">
        내 계정 만들기 →
      </Link>
    </div>
  );
}
