# 배포 가이드 — 무료로 올리기

Cavero은 **PostgreSQL 하나만 있으면** 전부 동작합니다.
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
`cavero` 폴더 안에서 쳐야 하고, 아니면 `npm ERR! Could not read package.json` 이 납니다.

```bash
pwd
```
끝이 `/cavero` 이면 정상. 아니면 `cd ~/cavero` 로 이동하세요.
터미널을 껐다 켜면 위치가 초기화되므로 매번 `cd ~/cavero` 부터 시작합니다.

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
git clone https://github.com/djkdb/cavero.git
```
→ `Resolving deltas: 100% ... done.` 이 나오면 성공

```bash
cd cavero
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
완료되면 `https://cavero.<서브도메인>.workers.dev` 주소가 출력됩니다.

점검만 따로 돌리려면 `npm run preflight:cf` 입니다.

**필요한 secret은 `DATABASE_URL` 하나뿐입니다.**

---

## 2-B단계 — Cloudflare가 대신 빌드하게 하기 (터미널 없이)

Cloudflare의 **Workers Builds** 는 GitHub 저장소를 연결해두면 push 할 때마다
Cloudflare 쪽 서버에서 빌드하고 배포까지 합니다. 내 컴퓨터에 Node도, wrangler도 필요 없습니다.

### 1. 대시보드에서 저장소 연결

[dash.cloudflare.com](https://dash.cloudflare.com) → **Compute (Workers)** → 이미 만들어둔
`cavero` Worker 선택 → **Settings → Build** → **Connect** → GitHub 인증 →
저장소 `djkdb/cavero` 선택.

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

## 브라우저 알림 켜기 (선택)

앱을 열지 않아도 마감 알림이 오게 하려면 세 가지를 등록합니다. **무료입니다.**

### 1. 키 만들기

```bash
npm run vapid
```

출력된 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` 를 시크릿으로 등록합니다.

### 2. Cloudflare 시크릿·변수

| 이름 | 종류 | 값 |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Secret | 위에서 만든 공개키 |
| `VAPID_PRIVATE_KEY` | Secret | 위에서 만든 개인키 |
| `CRON_KEY` | Secret | 아무 긴 문자열 (크론 엔드포인트 보호용) |
| `APP_URL` | Variable | `https://<내-워커-주소>` |

### 3. DB 컬럼

`migrations/003-push-subscriptions.sql` 을 SQL 콘솔에서 실행하세요.

### 동작

- `wrangler.jsonc` 의 Cron 트리거가 매일 08:00(KST)에 `/api/cron/daily` 를 호출합니다
- 마감 D-7·D-3·D-1·당일 항목을 모아 기기로 한 번에 보냅니다
- 사용자는 **설정 → 알림 → '이 기기에서 알림 받기'** 로 켭니다
- iPhone 은 Safari 에서 **공유 → 홈 화면에 추가** 후에만 알림을 받을 수 있습니다 (Apple 정책)

---

## 알림 설정 · 주간 리포트 (기본 포함)

설정 > 알림에서 사용자가 직접 고릅니다. 따로 설정할 환경변수는 없습니다.

| 항목 | 기본값 |
| --- | --- |
| 마감 알림 시점 | D-7 / D-3 / D-1 / 당일 (D-14 도 고를 수 있음) |
| 받을 알림 종류 | 일정 · 파일 · AI 평가 · 새 공고 · 시스템 |
| 조용한 시간 | 꺼짐 (켜면 그 시간대에는 푸시를 보내지 않고, 앱 알림함에는 그대로 쌓입니다) |
| 주간 리포트 | 켜짐 · 일요일 |

주간 리포트는 **이번 주 마감 / 지난 주 완료한 작업·추가한 활동 / Career Score 변화 /
다음 행동 1개**를 한 번에 정리합니다. 크론(`/api/cron/daily`)이 돌 때 요일을 확인해
그날인 사용자에게만 만들고, 같은 주에는 한 번만 보냅니다.
시간대는 브라우저에서 자동으로 저장되므로(한국은 UTC+9) 크론이 UTC로 돌아도 요일이 밀리지 않습니다.

## 모바일에서 공유로 공고 등록 (기본 포함)

앱을 **홈 화면에 추가**하면 브라우저·메신저의 공유 버튼 목록에 Cavero 가 나타납니다.
공고를 공유하면 `/share` 로 넘어와 주소(또는 공고문)를 확인하고 바로 활동으로 만듭니다.
로그인 전에 공유가 들어오면 로그인한 뒤 그 화면으로 돌아옵니다.

- Android Chrome 은 공유 대상을 지원합니다. iOS 는 공유 시트에 앱이 뜨지 않아,
  주소를 복사해 활동 만들기 화면에 붙여넣는 방식을 씁니다.

## 공고 자동 수집 (기본 포함)

기회 > **수집한 공고** 탭에서 관심 사이트를 등록하면, 하루 한 번 새 글을 찾아 알려줍니다.
등록할 주소는 공고가 **여러 개 나열된 목록 페이지**(또는 RSS)입니다.

- 로그인해야 보이는 페이지, JavaScript 로만 목록을 그리는 페이지는 가져오지 못합니다.
- 처음 등록할 때는 그동안 올라온 글을 담기만 하고 알림은 보내지 않습니다.
- 정기 확인은 아래 크론이 돌 때 함께 실행됩니다. 크론을 설정하지 않았다면
  화면의 **지금 확인** 버튼으로 언제든 수동 확인할 수 있습니다.

## 계정 관리 · 약관 (기본 포함)

아래는 설정 없이도 동작합니다.

| 기능 | 위치 |
| --- | --- |
| 이용약관 / 개인정보처리방침 | `/terms`, `/privacy` (로그인 없이 열람) |
| 가입 시 동의 | 회원가입 화면의 체크박스 (필수) |
| 비밀번호 변경 | 설정 > 비밀번호 |
| 계정 삭제 | 설정 > 계정 삭제 (자료 전부 즉시 삭제) |

### 문의 이메일 넣기 (권장)

약관·개인정보처리방침의 "문의" 항목에 표시됩니다. 없으면 문구만 나옵니다.

| 이름 | Type | 값 |
| --- | --- | --- |
| `CONTACT_EMAIL` | Variable | 운영자 이메일 |

### 비밀번호 재설정 메일 (선택)

메일 발송을 설정하지 않으면 `/forgot` 화면이 **"메일 발송이 설정되지 않았다"고 그대로 안내**하고,
구글 로그인으로 들어와 설정에서 비밀번호를 정하도록 안내합니다.
(보내지도 않고 "보냈다"고 하지 않습니다.)

메일을 쓰려면 [resend.com](https://resend.com) 에서 API 키를 만들고 두 값을 등록합니다.

| 이름 | Type | 값 |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Resend API 키 |
| `MAIL_FROM` | Variable | 보내는 주소 (예: `Cavero <noreply@내도메인>`) |
| `APP_ORIGIN` | Variable | 배포 주소 (선택, 메일 링크에 쓰임. 없으면 요청 헤더에서 알아냅니다) |

## 구글 로그인 켜기 (선택)

이메일 회원가입은 기본으로 동작합니다. 구글 로그인은 아래를 설정하면 버튼이 나타납니다.
**설정하지 않으면 버튼이 아예 보이지 않으므로**, 안 쓸 거면 그냥 두면 됩니다.

### 1. Google Cloud Console 에서 클라이언트 만들기

[console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 생성 →
**API 및 서비스 → OAuth 동의 화면** 을 먼저 구성(외부, 앱 이름 `Cavero`, 이메일 입력)한 뒤
**사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션**.

**승인된 리디렉션 URI** 에 배포 주소를 정확히 넣습니다(끝의 경로까지 그대로).

```
https://<내-워커-주소>/api/auth/google/callback
```

로컬에서도 쓰려면 한 줄 더 추가합니다.

```
http://localhost:3000/api/auth/google/callback
```

만들고 나면 **클라이언트 ID** 와 **클라이언트 보안 비밀번호** 가 나옵니다.

### 2. Cloudflare 에 시크릿 등록

대시보드 → 해당 Worker → **Settings → Variables and Secrets → Add** 에서
Type 을 **Secret** 으로 두고 두 개를 추가합니다.

| 이름 | 값 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | 클라이언트 보안 비밀번호 |

터미널을 쓴다면 `npx wrangler secret put GOOGLE_CLIENT_ID` 로도 됩니다.

### 3. DB에 컬럼 추가

이미 만들어둔 DB라면 구글 계정용 컬럼이 없습니다. `migrations/001-google-login.sql`, `migrations/002-calendar-token.sql` 을
복사해 SQL 콘솔에서 실행하세요(여러 번 실행해도 안전).

새로 만드는 DB라면 `schema.sql` 에 이미 포함돼 있어 따로 할 일이 없습니다.
**마이그레이션은 앱이 스스로 적용합니다.** 배포 후 첫 요청에서 아직 적용되지 않은
`migrations/*.sql` 을 순서대로 실행하고 `schema_migrations` 테이블에 기록합니다.
`/api/health` 의 `migrations` 항목에서 적용 상태를 볼 수 있고,
자동 적용을 끄려면 `DB_AUTO_MIGRATE=0` 을 설정하세요.

### 동작 방식

- 같은 이메일로 이미 이메일 가입을 했다면, 구글 로그인 시 **기존 계정에 연결**됩니다
- 구글로만 가입한 계정으로 비밀번호 로그인을 시도하면 구글 버튼을 쓰라고 안내합니다
- 구글 계정의 이메일이 미인증 상태면 로그인을 거부합니다

**로그인이 실패하면** 화면의 문구가 원인을 알려줍니다.

| 문구 | 원인 |
| --- | --- |
| 구글 인증 정보가 맞지 않습니다 | 클라이언트 ID·시크릿 오타, 또는 콘솔의 리디렉션 URI 불일치 |
| 데이터베이스에 구글 로그인용 컬럼이 없습니다 | `migrations/001-google-login.sql`, `migrations/002-calendar-token.sql` 미실행 |
| 보안 확인에 실패했습니다 | state 쿠키 만료(10분) — 다시 시도 |

화면에는 구글이 알려준 사유(`invalid_client`, `redirect_uri_mismatch` 등)까지 함께 표시됩니다.
`/api/health` 의 `google.redirectUri` 값이 **콘솔에 등록해야 할 주소 그대로**이니, 그대로 복사해 넣으세요.

---

## 배포가 이상할 때 — /api/health

브라우저에서 `https://<내-워커-주소>/api/health` 를 열면 상태가 JSON 으로 나옵니다.

```json
{ "ok": true, "runtime": "cloudflare-workers", "database": "Neon (neon-http)",
  "connected": true, "missingTables": [], "storage": "db", "problems": [] }
```

| 증상 | 의미 | 해결 |
| --- | --- | --- |
| `databaseUrlSet: false` | 이 Worker에 DATABASE_URL 시크릿이 없음 | 대시보드 → Settings → Variables and Secrets 에 Secret 으로 추가 |
| `connected: false` + `databaseUrl.issues` | 접속 문자열 값 자체가 잘못됨 | issues 에 적힌 대로 수정 (따옴표·`psql ` 접두사·줄바꿈은 자동으로 걷어냄) |
| `connected: false` (issues 없음) | 주소는 정상이나 접속 실패 | 비밀번호·호스트·DB 이름 확인 |
| `missingTables` 에 목록 | 스키마 미적용 | `schema.sql` 을 SQL 콘솔에서 실행 |
| `missingColumns` 에 목록 | 나중에 추가된 컬럼이 없음 | `migrations/` 의 해당 SQL 을 실행 |
| `narrowColumns` 에 목록 | 시간 컬럼이 INTEGER 로 만들어짐 | 다음 요청에서 자동 교정됩니다 (수동: `migrations/006-bigint-epoch.sql`) |
| `notices` 에 문구 | 문제는 아니고 알림 | 예: API 키가 없어 AI 가 mock 으로 동작 중 |

`databaseUrl` 항목은 스킴·호스트 뒤 두 마디·자격증명 유무만 보여주며 비밀번호는 노출하지 않습니다.

**Worker 이름을 바꾸거나 새로 만들면 시크릿은 따라오지 않습니다.** 새 Worker에 다시
등록해야 하며, 이때 `Application error` 대신 위 안내 문구가 화면에 표시됩니다.

---

## 파일 저장 위치 바꾸기 (선택)

기본값은 **DB 저장**이라 아무 설정도 필요 없습니다. 파일이 많아지면 아래로 전환하세요.

| 백엔드 | 켜는 법 |
| --- | --- |
| **db** (기본) | 설정 불필요. `document_blobs` 테이블에 저장 |
| **r2** | `wrangler.jsonc` 의 `r2_buckets` 주석 해제 + `npx wrangler r2 bucket create cavero-uploads` |
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
| `Application error: a server-side exception` | 대부분 DATABASE_URL 시크릿 누락 → `/api/health` 로 확인 |
| `password authentication failed` | 연결 문자열의 비밀번호 자리를 실제 값으로 바꾸지 않음 |
| `npm ERR! Could not read package.json` | cavero 폴더 밖에서 실행 → `cd ~/cavero` |
| `command not found: npm` | Node.js 미설치 → nodejs.org 에서 LTS 설치 후 터미널 재시작 |
| `zsh: parse error` / 따옴표 오류 | 스마트 따옴표(`“ ”`) 사용 → 터미널에서 `"` 직접 입력 |
| `exceeded the size limit of 3 MiB` | 번들이 무료 한도 초과 → 위 "Worker 크기 제한" 절 참고 (`npm run size:cf` 로 확인) |
| `Please enable R2` | 예전 코드 사용 중 → 최신 코드를 pull 하세요 (지금은 R2 없이 동작) |
| Workers Builds 빌드 실패 (Node 버전) | Build variables 에 `NODE_VERSION=22` 추가 |
| 배포는 됐는데 DB 오류 | secret 미등록 → `npx wrangler secret list` 로 확인 |
| `tagged-template function` 오류 | @neondatabase/serverless 버전이 drizzle 과 안 맞음 → `npm install` 로 최신 코드의 고정 버전(0.10.x) 설치 |
| Workers에서 DB 연결 실패 | `npx wrangler secret put DB_DRIVER` → `neon-http` 또는 `postgres-js` 로 드라이버 강제 |

---

## 배포 후 — 확인과 운영

### 첫 접속
출력된 `https://cavero.<서브도메인>.workers.dev` 로 들어가 **회원가입**하면 됩니다.
로그인 후 온보딩(목표 직무 선택)까지 마치면 Career Score가 계산됩니다.
데모 계정이 필요하면 로컬에서 `DATABASE_URL="배포용 주소" npm run seed` 를 돌리면
`demo@cavero.app / demo1234!` 가 생깁니다.

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
Cloudflare 대시보드 → **Workers & Pages → cavero → Settings → Domains & Routes → Add → Custom domain**
에서 `cavero.내도메인.com` 을 입력하면 인증서까지 자동으로 붙습니다.

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
npm run seed    # 데모 데이터 (demo@cavero.app / demo1234!)
```

실제 Postgres로 개발하려면 `DATABASE_URL` 만 지정하면 됩니다.
앱이 스키마를 자동 생성하게 하려면 `DB_AUTO_MIGRATE=1` 을 함께 설정하세요
(운영 DB에는 쓰지 말고 `schema.sql` 을 1회 적용하는 방식을 권장).

---

## 대안 — Docker / VM

Cloudflare 대신 Node가 그대로 도는 환경(Railway, Fly.io, VPS)에도 올릴 수 있습니다.

```bash
docker build -t cavero .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AI_PROVIDER=anthropic -e ANTHROPIC_API_KEY="sk-ant-..." \
  cavero
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
