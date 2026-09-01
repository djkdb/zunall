import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newId, getFileExtension } from "@/lib/utils";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@/lib/constants";

/**
 * 이중 스토리지 레이어:
 * - 로컬/Node 배포: 파일시스템 (data/uploads)
 * - Cloudflare Workers: R2 버킷 (바인딩 이름 BUCKET)
 * 저장 키는 항상 서버가 생성한 안전한 값만 사용한다 (path traversal 방지).
 */

interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Buffer): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

function isCloudflareWorkers(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}

function r2Bucket(): R2BucketLike {
  const { env } = getCloudflareContext();
  const bucket = (env as { BUCKET?: R2BucketLike }).BUCKET;
  if (!bucket) {
    throw new Error("R2 바인딩 'BUCKET'을 찾을 수 없습니다. wrangler 설정의 r2_buckets를 확인하세요.");
  }
  return bucket;
}

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
 * 파일 저장. 사용자가 제공한 파일명은 메타데이터로만 보관하고
 * 저장 키는 서버가 생성한다. 반환: 스토리지 상대 키.
 */
export async function saveFile(
  userId: string,
  file: File,
): Promise<{ storagePath: string; size: number }> {
  const ext = getFileExtension(file.name);
  const key = `${newId()}${ext ? "." + ext : ""}`;
  // R2 키/로컬 경로 공용 포맷 (항상 forward slash)
  const relPath = `${userId}/${key}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isCloudflareWorkers()) {
    await r2Bucket().put(relPath, buffer);
  } else {
    const absPath = path.join(uploadRoot(), relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);
  }
  return { storagePath: relPath, size: buffer.length };
}

/** 스토리지 상대 경로를 검증 후 절대 경로로 변환 (로컬 전용). 루트 밖이면 null. */
function resolveLocalPath(storagePath: string): string | null {
  const root = path.resolve(uploadRoot());
  const abs = path.resolve(root, storagePath);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

export async function readFileBuffer(storagePath: string): Promise<Buffer | null> {
  if (isCloudflareWorkers()) {
    const object = await r2Bucket().get(storagePath);
    if (!object) return null;
    return Buffer.from(await object.arrayBuffer());
  }
  const abs = resolveLocalPath(storagePath);
  if (!abs || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  if (isCloudflareWorkers()) {
    try {
      await r2Bucket().delete(storagePath);
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
    return;
  }
  const abs = resolveLocalPath(storagePath);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
  }
}
