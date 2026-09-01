import "server-only";
import { newId, getFileExtension } from "@/lib/utils";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@/lib/constants";

/**
 * 이중 스토리지 레이어:
 * - Supabase Storage: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 사용 (프로덕션/Workers)
 * - 로컬 파일시스템: 없으면 data/uploads 로 폴백 (설치 없이 로컬 개발)
 *
 * 저장 키는 항상 서버가 생성한 안전한 값만 사용한다 (path traversal 방지).
 * Supabase 경로는 REST(fetch)만 쓰므로 Workers 런타임에서도 그대로 동작한다.
 */

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

/** Supabase Storage 사용 여부 (설정 페이지 표시용) */
export function storageBackend(): "supabase" | "local" {
  return supabaseConfig() ? "supabase" : "local";
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
  const relPath = `${userId}/${key}`; // 로컬/Supabase 공용 포맷 (forward slash)
  const buffer = Buffer.from(await file.arrayBuffer());

  const config = supabaseConfig();
  if (config) {
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
  } else {
    const { fs, path } = nodeFs();
    const absPath = path.join(uploadRoot(), relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);
  }

  return { storagePath: relPath, size: buffer.length };
}

export async function readFileBuffer(storagePath: string): Promise<Buffer | null> {
  const config = supabaseConfig();
  if (config) {
    const response = await fetch(
      `${config.url}/storage/v1/object/${config.bucket}/${storagePath}`,
      { headers: { Authorization: `Bearer ${config.key}` } },
    );
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  const { fs } = nodeFs();
  const abs = resolveLocalPath(storagePath);
  if (!abs || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  const config = supabaseConfig();
  if (config) {
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
