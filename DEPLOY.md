# 배포 가이드

Zunall(AI Career OS)은 **Node 서버 + SQLite + 로컬 파일 스토리지** 구성입니다.
배포 난이도 순서로 두 가지 경로를 안내합니다.

---

## 경로 A — 바로 배포 (Docker / VM) ✅ 권장 시작점

Node가 그대로 도는 환경(Railway, Fly.io, Render, 개인 VPS 등)에서는 코드 수정 없이 배포됩니다.

### Docker

```bash
docker build -t zunall .
docker run -d -p 3000:3000 \
  -v zunall-data:/app/data \
  -e AI_PROVIDER=anthropic \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  zunall
```

- `-v zunall-data:/app/data` — SQLite DB와 업로드 파일이 저장되는 볼륨. **반드시 마운트**해야 재배포 시 데이터가 유지됩니다.
- AI는 `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`로 실제 Claude를 사용합니다.
  키가 없으면 `AI_PROVIDER=mock`(기본값)으로도 전체 기능이 동작합니다.

### VM / VPS 직접 실행

```bash
npm ci && npm run build
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run start
```

리버스 프록시(nginx/Caddy)로 HTTPS를 붙이고, `data/` 디렉터리를 백업 대상에 포함하세요.

### 환경변수 요약

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` | `mock` / `claude`(CLI) / `anthropic`(API) |
| `ANTHROPIC_API_KEY` | - | `anthropic` provider 필수 |
| `ANTHROPIC_MODEL` | `claude-opus-5` | 사용할 Claude 모델 |
| `DATABASE_PATH` | `./data/zunall.db` | SQLite 파일 경로 |
| `UPLOAD_DIR` | `./data/uploads` | 업로드 저장 경로 |
| `MAX_FILE_SIZE` | 20MB | 업로드 제한 (bytes) |
| `SESSION_DAYS` | 30 | 세션 유지 기간 |

---

## 경로 B — Cloudflare Workers 마이그레이션 체크리스트

Cloudflare에 정착하려면 네이티브 모듈/로컬 디스크를 Cloudflare 서비스로 교체해야 합니다.
아키텍처가 레이어로 분리되어 있어 교체 지점은 3곳입니다.

### 1. Next.js 어댑터

```bash
npm i -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx wrangler deploy
```

### 2. DB: better-sqlite3 → D1

- Drizzle 드라이버 교체: `drizzle-orm/better-sqlite3` → `drizzle-orm/d1`
  (`src/lib/db/index.ts`만 수정 — 스키마·쿼리는 D1이 SQLite 호환이라 유지)
- 스키마 적용: `src/lib/db/ddl.ts`의 DDL을 파일로 내보내
  `npx wrangler d1 create zunall && npx wrangler d1 execute zunall --file=schema.sql`
- **주의**: D1은 비동기 API입니다. 코드 전반의 `.get()/.all()/.run()` 동기 호출 앞에
  `await`를 붙이는 일괄 수정이 필요합니다(기계적 변경, 로직 변화 없음).

### 3. 파일 스토리지: 로컬 디스크 → R2

- `src/lib/storage.ts` 하나만 교체하면 됩니다 (이미 서비스 레이어로 추상화됨).
- `saveFile` → `env.BUCKET.put(key, buffer)`, `readFileBuffer` → `env.BUCKET.get(key)`,
  `deleteStoredFile` → `env.BUCKET.delete(key)`

### 4. AI: CLI → Anthropic API

- 이미 준비되어 있습니다. `AI_PROVIDER=anthropic`으로 설정하고
  `wrangler secret put ANTHROPIC_API_KEY`로 키를 등록하면 끝입니다.
  (Workers에서는 CLI 실행이 불가능하므로 `claude` provider는 사용할 수 없습니다.)

### wrangler.toml 예시

```toml
name = "zunall"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "zunall"
database_id = "<wrangler d1 create 결과>"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "zunall-uploads"

[vars]
AI_PROVIDER = "anthropic"
```

### 실제 배포에 필요한 것 (사용자 작업)

1. Cloudflare 계정 + `npx wrangler login`
2. `wrangler d1 create` / `r2 bucket create` 실행 후 ID를 wrangler.toml에 반영
3. `wrangler secret put ANTHROPIC_API_KEY`

---

## 배포 전 체크리스트 (공통)

```bash
npm run typecheck && npm run lint && npm run build   # 정적 검증
npm run test:score                                    # 점수 엔진 단위 테스트
node tests/e2e-smoke.mjs                              # E2E (서버 기동 후)
```

- `data/`는 gitignore 대상 — 운영 데이터는 볼륨/백업으로 관리
- 세션 쿠키는 production에서 `secure` 플래그가 자동 활성화됨 (HTTPS 필요)
- Claude CLI provider 사용 시: 프롬프트는 stdin으로만 전달되어 shell injection이 차단됨
