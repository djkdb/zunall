import "server-only";
import fs from "node:fs";
import path from "node:path";
import { newId, getFileExtension } from "@/lib/utils";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@/lib/constants";

// 로컬 파일시스템 스토리지. Supabase Storage 등으로 전환 시 이 모듈만 교체하면 된다.

function uploadRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

export function maxFileSize(): number {
  const n = Number(process.env.MAX_FILE_SIZE);
  return Number.isFinite(n) && n > 0 ? n : 20 * 1024 * 1024;
}

export function validateUpload(file: File): string | null {
  if (file.size === 0) return "빈 파일은 업로드할 수 없습니다.";
  if (file.size > maxFileSize()) {
    return `파일 크기가 제한(${Math.round(maxFileSize() / 1024 / 1024)}MB)을 초과했습니다.`;
  }
  const ext = getFileExtension(file.name);
  if (!ext || !(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return `허용되지 않는 파일 형식입니다. (${ext || "확장자 없음"})`;
  }
  return null;
}

/**
 * 파일 저장. 저장 경로는 서버가 생성한 안전한 키만 사용하고
 * 사용자가 제공한 파일명은 메타데이터로만 보관한다 (path traversal 방지).
 * 반환값: 스토리지 상대 경로
 */
export async function saveFile(userId: string, file: File): Promise<{ storagePath: string; size: number }> {
  const ext = getFileExtension(file.name);
  const key = `${newId()}${ext ? "." + ext : ""}`;
  const relPath = path.join(userId, key);
  const absPath = path.join(uploadRoot(), relPath);

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(absPath, buffer);
  return { storagePath: relPath, size: buffer.length };
}

/** 스토리지 상대 경로를 검증 후 절대 경로로 변환. 루트 밖이면 null. */
export function resolveStoragePath(storagePath: string): string | null {
  const root = path.resolve(uploadRoot());
  const abs = path.resolve(root, storagePath);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

export function readFileBuffer(storagePath: string): Buffer | null {
  const abs = resolveStoragePath(storagePath);
  if (!abs || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function deleteStoredFile(storagePath: string): void {
  const abs = resolveStoragePath(storagePath);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
  }
}
