# 배포 가이드 — 무료로 올리기

Zunall은 **PostgreSQL 하나만 있으면** 전부 동작합니다.
파일도 기본적으로 DB에 저장되므로 오브젝트 스토리지(S3/R2/Supabase Storage)가 **필요 없습니다**.

| 레이어 | 로컬 개발 | 배포 |
| --- | --- | --- |
| DB | PGlite (내장, 설치 불필요) | **무료 Postgres 아무거나** (`DATABASE_URL`) |
| 파일 | DB에 저장 | **DB에 저장** (기본) — 원하면 R2/Supabase로 전환 |
| 호스팅 | `npm run dev` | **Cloudflare Workers** 또는 Docker/VM |
| 배포 실행 | - | 터미널(`npm run deploy:cf`) 또는 **Cloudflare가 자동 빌드**(Workers Builds) |
| AI | mock (휴리스틱) | Anthropic API (`ANTHROPIC_API_KEY`, 선택) |

전환은 **환경변수만으로** 이뤄집니다. 코드 수정이 필요 없습니다.

---

## 터미널이 처음이라면 — 여기부터

**터미널 여는 법 (Mac)**: `Command(⌘) + Space` → `터미널` 입력 → Enter
(Windows는 시작 메뉴 → `PowerShell`)

검은 창에 `사용자이름@MacBook ~ %` 같은 줄이 보입니다. **`%` 뒤에 명령을 붙여넣고 Enter** 를 치면 실행됩니다.

| 상황 | 방법 |
| --- | --- |
| 붙여넣기 | `Command + V` |
| 명령이 끝났는지 확인 | `%` 가 다시 나타나면 끝난 것 |
| 실행 중인 명령 멈추기 | `Control + C` |
| 창 하나 더 열기 | `Command + T` |
| 성공했는데 아무 메시지도 없음 | 정상입니다. 터미널은 성공하면 조용합니다 |

**가장 흔한 실수는 "폴더를 안 옮긴 것"입니다.** `npm` 으로 시작하는 명령은 전부
`zunall` 폴더 안에서 쳐야 하고, 아니면 `npm ERR! Could not read package.json` 이 납니다.

```bash
pwd
```
끝이 `/zunall` 이면 정상. 아니면 `cd ~/zunall` 로 이동하세요.
터미널을 껐다 켜면 위치가 초기화되므로 매번 `cd ~/zunall` 부터 시작합니다.

### `DATABASE_URL="..." npm run seed` 형태의 명령

명령 **앞에** 붙은 `이름="값"` 은 그 명령 한 번에만 적용되는 임시 설정입니다.
파일에 저장되지 않고 터미널을 닫으면 사라집니다. 실제로는 아래처럼 **한 줄**로 칩니다.

```bash
DATABASE_URL="postgresql://neondb_owner:npg_Ab3xY9@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npm run seed
```

- `DATABASE_URL=` 바로 뒤에 큰따옴표 → 주소 붙여넣기 → 큰따옴표로 닫기
- 한 칸 띄우고 `npm run seed`
- 중간에 Enter 를 치지 말 것 (전체가 한 줄)
- 메모 앱·메신저를 거치면 따옴표가 `“ ”` 로 바뀌어 에러가 납니다. 따옴표는 터미널에서 직접 입력하세요.

---

## 0단계 — 사전 준비 (Mac / Windows 공통)

```bash
node -v
```
**v22 이상**이어야 합니다. wrangler 4가 Node 22를 요구합니다.
낮으면 [nodejs.org](https://nodejs.org) 에서 LTS를 설치하거나 `nvm install 22 && nvm use 22`.

```bash
cd ~
```
```bash
git clone https://github.com/djkdb/zunall.git
```
→ `Resolving deltas: 100% ... done.` 이 나오면 성공

```bash
cd zunall
```
→ 이제부터 모든 명령은 이 폴더 안에서 실행합니다

```bash
npm install
```
→ `added ... packages` 가 나오면 성공. 노란 `warn` 은 무시해도 되고 빨간 `ERR!` 만 문제입니다.
`npm install` 을 건너뛰면 `opennextjs-cloudflare: command not found` 가 납니다.

준비물은 두 개뿐입니다 — **Cloudflare 계정**(무료)과 **Postgres 주소**(1단계에서 발급).

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

저장소에 이미 `schema.sql` 이 들어 있습니다. 다시 만들고 싶을 때만:

```bash
npx tsx scripts/export-schema.ts
```

`schema.sql` 전체를 복사해 **Neon 콘솔의 SQL Editor**(또는 쓰는 서비스의 SQL 콘솔)에
붙여넣고 실행하세요. `CREATE TABLE IF NOT EXISTS` 라서 여러 번 실행해도 안전하며, 25개 테이블이 만들어집니다.

### 1-3. 연결 확인 (권장)

```bash
DATABASE_URL="복사한 연결 문자열" npm run seed
```

`✅ 시드 완료` 가 나오면 DB 연결과 스키마가 정상입니다.

---

## 2단계 — 배포 방법 두 가지

| 방법 | 어떻게 | 언제 좋은가 |
| --- | --- | --- |
| **A. 터미널에서 배포** | 내 컴퓨터에서 `npm run deploy:cf` | 지금 바로 한 번 올려보고 싶을 때 |
| **B. Cloudflare가 대신 빌드** (Workers Builds) | GitHub에 push → Cloudflare가 자동 빌드·배포 | 앞으로 계속 쓸 때 — 터미널이 필요 없음 |

둘 다 결과물은 같습니다. **B로 연결해두면 이후에는 코드를 push 하기만 하면 됩니다.**

---

## 2-A단계 — 터미널에서 배포

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
`Enter a secret value:` 에서 커서가 멈춥니다. 여기에 1-1의 연결 문자열을 붙여넣고 Enter.
**붙여넣어도 화면에 글자가 보이지 않는 것이 정상입니다**(비밀번호 입력과 같음).
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

## 2-B단계 — Cloudflare가 대신 빌드하게 하기 (터미널 없이)

Cloudflare의 **Workers Builds** 는 GitHub 저장소를 연결해두면 push 할 때마다
Cloudflare 쪽 서버에서 빌드하고 배포까지 합니다. 내 컴퓨터에 Node도, wrangler도 필요 없습니다.

### 1. 대시보드에서 저장소 연결

[dash.cloudflare.com](https://dash.cloudflare.com) → **Compute (Workers)** → 이미 만들어둔
`zunall` Worker 선택 → **Settings → Build** → **Connect** → GitHub 인증 →
저장소 `djkdb/zunall` 선택.

(아직 Worker가 없다면 **Create → Workers → Import a repository** 로 시작해도 됩니다)

### 2. 빌드 설정 입력

| 항목 | 값 |
| --- | --- |
| Build command | `npm run build:cf` |
| Deploy command | `npx wrangler deploy` |
| Branch | 배포할 브랜치 (예: `main`) |
| Root directory | 비워둠 |

Node 버전 오류가 나면 **Settings → Variables → Build variables** 에
`NODE_VERSION = 22` 를 추가하세요.

### 3. 시크릿은 대시보드에서 등록

**Settings → Variables and Secrets → Add** → Type을 **Secret** 으로 두고
`DATABASE_URL` 에 Postgres 연결 문자열을 붙여넣습니다.
(터미널에서 `npx wrangler secret put` 으로 이미 넣었다면 그대로 있습니다)

`ANTHROPIC_API_KEY` 도 같은 방법으로, 실제 Claude 분석을 쓸 때만 추가하면 됩니다.

### 4. 이후 사용법

GitHub에 push → Cloudflare가 자동으로 빌드 → 몇 분 뒤 배포 완료.
진행 상황과 로그는 Worker의 **Deployments** 탭에서 볼 수 있고, 실패하면 거기서 원인이 보입니다.

> 주의: Workers Builds는 `npm run deploy:cf` 대신 위의 두 명령을 직접 실행하므로
> 크기 검사(`check-worker-size.ts`)를 거치지 않습니다. 라이브러리를 크게 추가한 날에는
> 로컬에서 `npm run size:cf` 로 한 번 확인하거나, Build command 를
> `npm run build:cf && npm run size:cf` 로 바꿔두면 됩니다.

---

## Worker 크기 제한과 PDF (중요)

Cloudflare Workers는 **무료 3MB / 유료 10MB**(gzip 기준)의 코드 크기 제한이 있습니다.
PDF 텍스트 추출에 쓰는 `pdf-parse`(내부의 pdf.js)만 혼자 **gzip 1.4MB**를 차지해
이것 하나로 무료 한도를 넘겨버립니다. 그래서 기본 설정은 이렇습니다.

| 실행 환경 | PDF 자동 추출 | DOCX / PPTX / TXT / MD / CSV | 번들 크기 |
| --- | --- | --- | --- |
| Cloudflare Workers (무료) | ❌ 파일 보관만 | ✅ 추출 | 약 2.0MB |
| 로컬 개발 / Docker / VM | ✅ 추출 | ✅ 추출 | 제한 없음 |

Workers에서 PDF를 올리면 **업로드와 다운로드는 정상 동작**하고 텍스트 추출만 건너뜁니다.
업로드 창에도 그렇게 안내됩니다. PDF 공고를 AI로 분석하려면 DOCX·TXT로 저장해 올리거나
내용을 복사해 붙여넣으면 됩니다.

배포 전에 크기를 미리 확인하려면:

```bash
npm run size:cf
```

`npm run deploy:cf` 는 이 검사를 자동으로 거치므로, 한도를 넘으면 업로드 전에 멈춥니다.

### Workers에서도 PDF 추출을 켜려면 (유료 플랜)

Workers 유료 플랜($5/월, 한도 10MB)이라면 `src/services/document/extract.ts` 의
`loadPdfParse()` 를 정적 import 로 바꾸면 됩니다.

```ts
import pdfParse from "pdf-parse/lib/pdf-parse.js";
```

번들에 다시 포함되어 Workers에서도 PDF가 추출됩니다(약 3.4MB).

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
| wrangler 실행 시 Node 버전 오류 | Node 22 미만 → `nvm install 22 && nvm use 22` |
| `Authentication error [code: 10000]` | 로그인 만료 → `npx wrangler logout` 후 다시 `npx wrangler login` |
| `relation "users" does not exist` | 1-2 단계(schema.sql)를 DB에 적용하지 않음 |
| `password authentication failed` | 연결 문자열의 비밀번호 자리를 실제 값으로 바꾸지 않음 |
| `npm ERR! Could not read package.json` | zunall 폴더 밖에서 실행 → `cd ~/zunall` |
| `command not found: npm` | Node.js 미설치 → nodejs.org 에서 LTS 설치 후 터미널 재시작 |
| `zsh: parse error` / 따옴표 오류 | 스마트 따옴표(`“ ”`) 사용 → 터미널에서 `"` 직접 입력 |
| `exceeded the size limit of 3 MiB` | 번들이 무료 한도 초과 → 위 "Worker 크기 제한" 절 참고 (`npm run size:cf` 로 확인) |
| `Please enable R2` | 예전 코드 사용 중 → 최신 코드를 pull 하세요 (지금은 R2 없이 동작) |
| Workers Builds 빌드 실패 (Node 버전) | Build variables 에 `NODE_VERSION=22` 추가 |
| 배포는 됐는데 DB 오류 | secret 미등록 → `npx wrangler secret list` 로 확인 |
| Workers에서 DB 연결 실패 | `npx wrangler secret put DB_DRIVER` → `neon-http` 또는 `postgres-js` 로 드라이버 강제 |

---

## 배포 후 — 확인과 운영

### 첫 접속
출력된 `https://zunall.<서브도메인>.workers.dev` 로 들어가 **회원가입**하면 됩니다.
로그인 후 온보딩(목표 직무 선택)까지 마치면 Career Score가 계산됩니다.
데모 계정이 필요하면 로컬에서 `DATABASE_URL="배포용 주소" npm run seed` 를 돌리면
`demo@zunall.app / demo1234!` 가 생깁니다.

### 실시간 로그 보기
```bash
npx wrangler tail
```
브라우저에서 오류가 났을 때 이 창에 원인이 그대로 찍힙니다.

### 코드 수정 후 재배포
```bash
npm run deploy:cf
```
같은 명령을 다시 실행하면 됩니다. DB와 secret은 그대로 유지됩니다.

### 이전 버전으로 되돌리기
```bash
npx wrangler deployments list
```
```bash
npx wrangler rollback
```

### secret 확인 / 변경 / 삭제
```bash
npx wrangler secret list
```
```bash
npx wrangler secret put DATABASE_URL
```
```bash
npx wrangler secret delete ANTHROPIC_API_KEY
```
값을 바꾸면 다음 요청부터 즉시 반영됩니다(재배포 불필요).

### 내 도메인 붙이기
도메인이 Cloudflare에 등록돼 있어야 합니다.
Cloudflare 대시보드 → **Workers & Pages → zunall → Settings → Domains & Routes → Add → Custom domain**
에서 `zunall.내도메인.com` 을 입력하면 인증서까지 자동으로 붙습니다.

### 무료 한도 감각
- Workers 무료: 하루 100,000 요청 (개인 사용에 충분)
- Neon 무료: 저장 0.5GB — 업로드 파일이 DB에 쌓이므로, 파일이 많아지면 R2 전환
- Anthropic API는 별도 종량 과금 (미설정 시 mock으로 동작하므로 요금 0)

### 앱 내리기
```bash
npx wrangler delete
```

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
