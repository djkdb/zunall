import "server-only";
import { and, eq } from "drizzle-orm";
import { db, documentBlobs } from "@/lib/db";
import { newId, getFileExtension } from "@/lib/utils";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@/lib/constants";

/**
 * 업로드 파일 스토리지 — 4가지 백엔드를 환경에 따라 자동 선택한다.
 *
 *   1. r2       : Cloudflare R2 바인딩(BUCKET)이 있으면 사용
 *   2. supabase : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 사용
 *   3. db       : (기본) PostgreSQL 에 바이너리로 저장 — 추가 서비스가 전혀 필요 없고
 *                 Node/Workers 어디서나 동일하게 동작한다
 *   4. local    : STORAGE_BACKEND=local 로 명시했을 때만. 로컬 파일시스템(Node 전용)
 *
 * STORAGE_BACKEND 환경변수로 강제 지정할 수 있다.
 * 저장 키는 항상 서버가 생성한 안전한 값만 사용한다 (path traversal 방지).
 */
export type StorageBackend = "r2" | "supabase" | "db" | "local";

interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

function r2Bucket(): R2BucketLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    return (env as { BUCKET?: R2BucketLike }).BUCKET ?? null;
  } catch {
    return null;
  }
}

interface SupabaseConfig {
  url: string;
  key: string;
  bucket: string;
}

function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/+$/, ""),
    key,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "zunall-uploads",
  };
}

/** 현재 사용 중인 스토리지 백엔드 (설정 페이지 표시용) */
export function storageBackend(): StorageBackend {
  const forced = process.env.STORAGE_BACKEND as StorageBackend | undefined;
  if (forced === "r2" || forced === "supabase" || forced === "db" || forced === "local") {
    return forced;
  }
  if (r2Bucket()) return "r2";
  if (supabaseConfig()) return "supabase";
  return "db";
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

// ─── 로컬 파일시스템 (Node 전용) ──────────────────────────────
// Workers 번들에 node:fs 가 포함되지 않도록 eval require 로 지연 로드한다.

/* eslint-disable @typescript-eslint/no-require-imports */
function nodeFs() {
  const req = eval("require") as NodeRequire;
  return {
    fs: req("node:fs") as typeof import("node:fs"),
    path: req("node:path") as typeof import("node:path"),
  };
}
/* eslint-enable @typescript-eslint/no-require-imports */

function uploadRoot(): string {
  const { path } = nodeFs();
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

/** 스토리지 상대 경로를 검증 후 절대 경로로 변환 (로컬 전용). 루트 밖이면 null. */
function resolveLocalPath(storagePath: string): string | null {
  const { path } = nodeFs();
  const root = path.resolve(uploadRoot());
  const abs = path.resolve(root, storagePath);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

// ─── 공개 API ────────────────────────────────────────────────

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
  const relPath = `${userId}/${key}`; // 모든 백엔드 공용 포맷 (forward slash)
  const buffer = Buffer.from(await file.arrayBuffer());
  const backend = storageBackend();

  if (backend === "r2") {
    const bucket = r2Bucket();
    if (!bucket) throw new Error("R2 바인딩 'BUCKET'을 찾을 수 없습니다.");
    await bucket.put(relPath, new Uint8Array(buffer));
  } else if (backend === "supabase") {
    const config = supabaseConfig()!;
    const response = await fetch(
      `${config.url}/storage/v1/object/${config.bucket}/${relPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: new Uint8Array(buffer),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Supabase Storage 업로드 실패 (${response.status}): ${detail.slice(0, 200)}`,
      );
    }
  } else if (backend === "db") {
    await db.insert(documentBlobs).values({
      key: relPath,
      userId,
      data: buffer,
      size: buffer.length,
      createdAt: Date.now(),
    });
  } else {
    const { fs, path } = nodeFs();
    const absPath = path.join(uploadRoot(), relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);
  }

  return { storagePath: relPath, size: buffer.length };
}

export async function readFileBuffer(storagePath: string): Promise<Buffer | null> {
  const backend = storageBackend();

  if (backend === "r2") {
    const bucket = r2Bucket();
    if (!bucket) return null;
    const object = await bucket.get(storagePath);
    if (!object) return null;
    return Buffer.from(await object.arrayBuffer());
  }

  if (backend === "supabase") {
    const config = supabaseConfig()!;
    const response = await fetch(
      `${config.url}/storage/v1/object/${config.bucket}/${storagePath}`,
      { headers: { Authorization: `Bearer ${config.key}` } },
    );
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  if (backend === "db") {
    const row = (
      await db
        .select({ data: documentBlobs.data })
        .from(documentBlobs)
        .where(eq(documentBlobs.key, storagePath))
        .limit(1)
    )[0];
    if (!row) return null;
    // 드라이버에 따라 Buffer 또는 Uint8Array 로 돌아온다
    return Buffer.from(row.data as unknown as Uint8Array);
  }

  const { fs } = nodeFs();
  const abs = resolveLocalPath(storagePath);
  if (!abs || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  const backend = storageBackend();

  if (backend === "r2") {
    try {
      await r2Bucket()?.delete(storagePath);
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
    return;
  }

  if (backend === "supabase") {
    const config = supabaseConfig()!;
    try {
      await fetch(`${config.url}/storage/v1/object/${config.bucket}/${storagePath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${config.key}` },
      });
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
    return;
  }

  if (backend === "db") {
    await db.delete(documentBlobs).where(eq(documentBlobs.key, storagePath));
    return;
  }

  const { fs } = nodeFs();
  const abs = resolveLocalPath(storagePath);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      // 이미 삭제된 경우 등은 무시
    }
  }
}

/** 사용자 소유 확인이 필요한 곳에서 쓰는 헬퍼 (DB 백엔드 전용) */
export async function blobExistsForUser(key: string, userId: string): Promise<boolean> {
  if (storageBackend() !== "db") return true;
  const row = (
    await db
      .select({ key: documentBlobs.key })
      .from(documentBlobs)
      .where(and(eq(documentBlobs.key, key), eq(documentBlobs.userId, userId)))
      .limit(1)
  )[0];
  return !!row;
}
