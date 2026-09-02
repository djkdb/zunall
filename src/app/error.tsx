"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 화면 단위 오류 화면.
 * 기본 "Application error" 만 뜨면 사용자가 할 수 있는 게 없으므로,
 * 무엇을 확인하면 되는지(진단 페이지)와 다시 시도 버튼을 준다.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
      <h1 className="text-lg font-bold">화면을 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        일시적인 오류일 수 있습니다. 다시 시도해도 같은 화면이 나오면 아래 상태 확인을 눌러
        무엇이 문제인지 확인해주세요.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">오류 번호: {error.digest}</p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </Button>
        <a href="/api/health" target="_blank" rel="noreferrer">
          <Button variant="outline">
            <Stethoscope className="h-4 w-4" /> 상태 확인
          </Button>
        </a>
        <Link href="/">
          <Button variant="ghost">대시보드로</Button>
        </Link>
      </div>
    </div>
  );
}
