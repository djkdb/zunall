import { and, eq, desc } from "drizzle-orm";
import { FileText, FileType2, FileSpreadsheet, FileImage, FileArchive, File as FileIcon } from "lucide-react";
import { db, documents, type ActivityRow, type DocumentRow } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadDialog } from "@/components/files/upload-dialog";
import { DocumentActions } from "@/components/files/document-actions";
import { formatBytes, formatDate, getFileExtension, toDateStr } from "@/lib/utils";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";
import { pdfExtractionEnabled } from "@/services/document/extract";

function FileTypeIcon({ name }: { name: string }) {
  const ext = getFileExtension(name);
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  if (ext === "pdf") return <FileText className={cls} />;
  if (["doc", "docx", "hwp", "hwpx", "txt", "md"].includes(ext)) return <FileType2 className={cls} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={cls} />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return <FileImage className={cls} />;
  if (["zip"].includes(ext)) return <FileArchive className={cls} />;
  return <FileIcon className={cls} />;
}

export async function DocumentsTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const pdfOk = pdfExtractionEnabled();
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.activityId, activity.id), eq(documents.userId, userId)))
    .orderBy(desc(documents.createdAt));

  // 그룹(=문서)별 최신 버전만 대표로 표시하고, 과거 버전은 함께 묶는다
  const groups = new Map<string, DocumentRow[]>();
  for (const doc of docs) {
    const list = groups.get(doc.groupId) ?? [];
    list.push(doc);
    groups.set(doc.groupId, list);
  }
  for (const list of groups.values()) list.sort((a, b) => b.version - a.version);

  const categories = Object.keys(DOC_CATEGORIES) as DocCategory[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          파일 {docs.length}개 · &lsquo;공고 / 안내&rsquo;에 올린 문서는 AI 공고 분석에 사용됩니다.
        </p>
        <UploadDialog activityId={activity.id} pdfSupported={pdfOk} />
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="업로드된 파일이 없습니다"
          description="모집공고 PDF, 안내문, 참고자료, 작업 파일을 업로드해 활동별로 정리하세요."
          action={<UploadDialog
              activityId={activity.id}
              triggerLabel="첫 파일 업로드"
              triggerVariant="outline"
              pdfSupported={pdfOk}
            />}
        />
      ) : (
        categories.map((category) => {
          const categoryGroups = Array.from(groups.values()).filter(
            (list) => list[0].category === category,
          );
          if (categoryGroups.length === 0) return null;
          return (
            <section key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {DOC_CATEGORIES[category]}
                </h3>
                <UploadDialog
                  activityId={activity.id}
                  defaultCategory={category}
                  pdfSupported={pdfOk}
                  triggerLabel="추가"
                  triggerVariant="ghost"
                />
              </div>
              <ul className="divide-y rounded-lg border bg-card">
                {categoryGroups.map((versions) => {
                  const latest = versions[0];
                  return (
                    <li key={latest.groupId} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileTypeIcon name={latest.originalName} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{latest.name}</p>
                            {versions.length > 1 && (
                              <Badge variant="secondary">v{latest.version}</Badge>
                            )}
                            {latest.extractedText && (
                              <Badge variant="outline" className="text-[10px]">
                                텍스트 추출됨
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {formatBytes(latest.size)} · {formatDate(toDateStr(new Date(latest.createdAt)))}
                            {latest.description ? ` · ${latest.description}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <UploadDialog
                            activityId={activity.id}
                            groupId={latest.groupId}
                            triggerVariant="ghost"
                            triggerLabel="새 버전"
                            pdfSupported={pdfOk}
                          />
                          <DocumentActions documentId={latest.id} />
                        </div>
                      </div>

                      {versions.length > 1 && (
                        <ul className="mt-2 space-y-1 border-l-2 border-border pl-4">
                          {versions.slice(1).map((v) => (
                            <li key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium">v{v.version}</span>
                              <span className="truncate">{v.originalName}</span>
                              <span>{formatBytes(v.size)}</span>
                              <span className="ml-auto">
                                <DocumentActions documentId={v.id} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
