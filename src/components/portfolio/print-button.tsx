"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 브라우저 인쇄 대화상자를 열어 PDF 로 저장하게 한다 (별도 라이브러리 없이) */
export function PrintButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      인쇄 · PDF로 저장
    </Button>
  );
}
