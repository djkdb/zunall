# 배포 가이드 — Supabase + Cloudflare Workers

Zunall은 **PostgreSQL 단일 다이얼렉트**로 동작합니다.

| 레이어 | 로컬 개발 | 배포 (Supabase + Cloudflare) |
| --- | --- | --- |
| DB | PGlite (내장 Postgres, 설치 불필요) | **Supabase Postgres** (`DATABASE_URL`) |
| 파일 | `data/uploads` | **Supabase Storage** (`SUPABASE_URL` + service key) |
| 호스팅 | `npm run dev` | **Cloudflare Workers** (OpenNext) |
| AI | mock (휴리스틱) | Anthropic API (`ANTHROPIC_API_KEY`) |

전환은 **환경변수만으로** 이뤄집니다. 코드 수정이 필요 없습니다.

---

## 1단계 — Supabase 준비

### 1-1. 프로젝트 생성
[supabase.com](https://supabase.com) → New project. 생성 시 정한 **DB 비밀번호를 기억**하세요.

### 1-2. 테이블 만들기

로컬에서 스키마 파일을 생성합니다.

```bash
npx tsx scripts/export-schema.ts
```

생성된 `schema.sql` 전체를 복사해 **Supabase 대시보드 → SQL Editor** 에 붙여넣고 실행하세요.
`CREATE TABLE IF NOT EXISTS` 라서 여러 번 실행해도 안전하며, 24개 테이블이 만들어집니다.

### 1-3. 스토리지 버킷 만들기

**Storage → New bucket** → 이름 `zunall-uploads`, **Public 체크 해제**(비공개).
파일은 앱이 서버에서 인증을 확인한 뒤 내려주므로 공개일 필요가 없습니다.

### 1-4. 연결 정보 3개 복사

| 값 | 위치 |
| --- | --- |
| `DATABASE_URL` | Connect → **Transaction pooler** 문자열 (포트 **6543**), `[YOUR-PASSWORD]` 를 실제 비밀번호로 치환 |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role** 키 (⚠️ 비공개, 절대 커밋 금지) |

> **왜 Transaction pooler(6543)인가**: 서버리스 환경은 커넥션이 자주 생겼다 사라지므로
> 직접 연결(5432) 대신 풀러를 써야 합니다. 앱은 이미 `prepare: false` 로 맞춰져 있습니다.

### 1-5. 로컬에서 Supabase 연결 확인 (권장)

```bash
DATABASE_URL="위에서 복사한 문자열" npm run seed
```

`✅ 시드 완료` 가 나오면 DB 연결과 스키마가 정상입니다.

---

## 2단계 — Cloudflare 배포

> ⚠️ 명령은 **한 줄씩 그대로** 복사해 실행하세요 (주석까지 붙여넣으면 오류가 납니다).

```bash
npm install
```
저장소를 pull 받은 뒤 **먼저 실행** — 배포 도구가 설치됩니다.

```bash
npx wrangler login
```
브라우저가 열리며 Cloudflare 계정을 연결합니다.

```bash
npx wrangler secret put DATABASE_URL
```
실행하면 값 입력 프롬프트가 뜹니다. 1-4의 pooler 문자열을 붙여넣고 Enter.
"Worker가 없는데 만들까요?" 라고 물으면 `y`.

```bash
npx wrangler secret put SUPABASE_URL
```

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```
실제 Claude 평가를 쓸 때만 필요합니다. 생략하면 AI가 mock(휴리스틱)으로 동작합니다.

```bash
npm run deploy:cf
```
배포 전 설정을 자동 점검한 뒤(누락 시 무엇을 해야 하는지 알려줍니다) 빌드·배포합니다.
완료되면 `https://zunall.<서브도메인>.workers.dev` 주소가 출력됩니다.

점검만 따로 돌리려면 `npm run preflight:cf` 입니다.

---

## 자주 나는 오류

| 증상 | 원인 / 해결 |
| --- | --- |
| `Unknown arguments: #, ...` | 명령 뒤의 `# 주석`까지 붙여넣음 → 명령만 복사 |
| `opennextjs-cloudflare: command not found` | `npm install` 을 먼저 실행 |
| `relation "users" does not exist` | 1-2 단계(schema.sql)를 Supabase에 적용하지 않음 |
| `password authentication failed` | pooler 문자열의 `[YOUR-PASSWORD]` 를 실제 비밀번호로 바꾸지 않음 |
| 배포는 됐는데 DB 오류 | secret 미등록 → `npx wrangler secret list` 로 확인 |
| 파일 업로드 실패 | `zunall-uploads` 버킷이 없거나 service_role 키가 틀림 |

---

## 로컬 개발

```bash
npm install
npm run dev     # DATABASE_URL 없으면 PGlite 자동 사용 (설치 불필요)
npm run seed    # 데모 데이터 (demo@zunall.app / demo1234!)
```

실제 Postgres로 개발하려면 `DATABASE_URL` 만 지정하면 됩니다.
앱이 스키마를 자동 생성하게 하려면 `DB_AUTO_MIGRATE=1` 을 함께 설정하세요
(운영 DB에는 쓰지 말고 `schema.sql` 을 1회 적용하는 방식을 권장).

---

## 대안 — Docker / VM

Cloudflare 대신 Node가 그대로 도는 환경(Railway, Fly.io, VPS)에도 올릴 수 있습니다.
DB는 그대로 Supabase를 쓰면 됩니다.

```bash
docker build -t zunall .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SUPABASE_URL="https://<ref>.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e AI_PROVIDER=anthropic -e ANTHROPIC_API_KEY="sk-ant-..." \
  zunall
```

## 환경변수 요약

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | (없으면 PGlite) | PostgreSQL 접속 문자열 |
| `DB_AUTO_MIGRATE` | - | `1` 이면 부팅 시 스키마 자동 생성 (로컬/테스트용) |
| `SUPABASE_URL` | - | Supabase 프로젝트 URL (스토리지용) |
| `SUPABASE_SERVICE_ROLE_KEY` | - | 스토리지 접근 키 (비공개) |
| `SUPABASE_STORAGE_BUCKET` | `zunall-uploads` | 버킷 이름 |
| `AI_PROVIDER` | `mock` | `mock` / `claude`(CLI) / `anthropic`(API) |
| `ANTHROPIC_API_KEY` | - | `anthropic` provider 필수 |
| `MAX_FILE_SIZE` | 20MB | 업로드 제한 (bytes) |
| `SESSION_DAYS` | 30 | 세션 유지 기간 |

## 배포 전 체크리스트

```bash
npm run typecheck && npm run lint && npm run build
npm run test:score                                    # 점수 엔진 단위 테스트
node tests/e2e-career.mjs && node tests/e2e-smoke.mjs  # 서버 기동 후 E2E
```

- 세션 쿠키는 production에서 `secure` 플래그가 자동 활성화됩니다 (HTTPS 필요)
- `service_role` 키는 서버에서만 사용되며 클라이언트로 전달되지 않습니다
- Claude CLI provider 사용 시: 프롬프트는 stdin으로만 전달되어 shell injection이 차단됩니다
