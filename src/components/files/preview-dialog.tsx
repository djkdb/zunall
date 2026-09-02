"use client";

import * as React from "react";
import { Eye, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getFileExtension } from "@/lib/utils";

/**
 * 첨부 미리보기.
 * 이미지·PDF·텍스트는 내려받지 않고 그 자리에서 확인한다.
 * 그 외 형식은 미리보기 대신 내려받기를 안내한다.
 */
export function PreviewDialog({
  documentId,
  name,
  mime,
}: {
  documentId: string;
  name: string;
  mime: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const ext = getFileExtension(name);
  const url = `/api/files/${documentId}`;
  const kind = mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
    ? "image"
    : mime === "application/pdf" || ext === "pdf"
      ? "pdf"
      : ["txt", "md", "csv", "json"].includes(ext) || mime.startsWith("text/")
        ? "text"
        : "other";

  React.useEffect(() => {
    if (!open || kind !== "text" || text !== null) return;
    setLoading(true);
    fetch(url)
      .then((res) => res.text())
      .then((body) => setText(body.slice(0, 20000)))
      .catch(() => setText("파일을 읽지 못했습니다."))
      .finally(() => setLoading(false));
  }, [open, kind, text, url]);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="미리보기" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={name} className="max-w-3xl">
        <div className="space-y-3">
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="max-h-[70vh] w-full rounded-md object-contain" />
          )}

          {kind === "pdf" && (
            <iframe
              src={url}
              title={name}
              className="h-[70vh] w-full rounded-md border"
            />
          )}

          {kind === "text" && (
            <div className="max-h-[70vh] overflow-auto rounded-md border bg-secondary/40 p-3">
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">{text}</pre>
              )}
            </div>
          )}

          {kind === "other" && (
            <p className="rounded-md bg-secondary px-3 py-4 text-center text-sm text-muted-foreground">
              이 형식({ext.toUpperCase() || mime})은 브라우저에서 바로 볼 수 없습니다. 내려받아
              확인해주세요.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <a href={url} download={name}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                내려받기
              </Button>
            </a>
            <Button size="sm" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
