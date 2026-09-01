# Zunall — 대외활동 통합 관리 + AI 평가 웹앱

공모전, 대외활동, 서포터즈, 해커톤, 프로젝트, 교육, 인턴 프로그램 등 모든 외부 활동을
**프로젝트 단위로 통합 관리**하고, **AI가 제출물을 활동의 공식 평가 기준에 맞춰 분석·피드백**해주는
개인용 대외활동 OS입니다.

## 주요 기능

- **활동 관리** — 활동 종류/상태/중요도/태그, 상태 변경, 마감일 자동 일정 등록
- **Dashboard** — 오늘·이번 주 마감, D-day 색상 강조(🔴 D-1 / 🟠 D-3 / 🟡 D-7 / 🟢 여유), 마감 임박 활동, 해야 할 일, AI 평가가 필요한 결과물, 최근 알림
- **캘린더** — 월간/주간/목록 뷰, 활동별 색상, 활동 상세에서는 해당 활동 일정만 필터링
- **작업 관리** — TODO → IN PROGRESS → REVIEW → DONE 칸반(드래그&드롭), 우선순위/마감일
- **문서 관리** — 공고/안내·참고자료·내가 만든 자료·제출자료 분류, 버전 관리, 업로드 시 PDF/DOCX/PPTX/TXT 텍스트 자동 추출
- **제출물 관리** — v1, v2, … Final 버전 관리, 상태 추적
- **알림 센터** — D-7/D-3/D-1/당일 마감 알림 자동 생성(중복 방지), 유형별 필터
- **AI 평가 (핵심)** —
  - 공고문 분석: 모집 기간·지원 자격·제출 형식·평가 기준·유의사항·시상 추출 → **사용자 확인 후에만 활동에 반영**
  - 평가 기준 추출 및 직접 관리 (공식/추론/직접입력 구분)
  - 제출물 평가: 공식 평가 기준 대비 항목별 점수 + 잘한 점/부족한 점/개선 방법
  - 제출 전 최종 검토(Final Check): 파일/마감/기준 충족/개인정보 체크리스트
  - 적합도 분석, 문서 첨삭, 개선점 찾기, 예상 질문 생성
  - **AI 피드백 → 작업(Task) 생성** 원클릭 연결
- **포트폴리오 기록** — 활동별 역할/성과/배운 점/사용 기술 기록
- **통계** — 수상률, 완료율, 분야별 참여 비율, 월별 등록 추이, AI 평균 점수, AI 예상 vs 실제 결과
- **다크 모드 / 반응형**

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn 스타일 컴포넌트 |
| Backend | Next.js Server Actions + Route Handlers |
| DB | SQLite (better-sqlite3 + Drizzle ORM) — PostgreSQL/Supabase 전환을 고려한 스키마/레이어 분리 |
| 인증 | 자체 이메일/비밀번호 (scrypt 해시 + 세션 쿠키) |
| 스토리지 | 로컬 파일시스템 (`data/uploads`) — 스토리지 서비스 모듈로 추상화 |
| 문서 분석 | pdf-parse(PDF), mammoth(DOCX), jszip+fast-xml-parser(PPTX) |
| AI | Claude CLI provider + Mock provider (환경변수 전환) |
| 차트 | Recharts |
| 검증 | Zod (+ AI JSON Schema 검증 및 재시도) |

## 시작하기

```bash
npm install
cp .env.example .env.local   # 필요 시 수정 (기본값으로도 동작)
npm run dev                  # http://localhost:3000
```

데모 데이터로 둘러보기:

```bash
npm run seed
# 계정: demo@zunall.app / demo1234!
```

## AI Provider 설정

기본값은 `mock`으로, Claude CLI가 없어도 전체 앱이 동작합니다.
Mock provider는 고정 응답이 아니라 업로드된 문서에서 날짜·배점표를 휴리스틱으로 추출하고
결정적 점수를 생성하는 개발용 분석기입니다.

실제 Claude 평가를 사용하려면:

```env
AI_PROVIDER=claude
CLAUDE_COMMAND=claude   # PATH의 실행 파일 또는 절대 경로
CLAUDE_ARGS=-p
CLAUDE_TIMEOUT=180000
```

보안: Claude CLI는 shell을 거치지 않고 `spawn`으로 실행되며, 프롬프트는 인자가 아닌
**stdin**으로만 전달되어 command injection이 차단됩니다.

## 프로젝트 구조

```
src/
  app/
    (auth)/login, signup        # 인증 페이지
    (app)/                      # 로그인 필요 영역 (사이드바 셸)
      page.tsx                  # Dashboard
      activities/               # 목록 / 생성 / 상세(8개 탭) / 수정
      calendar/  notifications/  stats/  settings/
    api/files/[id]/             # 파일 다운로드
  actions/                      # Server Actions (도메인별)
  components/                   # UI 컴포넌트 (ui/, activities/, ai/, calendar/, …)
  lib/
    db/                         # Drizzle 스키마 + 부트스트랩 DDL
    auth/                       # scrypt + 세션
    storage.ts                  # 파일 스토리지 (경로 검증 포함)
    queries.ts  validators.ts  constants.ts  utils.ts
  services/
    ai/                         # provider / prompt-builder / evaluator / schemas
    document/                   # PDF·DOCX·PPTX 텍스트 추출
    notification/               # D-day 알림 생성
scripts/seed.ts                 # 데모 데이터
```

## 검증 명령

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # production build
```

## 보안 고려사항

- 모든 쿼리는 `userId` 소유권 검증을 거침 (사용자 간 데이터 격리)
- 업로드: 확장자 허용 목록 + 크기 제한, 저장 파일명은 서버 생성 키만 사용 (path traversal 방지)
- 다운로드: 스토리지 루트 밖 경로 접근 차단
- Claude CLI: shell 미사용 + stdin 프롬프트 전달 + 타임아웃/출력 크기 제한
- 세션: httpOnly 쿠키, scrypt 비밀번호 해시
