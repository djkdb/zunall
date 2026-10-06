/**
 * zunterview(가상 면접) → Cavero 동기화.
 *
 * zunterview 저장소에서 면접 로직·프롬프트·규칙 기반 면접관·질문 은행·면접관 사진을 그대로 가져와
 * Cavero 의 경로에 맞게 import 만 바꿔 쓴다. zunterview 에서 고도화한 내용을 Cavero 에 반영할 때 실행한다.
 *
 *   npx tsx scripts/sync-zunterview.ts [zunterview 경로]     (기본: ZUNTERVIEW_DIR 또는 ../zunterview)
 *   npx tsx scripts/sync-zunterview.ts --check               (무엇이 바뀌는지만 보기)
 *
 * 원칙: 아래 DIRS·FILES·ASSET 목록의 파일은 zunterview 소유다. Cavero 에서 직접 고치지 말고
 * zunterview 에서 고친 뒤 이 스크립트로 가져온다. Cavero 쪽 차이(DB 저장, AI 연결, 인사 처리 등)는
 * engine.ts · ai-interviewer.ts · server-data.ts · catalog.ts · view.ts 에만 둔다.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const check = args.includes("--check");
const source = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.env.ZUNTERVIEW_DIR ?? path.join(process.cwd(), "..", "zunterview"));
const ROOT = process.cwd();
const MI = "src/services/mock-interview";

if (!fs.existsSync(path.join(source, "shared", "schemas.ts"))) {
  console.error(`zunterview 저장소를 찾지 못했습니다: ${source}\n경로를 인자로 주거나 ZUNTERVIEW_DIR 를 설정하세요.`);
  process.exit(1);
}

/** import 경로 바꾸기: zunterview 의 폴더 구조 → Cavero 의 폴더 구조 */
type Rewrite = [RegExp, string];
const toShared = (depth: string): Rewrite => [new RegExp(`"${depth.replace(/\./g, "\\.")}shared/`, "g"), '"../shared/'];

interface FileMap {
  from: string;
  to: string;
  rewrites?: Rewrite[];
}
interface DirMap {
  /** 원본 폴더 (이 폴더의 .ts 전부, *.test.ts 제외) */
  fromDir: string;
  toDir: string;
  rewrites?: Rewrite[];
  /** 원본에 없어진 파일은 지운다 (폴더 전체가 zunterview 소유일 때만) */
  prune?: boolean;
}

const DIRS: DirMap[] = [
  { fromDir: "shared", toDir: `${MI}/shared`, prune: true },
  { fromDir: "shared/data", toDir: `${MI}/shared/data`, prune: true },
  { fromDir: "server/prompts", toDir: `${MI}/prompts`, rewrites: [toShared("../../")], prune: true },
  {
    fromDir: "src/services/ai/mock",
    toDir: `${MI}/mock`,
    rewrites: [toShared("../../../../")],
  },
];

const FILES: FileMap[] = [
  {
    from: "src/services/ai/MockAIProvider.ts",
    to: `${MI}/mock/MockAIProvider.ts`,
    rewrites: [
      toShared("../../../"),
      [/"\.\.\/\.\.\/config\/labelsKo"/g, '"../labels-ko"'],
      [/"\.\.\/\.\.\/utils\//g, '"../utils/'],
      [/"\.\/AIProvider"/g, '"../provider-types"'],
      [/"\.\/mock\//g, '"./'],
    ],
  },
  { from: "src/services/ai/AIProvider.ts", to: `${MI}/provider-types.ts`, rewrites: [[/"\.\.\/\.\.\/\.\.\/shared\//g, '"./shared/'], [/"\.\.\/\.\.\/types\/interview"/g, '"./types"']] },
  ...["context", "policy", "scoring", "fingerprint", "conduct", "clarify", "id"].map((n) => ({
    from: `src/utils/${n}.ts`,
    to: `${MI}/utils/${n}.ts`,
    rewrites: [toShared("../../"), [/"\.\.\/types\/interview"/g, '"../types"'] as Rewrite],
  })),
  { from: "src/types/interview.ts", to: `${MI}/types.ts`, rewrites: [[/"\.\.\/\.\.\/shared\//g, '"./shared/']] },
  { from: "src/config/labelsKo.ts", to: `${MI}/labels-ko.ts`, rewrites: [[/"\.\.\/\.\.\/shared\//g, '"./shared/']] },
  { from: "src/config/panel.ts", to: `${MI}/panel.ts`, rewrites: [[/"\.\.\/\.\.\/shared\//g, '"./shared/']] },
  { from: "src/config/panelPhotos.ts", to: `${MI}/panel-photos.ts` },
  { from: "src/services/speech/speechSynthesis.ts", to: "src/lib/speech/synthesis.ts" },
  { from: "src/services/speech/speechRecognition.ts", to: "src/lib/speech/recognition.ts" },
];

/** 정적 파일 (질문 은행 JSON, 면접관 사진) — 그대로 복사 */
const ASSET_DIRS: Array<{ from: string; to: string }> = [
  { from: "public/data/roles", to: "public/interview-data/roles" },
  { from: "public/data/companies", to: "public/interview-data/companies" },
  { from: "public/panel/left", to: "public/panel/left" },
  { from: "public/panel/center", to: "public/panel/center" },
  { from: "public/panel/right", to: "public/panel/right" },
];
const ASSET_FILES = [{ from: "public/panel/room.webp", to: "public/panel/room.webp" }];

const changes: string[] = [];

function write(to: string, content: Buffer | string) {
  const abs = path.join(ROOT, to);
  const before = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
  const next = typeof content === "string" ? Buffer.from(content) : content;
  if (before && before.equals(next)) return;
  changes.push(`${before ? "수정" : "추가"} ${to}`);
  if (check) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next);
}

function remove(to: string) {
  changes.push(`삭제 ${to}`);
  if (!check) fs.rmSync(path.join(ROOT, to));
}

function copyTs(from: string, to: string, rewrites: Rewrite[] = []) {
  let text = fs.readFileSync(path.join(source, from), "utf8");
  for (const [re, rep] of rewrites) text = text.replace(re, rep);
  write(to, text);
}

const isSource = (f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts");

for (const d of DIRS) {
  const files = fs.readdirSync(path.join(source, d.fromDir)).filter(isSource);
  for (const f of files) copyTs(`${d.fromDir}/${f}`, `${d.toDir}/${f}`, d.rewrites);
  if (d.prune && fs.existsSync(path.join(ROOT, d.toDir))) {
    for (const f of fs.readdirSync(path.join(ROOT, d.toDir)).filter(isSource)) {
      if (!files.includes(f)) remove(`${d.toDir}/${f}`);
    }
  }
}
for (const f of FILES) copyTs(f.from, f.to, f.rewrites);
for (const d of ASSET_DIRS) {
  const files = fs.readdirSync(path.join(source, d.from));
  for (const f of files) write(`${d.to}/${f}`, fs.readFileSync(path.join(source, d.from, f)));
  for (const f of fs.existsSync(path.join(ROOT, d.to)) ? fs.readdirSync(path.join(ROOT, d.to)) : []) {
    if (!files.includes(f)) remove(`${d.to}/${f}`);
  }
}
for (const f of ASSET_FILES) write(f.to, fs.readFileSync(path.join(source, f.from)));

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", source, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  // git 저장소가 아니면 커밋을 모른다
}

// 어느 커밋을 가져왔는지 남긴다 (다음 동기화 때 무엇이 바뀌었는지 zunterview 에서 git log 로 볼 수 있게)
if (!check) fs.writeFileSync(path.join(ROOT, MI, "UPSTREAM"), `zunterview ${commit}\n`);
if (!changes.length) {
  console.log(`이미 최신입니다 (zunterview ${commit}).`);
  process.exit(0);
}
console.log(changes.join("\n"));
if (check) {
  console.log(`\n${changes.length}개 파일이 바뀝니다 (--check: 아무것도 쓰지 않았습니다).`);
  process.exit(0);
}
console.log(`\nzunterview ${commit} 을 가져왔습니다 (${changes.length}개 파일).
다음 순서로 확인하세요:
  1. npx tsc --noEmit          — zunterview 에 새 파일이 생겨 import 가 깨졌으면 FILES 목록에 추가
  2. npx tsx tests/mock-interview.test.ts
  3. 앱을 띄워 node tests/e2e-mock-interview.mjs`);
