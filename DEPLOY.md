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

## 경로 B — Cloudflare Workers ✅ 마이그레이션 완료

코드 전환이 끝났습니다: DB는 D1↔better-sqlite3 런타임 스위치, 스토리지는 R2↔로컬 디스크
자동 전환이며, 실제 workerd 런타임에서 회원가입→온보딩→R2 업로드→적합도 분석까지 검증됐습니다.
로컬 개발(`npm run dev`)은 이전과 완전히 동일하게 동작합니다.

### 배포 절차 (Cloudflare 계정 필요 — 5개 명령)

> ⚠️ 아래 명령은 한 줄씩 그대로 복사해서 실행하세요 (주석 없이 명령만).

```bash
npm install
```
0\. 저장소를 pull 받은 뒤 **반드시 먼저 실행** — 배포 도구(@opennextjs/cloudflare, wrangler)가 설치됩니다.

```bash
npx wrangler login
```
1\. 브라우저가 열리며 Cloudflare 계정을 연결합니다.

```bash
npx wrangler d1 create zunall
```
2\. 출력에 나오는 `database_id` 값(UUID)을 복사해 **`wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID` 자리에 붙여넣고 저장**합니다. 이걸 빼먹으면 배포가 실패합니다.

```bash
npx wrangler r2 bucket create zunall-uploads
```
3\. `You must purchase R2` 같은 오류가 나면, Cloudflare 대시보드 → **R2** 메뉴에서 R2를 한 번 활성화한 뒤(무료 티어 존재, 카드 등록이 요구될 수 있음) 다시 실행하세요.

```bash
npx wrangler d1 execute zunall --remote --file=schema.sql
```
4\. 24개 테이블 스키마를 D1에 적용합니다.

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```
5\. 실행하면 **값을 입력하라는 프롬프트가 뜹니다** — 그때 `sk-ant-...` 키를 붙여넣고 Enter. "Worker가 없는데 draft를 만들까요?"라고 물으면 `y`.

```bash
npm run deploy:cf
```
6\. 빌드 후 배포. 완료되면 `https://zunall.<서브도메인>.workers.dev` 주소가 출력됩니다.
   실행 전 설정을 자동 점검하며, 빠진 항목이 있으면 무엇을 해야 하는지 한국어로 알려줍니다
   (점검만 따로 돌리려면 `npm run preflight:cf`).

### 자주 나는 오류

| 증상 | 원인 / 해결 |
| --- | --- |
| `Unknown arguments: #, ...` | 명령 뒤의 `# 주석`까지 붙여넣음 → 명령만 복사해 실행 |
| `opennextjs-cloudflare: command not found` | `npm install` 을 먼저 실행 |
| `database_id ... REPLACE_WITH...` | 2번 단계에서 UUID를 wrangler.jsonc에 붙여넣지 않음 |
| `You must purchase R2` | 대시보드에서 R2 활성화 후 재시도 |
| 배포는 됐는데 500 에러 | D1 스키마 미적용 → 4번 단계(`d1 execute --remote`) 실행 |

### 로컬에서 Workers 런타임 그대로 테스트

```bash
npm run build:cf
npx wrangler d1 execute zunall --local --file=schema.sql
npx wrangler dev --port 8787 --var AI_PROVIDER:mock   # 로컬 D1/R2 시뮬레이션 포함
```

### 구조 (어떻게 전환되나)

| 레이어 | 로컬/Node | Cloudflare Workers |
| --- | --- | --- |
| DB | better-sqlite3 (부팅 시 DDL 자동) | D1 바인딩 `DB` (schema.sql 1회 적용) |
| 파일 | `data/uploads` | R2 바인딩 `BUCKET` |
| AI | mock / claude CLI / anthropic | anthropic (CLI 불가) |
| 감지 | `navigator.userAgent === "Cloudflare-Workers"` 런타임 스위치 (src/lib/db, src/lib/storage) |

### 알려진 주의점

- 스키마 변경 시: `npx tsx scripts/export-schema.ts` 재실행 후 새 테이블만 D1에 적용
  (DDL은 CREATE TABLE IF NOT EXISTS라 전체 재실행해도 안전)
- PDF 텍스트 추출(pdf-parse)은 Workers에서 미검증 — TXT/DOCX/PPTX는 동작 확인됨.
  PDF 업로드 자체는 항상 동작하며, 추출 실패 시 앱은 정상 진행됩니다(실패 내성 설계)
- Workers 요청당 CPU 시간 제한이 있어 매우 큰 문서 분석은 Docker 경로가 유리할 수 있음

## 배포 전 체크리스트 (공통)

```bash
npm run typecheck && npm run lint && npm run build   # 정적 검증
npm run test:score                                    # 점수 엔진 단위 테스트
node tests/e2e-smoke.mjs                              # E2E (서버 기동 후)
```

- `data/`는 gitignore 대상 — 운영 데이터는 볼륨/백업으로 관리
- 세션 쿠키는 production에서 `secure` 플래그가 자동 활성화됨 (HTTPS 필요)
- Claude CLI provider 사용 시: 프롬프트는 stdin으로만 전달되어 shell injection이 차단됨
