# 배포 가이드 — 무료로 올리기

Zunall은 **PostgreSQL 하나만 있으면** 전부 동작합니다.
파일도 기본적으로 DB에 저장되므로 오브젝트 스토리지(S3/R2/Supabase Storage)가 **필요 없습니다**.

| 레이어 | 로컬 개발 | 배포 |
| --- | --- | --- |
| DB | PGlite (내장, 설치 불필요) | **무료 Postgres 아무거나** (`DATABASE_URL`) |
| 파일 | DB에 저장 | **DB에 저장** (기본) — 원하면 R2/Supabase로 전환 |
| 호스팅 | `npm run dev` | **Cloudflare Workers** 또는 Docker/VM |
| AI | mock (휴리스틱) | Anthropic API (`ANTHROPIC_API_KEY`, 선택) |

전환은 **환경변수만으로** 이뤄집니다. 코드 수정이 필요 없습니다.

---

## 1단계 — 무료 Postgres 고르기

Supabase 무료 한도를 다 썼다면 아래 대안 중 하나를 쓰면 됩니다. **코드는 그대로**이고 `DATABASE_URL`만 바뀝니다.

| 서비스 | 무료 한도 | 카드 필요 | 비고 |
| --- | --- | --- | --- |
| **Neon** ⭐ 권장 | 0.5GB 저장 | ❌ 불필요 | Workers 전용 HTTP 드라이버 자동 사용 |
| Supabase | 프로젝트 2개 | ❌ | 기존 프로젝트를 지우면 새로 만들 수 있음 |
| Prisma Postgres | 1GB | ❌ | |
| Railway / Render | 시험용 크레딧 | 일부 필요 | |
| 직접 운영 (Docker) | 무제한 | ❌ | VPS가 있다면 |

> **Neon을 권장하는 이유**: 카드 없이 가입되고, Cloudflare Workers에서 TCP 대신
> **순수 HTTP(fetch)로 통신하는 전용 드라이버**를 자동으로 사용하도록 코드에 넣어뒀습니다.
> 서버리스 환경에서 가장 안정적인 조합입니다.

### 1-1. 프로젝트 만들고 연결 문자열 복사

[neon.tech](https://neon.tech) → 가입 → 프로젝트 생성 → **Connection string** 복사
(`postgresql://<user>:<password>@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require`)

### 1-2. 테이블 만들기

```bash
npx tsx scripts/export-schema.ts
```

생성된 `schema.sql` 전체를 복사해 **Neon 콘솔의 SQL Editor**(또는 쓰는 서비스의 SQL 콘솔)에
붙여넣고 실행하세요. `CREATE TABLE IF NOT EXISTS` 라서 여러 번 실행해도 안전하며, 25개 테이블이 만들어집니다.

### 1-3. 연결 확인 (권장)

```bash
DATABASE_URL="복사한 연결 문자열" npm run seed
```

`✅ 시드 완료` 가 나오면 DB 연결과 스키마가 정상입니다.

---

## 2단계 — Cloudflare Workers 배포

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
실행하면 값 입력 프롬프트가 뜹니다. 1-1의 연결 문자열을 붙여넣고 Enter.
"Worker가 없는데 만들까요?" 라고 물으면 `y`.

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

**필요한 secret은 `DATABASE_URL` 하나뿐입니다.**

---

## 파일 저장 위치 바꾸기 (선택)

기본값은 **DB 저장**이라 아무 설정도 필요 없습니다. 파일이 많아지면 아래로 전환하세요.

| 백엔드 | 켜는 법 |
| --- | --- |
| **db** (기본) | 설정 불필요. `document_blobs` 테이블에 저장 |
| **r2** | `wrangler.jsonc` 의 `r2_buckets` 주석 해제 + `npx wrangler r2 bucket create zunall-uploads` |
| **supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secret 등록 |
| **local** | `STORAGE_BACKEND=local` (Node 환경 전용, `data/uploads` 에 저장) |

우선순위는 `r2` → `supabase` → `db` 이며 `STORAGE_BACKEND` 로 강제할 수 있습니다.
DB 저장은 20MB 제한 기준 개인 사용에 충분하지만, Neon 무료 0.5GB를 파일이 잠식하므로
대용량을 다룬다면 R2 전환을 권장합니다.

---

## 자주 나는 오류

| 증상 | 원인 / 해결 |
| --- | --- |
| `Unknown arguments: #, ...` | 명령 뒤의 `# 주석`까지 붙여넣음 → 명령만 복사 |
| `opennextjs-cloudflare: command not found` | `npm install` 을 먼저 실행 |
| `relation "users" does not exist` | 1-2 단계(schema.sql)를 DB에 적용하지 않음 |
| `password authentication failed` | 연결 문자열의 비밀번호 자리를 실제 값으로 바꾸지 않음 |
| 배포는 됐는데 DB 오류 | secret 미등록 → `npx wrangler secret list` 로 확인 |
| Workers에서 DB 연결 실패 | `npx wrangler secret put DB_DRIVER` → `neon-http` 또는 `postgres-js` 로 드라이버 강제 |

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

```bash
docker build -t zunall .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AI_PROVIDER=anthropic -e ANTHROPIC_API_KEY="sk-ant-..." \
  zunall
```

DB까지 직접 띄우고 싶다면 Postgres 컨테이너를 함께 실행하고 `DATABASE_URL` 을 가리키면 됩니다.

## 환경변수 요약

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | (없으면 PGlite) | PostgreSQL 접속 문자열 — **배포에 필요한 유일한 필수값** |
| `DB_DRIVER` | 자동 감지 | `neon-http` / `postgres-js` 강제 지정 |
| `DB_AUTO_MIGRATE` | - | `1` 이면 부팅 시 스키마 자동 생성 (로컬/테스트용) |
| `STORAGE_BACKEND` | 자동 (`db`) | `db` / `r2` / `supabase` / `local` |
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
- Claude CLI provider 사용 시: 프롬프트는 stdin으로만 전달되어 shell injection이 차단됩니다
