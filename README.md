# Cavero — AI Career OS

**스펙을 관리하는 서비스가 아닙니다.**
내가 원하는 직무와 목표를 기준으로 현재 나의 경험을 분석하고, 부족한 부분을 찾고,
지금 가장 효과적인 행동을 추천하고, 실제 지원물까지 개선해주는 **개인 커리어 운영체제**입니다.

> 많이 하는 것보다, **맞는 것**을 하게 합니다.

## 핵심 루프

```
목표 설정 → 경험/역량 분석 → Career Profile → Gap 분석 → 기회 탐색
→ 지원 가치 판단 → 합격 전략 → 실행(Task) → 제출물 AI 평가 → 결과 기록
→ Profile 업데이트 → 다음 행동 추천
```

## Career OS 기능

- **Career Profile** (`/career`) — 목표·헤드라인·스킬·근거(Evidence)를 하나로 통합. 3단계 온보딩, 기존 활동/수상 기록 자동 임포트
- **Career Readiness Score** — 합격 확률이 아닌 **설명 가능한 규칙 기반 준비도**. 목표 스킬 충족도(55) + 실전 경험(15) + 검증 근거(15) + 기본기(15), 모든 항목에 산출 근거 표시
- **근거 기반 스킬 점수** — AI가 임의로 점수를 만들지 않음. 프로젝트/수상/활동 근거의 가중 합산(수확 체감)으로 계산하고, 점수를 펼치면 기여 내역이 보임. 자가 평가는 낮은 가중치 참고값
- **Career Gap 엔진** (`/career/gaps`) — 목표 직무 템플릿(AI 엔지니어/프론트엔드/백엔드/데이터/PM/마케터/디자이너…) 대비 부족 역량을 "왜 필요한가 / 왜 부족한가 / 추천 행동 / 예상 효과·소요시간"과 함께 제시
- **🔥 Today's Career Mission** — 오늘 가장 효과적인 행동 1개를 (효과 × Gap 가중치 ÷ 시간)으로 선정. 수락하면 Task 생성 → 완료하면 Career Score 갱신 + 다음 미션 추천
- **Opportunity Fit** (`/opportunities`, 활동 상세 '적합도' 탭) — AI가 공고에서 요구 역량을 추출하면 **규칙 레이어가** 내 프로필과 비교해 적합도를 가산 항목(+/−)으로 계산. "좋은 기회인가"가 아니라 **"지금의 나에게 좋은 기회인가"** 를 판단
- **지원 비추천 기능** — 준비 시간 대비 Gap 감소 효과가 낮으면 지원을 말리고, 대신 지금 더 효과적인 대안 행동을 제시
- **Career Roadmap** (`/career/roadmap`) — Gap 추천 행동으로 3개월 계획 자동 생성, 각 항목을 Task로 연결
- **제출물 개선 루프** — 초안 업로드 → AI 평가 → 개선 → 재평가, 카드에 점수 변화(74 → 82 → 91) 표시
- **성장 통계** — Career Score 30일 변화, 추천 행동 완료율, 평균 지원 적합도

## 모의 면접 (`/interview`, zunterview 이식)

- **3인 면접관 패널** — 인사팀·면접위원장·실무자가 질문 유형에 따라 번갈아 묻고, 답을 듣고 **꼬리질문**으로 파고든다. 브라우저 음성으로 질문 읽기·말로 답하기(선택)
- **직무 256개·질문 7,989개 / 기업 54곳·1,547개** — 공학·상경·인문·예체능·보건·공공 전부. 공개 후기·공식 자료·직무 기반 질문을 구분해 표시 (기출이라고 하지 않는다)
- **공고·자소서 연결** — 활동에서 시작하면 공고문의 요구 역량과 내가 쓴 자기소개서 문장을 근거로 질문(서류 기반 면접). 이메일·전화·링크는 가리고 보내며, 면접이 끝나면 서류 원문은 남기지 않는다
- **리포트** — 6개 항목 점수(질문 이해도·논리성·구체성·구조·전달력·자신감), 가장 먼저 고칠 것, STAR 체크, 고쳐 말하기 예시, 서류와 답변 비교. 같은 질문에 **다시 답해 보기**, 받은 질문과 답을 활동의 **면접 준비에 담기**
- **기록** — 점수 추이·자주 약한 항목, 같은 설정으로 다시 보기. 일주일 안 면접 일정이 있으면 대시보드가 연습을 권하고, 면접 단계 탈락이 많으면 통계가 연결해 준다
- AI 가 없으면 규칙 기반 면접관이 같은 흐름으로 진행하고, AI 호출이 실패하면 그 호출만 규칙 기반으로 대신한다. 면접 1회 = AI 사용 1회 (면접 안 호출 수는 별도 상한)
- 면접 문답은 기본 모델에 낮은 생각 깊이(effort low)로 부른다. 더 빠르게 하려면 `ANTHROPIC_INTERVIEW_MODEL` 로 면접용 모델을 따로 지정
- **zunterview 와 동기화** — 면접 로직·프롬프트·질문 은행은 zunterview 저장소의 복사본이다(`src/services/mock-interview/UPSTREAM` 에 커밋 기록). zunterview 를 고도화한 뒤 `npm run sync:zunterview -- <zunterview 경로>` 로 가져온다. 복사본 파일은 직접 고치지 않고, Cavero 쪽 차이는 `engine.ts`·`ai-interviewer.ts`·`server-data.ts`·`catalog.ts`·`view.ts` 에만 둔다

## 출시 준비 (운영)

- **남용 방지** — 같은 이메일로 로그인 5번 실패 시 15분 잠금(맞는 비밀번호도), 없는 계정도 같은 시간 소요, 재설정 메일 시간당 3번, 둘러보기 계정·가입은 IP(Cloudflare `cf-connecting-ip`)당 제한. 카운터는 `rate_limits`, 하루 지나면 크론이 정리
- **보안 헤더** — CSP(자기 출처만, 포트폴리오 공유 화면만 다른 사이트에 끼워 넣기 허용), nosniff, Referrer-Policy, Permissions-Policy(마이크는 모의 면접 말로 답하기에만), HSTS
- **링크 미리보기·검색** — 카카오톡·슬랙 공유 시 `og.png`, `robots.txt`(둘러보기·API 제외), `sitemap.xml`, 안내가 있는 404
- **의견 보내기** — 앱 어디서든 의견을 남기면 운영 지표 화면의 의견함에 쌓인다 (답장을 고른 경우에만 이메일 포함)
- **휴대폰** — 하단 탭(홈·커리어·활동·면접·전체), 상단에 알림
- `CONTACT_EMAIL` 을 넣으면 소개 화면 아래와 개인정보처리방침에 문의 주소가 나온다

## 기존 활동 관리 기능 (전부 유지)

활동 CRUD·8탭 상세, D-day 대시보드, 월/주/목록 캘린더, 칸반 Task, 문서 분류·버전 관리(PDF/DOCX/PPTX/TXT 텍스트 추출), 제출물 v1~Final, D-7/3/1/당일 알림, AI 공고 분석(사용자 확인 후 반영)·평가 기준 추출·제출물 평가·Final Check·첨삭·예상 질문, 포트폴리오 기록, 통계, 다크 모드, 반응형.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Server Actions + Route Handlers |
| DB | **PostgreSQL** (Drizzle) — 배포는 무료 Postgres(Neon 등), 로컬은 PGlite(설치 불필요) 자동 폴백 |
| 테스트 | 단위 `npm run test:unit` · 브라우저 E2E `npm run test:e2e` (GitHub Actions 자동 실행) |
| 인증 | 이메일+비밀번호(scrypt) / **구글 로그인**(선택, 환경변수로 켜짐) |
| 문서 파싱 | PDF·DOCX·PPTX·TXT 텍스트 추출 (Cloudflare 무료 플랜에서는 PDF 제외 — DEPLOY.md 참고) |
| 스토리지 | **DB 저장이 기본** — 필요 시 R2 / Supabase Storage / 로컬로 환경변수 전환 |
| 호스팅 | **Cloudflare Workers** (OpenNext) 또는 Docker/VM |
| 점수 엔진 | `services/score/*` + `services/career/*` — 순수 함수, 단위 테스트 13개 |
| AI | Provider 추상화: `mock`(휴리스틱) / `claude`(CLI) / `anthropic`(API) — AI는 추출만, 점수는 규칙 레이어가 계산 |
| 검증 | Zod (AI JSON 스키마 검증 + 재시도) |

## 시작하기

```bash
npm install
npm run dev            # http://localhost:3000 (AI_PROVIDER=mock 기본)
npm run seed           # 데모 데이터 (demo@cavero.app / demo1234!)
```

`DATABASE_URL` 이 없으면 내장 PGlite로 동작하므로 DB 설치가 필요 없습니다.
실제 Claude 사용: `.env.local`에 `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=...`

배포: **[DEPLOY.md](./DEPLOY.md)** — 무료 Postgres 하나(`DATABASE_URL`)만 있으면 됩니다.
오브젝트 스토리지 없이 파일까지 DB에 저장되므로 추가 서비스가 필요 없습니다.

## 검증

```bash
npm run typecheck && npm run lint && npm run build
npm run test:score           # 점수 엔진 단위 테스트 (13)
node tests/e2e-career.mjs    # Career OS E2E: 온보딩→Gap→적합도→미션→완료 루프 (19)
node tests/e2e-smoke.mjs     # 활동 관리 E2E (17)
node tests/sim-user.mjs      # 사용자 관점 시뮬레이션 (35)
node tests/e2e-workerd.mjs   # Cloudflare Workers 런타임 스모크 (6)
```

E2E는 `DATABASE_URL` 을 지정하면 실제 PostgreSQL을 대상으로도 그대로 돌아갑니다.

## 설계 원칙

1. **점수에는 반드시 근거** — 모든 점수(스킬/준비도/적합도)는 기여 항목 배열과 함께 반환되고 UI에 표시
2. **AI는 추출, 규칙은 판단** — AI는 문서에서 요구사항·날짜·기준을 추출할 뿐, 점수 계산은 테스트 가능한 `services/score/` 레이어가 담당
3. **합격 확률 표현 금지** — Career Readiness / 지원 적합도 / 추천으로만 표현하고 추정치임을 명시
4. **자동 확정 금지** — AI 추출값(마감일·평가 기준)은 사용자가 확인 후 반영
5. **사용자 데이터 격리** — 모든 엔티티에 userId 소유권 검증
6. **AI 실패 내성** — provider 오류 시 앱이 아닌 해당 액션만 실패, JSON 검증 실패 시 재시도

## 프로젝트 구조 (Career 확장분)

```
src/
  lib/
    career-constants.ts     # 스킬 카탈로그, 역할 템플릿, Gap 행동 템플릿
    career-queries.ts       # CareerContext 조립, 스냅샷, Task 완료 연동
  services/
    score/                  # skill / readiness / opportunity-fit — 순수 함수
    career/                 # templates / gap / mission / skill-detect / evidence-import
    ai/anthropic.provider.ts
  actions/ career.ts opportunity.ts
  app/(app)/ career/ (skills, gaps, roadmap)  opportunities/
  components/career/
tests/ score.test.ts  e2e-career.mjs  e2e-smoke.mjs  sim-user.mjs
```
