import Link from "next/link";
import { CaveroMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <CaveroMark className="h-10 w-10 text-[#0F2338] dark:text-foreground" />
      <div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">찾는 화면이 없습니다</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          주소가 바뀌었거나, 지워진 자료이거나, 다른 계정의 자료일 수 있습니다.
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants()}>
          처음 화면으로
        </Link>
        <Link href="/guide" className={buttonVariants({ variant: "outline" })}>
          사용 가이드
        </Link>
      </div>
    </main>
  );
}
