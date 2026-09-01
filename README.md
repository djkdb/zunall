# Zunall — AI Career OS

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

## 기존 활동 관리 기능 (전부 유지)

활동 CRUD·8탭 상세, D-day 대시보드, 월/주/목록 캘린더, 칸반 Task, 문서 분류·버전 관리(PDF/DOCX/PPTX/TXT 텍스트 추출), 제출물 v1~Final, D-7/3/1/당일 알림, AI 공고 분석(사용자 확인 후 반영)·평가 기준 추출·제출물 평가·Final Check·첨삭·예상 질문, 포트폴리오 기록, 통계, 다크 모드, 반응형.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Server Actions + Route Handlers |
| DB | SQLite (better-sqlite3 + Drizzle) — D1/PostgreSQL 전환 고려한 레이어 분리 |
| 점수 엔진 | `services/score/*` + `services/career/*` — 순수 함수, 단위 테스트 13개 |
| AI | Provider 추상화: `mock`(휴리스틱) / `claude`(CLI) / `anthropic`(API) — AI는 추출만, 점수는 규칙 레이어가 계산 |
| 검증 | Zod (AI JSON 스키마 검증 + 재시도) |

## 시작하기

```bash
npm install
npm run dev            # http://localhost:3000 (AI_PROVIDER=mock 기본)
npm run seed           # 데모 데이터 (demo@zunall.app / demo1234!)
```

실제 Claude 사용: `.env.local`에 `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=...`
배포: **[DEPLOY.md](./DEPLOY.md)** — Docker 즉시 배포, 또는 **Cloudflare Workers(D1+R2, 마이그레이션 완료)** 5개 명령으로 배포

## 검증

```bash
npm run typecheck && npm run lint && npm run build
npm run test:score           # 점수 엔진 단위 테스트 (13)
node tests/e2e-career.mjs    # Career OS E2E: 온보딩→Gap→적합도→미션→완료 루프 (19)
node tests/e2e-smoke.mjs     # 활동 관리 E2E (17)
node tests/sim-user.mjs      # 사용자 관점 시뮬레이션 (35)
```

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
