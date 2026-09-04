import "server-only";
import type { AIAction } from "@/lib/constants";
import { SKILL_CATALOG } from "@/lib/career-constants";
import type { AIContext } from "./provider";

// 프롬프트를 코드 전반에 하드코딩하지 않고 이 모듈에서만 조립한다.

function maxDocChars(): number {
  const n = Number(process.env.AI_MAX_DOC_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 24_000;
}

function clip(text: string, label: string): string {
  const limit = maxDocChars();
  if (!text.trim()) return `(${label} 없음)`;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n…[${label} 일부 생략: 전체 ${text.length}자 중 ${limit}자만 포함]`;
}

const COMMON_RULES = `
[공통 규칙]
- 반드시 유효한 JSON 하나만 출력한다. JSON 앞뒤에 설명 텍스트나 마크다운 코드펜스를 붙이지 않는다.
- 모든 문자열 값은 한국어로 작성한다.
- 확인된 사실(공식 문서 근거), 문서에서 추론한 내용, 주관적 판단을 구분한다.
- 공고문에 존재하지 않는 평가 기준을 임의로 만들어 "공식 기준"처럼 표기하지 않는다. 추론한 기준은 source를 "inferred"로 표시한다.
`;

function contextBlock(ctx: AIContext): string {
  const criteriaText =
    ctx.criteria.length > 0
      ? ctx.criteria
          .map(
            (c) =>
              `- ${c.name} (배점 ${c.weight}${c.source === "official" ? ", 공식" : ", " + c.source})${c.description ? ": " + c.description : ""}`,
          )
          .join("\n")
      : "(등록된 평가 기준 없음)";

  return `[활동 정보]
활동명: ${ctx.activityName}
종류: ${ctx.activityType}
주최: ${ctx.organizer ?? "미상"}

[등록된 평가 기준]
${criteriaText}

[공고/안내 문서 텍스트]
${clip(ctx.announcementText, "공고문")}
`;
}

export function buildPrompt(action: AIAction, ctx: AIContext): string {
  switch (action) {
    case "analyze_announcement":
    case "extract_criteria":
      return buildAnnouncementPrompt(ctx, action === "extract_criteria");
    case "analyze_opportunity":
      return buildOpportunityPrompt(ctx);
    case "evaluate_submission":
      return buildEvaluationPrompt(ctx);
    case "final_check":
      return buildFinalCheckPrompt(ctx);
    case "fit_analysis":
      return buildAdvicePrompt(
        ctx,
        "지원자가 이 활동에 얼마나 적합한지, 지원 시 무엇을 강조해야 하는지 분석하라.",
        true,
      );
    case "proofread":
      return buildAdvicePrompt(
        ctx,
        "제출물 문서를 첨삭하라. 구조, 내용 보강, 문장 표현의 세 관점에서 구체적인 수정 제안을 하라.",
        false,
      );
    case "improvements":
      return buildAdvicePrompt(
        ctx,
        "제출물에서 부족한 점을 찾아 우선순위(높음/중간/마무리)별로 개선 방법을 제시하라.",
        false,
      );
    case "essay_coach":
      return buildEssayPrompt(ctx);
    case "extract_profile":
      return buildProfilePrompt(ctx);
    case "expected_questions":
      return buildAdvicePrompt(
        ctx,
        "이 제출물로 발표/면접을 한다고 가정하고 심사위원이 던질 만한 예상 질문 15~20개를 생성하라. 평가 기준과 연결된 질문을 포함하라.",
        false,
      );
    case "interview_questions":
      return buildInterviewPrompt(ctx);
  }
}

function buildAnnouncementPrompt(ctx: AIContext, criteriaOnly: boolean): string {
  return `너는 공모전/대외활동 공고문 분석 전문가다.
아래 공고/안내 문서를 분석해 ${criteriaOnly ? "평가 기준을 추출하라" : "핵심 정보를 구조화하라"}.
${COMMON_RULES}
- 날짜는 반드시 YYYY-MM-DD 형식으로 변환한다. 연도가 없으면 문맥으로 추정하되 확신이 없으면 null로 둔다.
- 공고문에 명시된 배점이 있는 기준만 source를 "official"로 표시한다.

${contextBlock(ctx)}

[출력 JSON 스키마]
{
  "title": "공고에 적힌 활동/공모전 이름 (없으면 null)",
  "organizer": "주최 기관 (없으면 null)",
  "activityType": "contest|external|supporters|hackathon|project|education|intern|recruit|opensource|etc 중 하나",
  "summary": "문서 분석 요약 (2~3문장)",
  "schedule": [{"label": "지원 마감", "date": "YYYY-MM-DD 또는 null", "note": "부가설명 또는 null"}],
  "eligibility": ["지원 자격"],
  "requirements": ["필수 제출물"],
  "criteria": [{"name": "기준명", "weight": 30, "description": "설명 또는 null", "source": "official|inferred"}],
  "cautions": ["유의사항"],
  "prizes": ["시상 내역"],
  "keyDates": {"applyDeadline": "YYYY-MM-DD|null", "submitDeadline": "YYYY-MM-DD|null", "announceDate": "YYYY-MM-DD|null"}
}`;
}

function buildOpportunityPrompt(ctx: AIContext): string {
  const catalogNames = SKILL_CATALOG.map((s) => s.name).join(", ");
  return `너는 채용/공모전/대외활동 공고에서 요구 역량을 추출하는 커리어 분석 전문가다.
아래 공고를 분석해 이 기회가 요구하는 역량과 조건을 구조화하라.
${COMMON_RULES}
- requiredSkills와 preferredSkills는 반드시 다음 표준 역량명 중에서만 고른다 (해당 없으면 제외):
  ${catalogNames}
- 공고에 명시되지 않은 역량을 임의로 추가하지 않는다.

${contextBlock(ctx)}

[출력 JSON 스키마]
{
  "summary": "이 기회가 요구하는 것 요약 (1~2문장)",
  "requiredSkills": ["표준 역량명"],
  "preferredSkills": ["표준 역량명 (우대 사항)"],
  "responsibilities": ["주요 역할/업무"],
  "qualifications": ["지원 자격"],
  "submissionItems": ["제출물"],
  "keywords": ["공고 핵심 키워드"]
}`;
}

function buildEvaluationPrompt(ctx: AIContext): string {
  return `너는 공모전/대외활동 심사위원 역할의 평가 전문가다.
아래 제출물을 평가 기준에 따라 항목별로 채점하고 구체적인 피드백을 작성하라.
${COMMON_RULES}
- 등록된 평가 기준이 있으면 반드시 그 기준과 배점을 그대로 사용한다 (항목 추가/삭제 금지).
- 등록된 기준이 없으면 문서 성격에 맞는 일반 기준 3~5개를 만들되 모두 source를 "inferred"로 표시하고 confidence를 0.5 이하로 낮춘다.
- 점수는 후하지도 박하지도 않게, 실제 심사 수준으로 매긴다.
- strengths/weaknesses/recommendations는 제출물 내용을 직접 인용·참조하며 구체적으로 쓴다.

${contextBlock(ctx)}

[제출물: ${ctx.submissionTitle ?? "이름 없음"}]
${clip(ctx.submissionText, "제출물")}

[출력 JSON 스키마]
{
  "overall_score": 83,
  "max_score": 100,
  "confidence": 0.8,
  "criteria": [
    {
      "name": "기준명",
      "score": 26,
      "max_score": 30,
      "source": "official|inferred",
      "strengths": ["잘한 점"],
      "weaknesses": ["부족한 점"],
      "recommendations": ["구체적 개선 방법"]
    }
  ],
  "summary": "총평 (3~4문장)",
  "critical_issues": ["치명적 문제 (없으면 빈 배열)"],
  "next_actions": ["다음에 할 일 (작업으로 등록 가능한 형태)"]
}`;
}

function buildFinalCheckPrompt(ctx: AIContext): string {
  return `너는 제출 직전 최종 검토를 수행하는 검수 전문가다.
아래 제출물과 공고 요건을 대조해 제출 전 체크리스트를 점검하라.
${COMMON_RULES}
- 각 체크 항목은 pass(통과), warn(수정 권장), fail(치명적 문제)로 판정한다.
- 파일 형식/크기/마감 관련 시스템 정보: ${ctx.extraInstruction ?? "(없음)"}

${contextBlock(ctx)}

[제출물: ${ctx.submissionTitle ?? "이름 없음"}]
${clip(ctx.submissionText, "제출물")}

[출력 JSON 스키마]
{
  "score": 88,
  "checks": [{"label": "체크 항목명", "status": "pass|warn|fail", "detail": "판정 이유"}],
  "summary": "종합 판정 (1~2문장)",
  "recommendations": ["수정 권장 사항"]
}
체크 항목에 반드시 포함: 제출 파일 존재, 파일 형식, 필수 항목 포함 여부, 평가 기준 충족 여부, 오탈자/문장 품질, 제출 마감 확인, 개인정보 포함 여부`;
}

function buildAdvicePrompt(ctx: AIContext, mission: string, includeScore: boolean): string {
  return `너는 대외활동/공모전 전략 컨설턴트다.
${mission}
${COMMON_RULES}
${includeScore ? '- score 필드에 0~100 사이 점수를 넣는다.' : "- score 필드는 null로 둔다."}

[지원자 프로필]
${ctx.userProfile || "(정보 없음)"}

${contextBlock(ctx)}

[제출물/참고 자료: ${ctx.submissionTitle ?? "없음"}]
${clip(ctx.submissionText, "자료")}

[출력 JSON 스키마]
{
  "headline": "한 줄 제목",
  "summary": "핵심 요약 (2~3문장)",
  "score": ${includeScore ? "75" : "null"},
  "sections": [{"heading": "섹션 제목", "items": ["항목"]}],
  "next_actions": ["다음에 할 일"]
}`;
}

/** JSON 파싱 실패 시 재시도용 프롬프트 */
export function buildRetryPrompt(originalPrompt: string, badOutput: string, parseError: string): string {
  return `${originalPrompt}

[중요] 이전 응답이 JSON 파싱에 실패했다.
파싱 오류: ${parseError}
이전 응답 (앞부분): ${badOutput.slice(0, 1500)}

위 스키마를 정확히 따르는 유효한 JSON만 다시 출력하라. 다른 텍스트는 절대 포함하지 마라.`;
}

/**
 * 자기소개서 문항 첨삭 프롬프트.
 * 문항이 무엇을 묻는지, 글자수 제한을 지켰는지, 근거가 구체적인지를 본다.
 * extraInstruction 에 "문항 / 글자수 / 현재 글자수" 가 들어온다.
 */
function buildEssayPrompt(ctx: AIContext): string {
  return `너는 채용·공모전 서류를 심사해온 전문가다. 아래 자기소개서 문항의 답변을 첨삭하라.

${ctx.extraInstruction ?? ""}

[지원 대상]
활동명: ${ctx.activityName}
종류: ${ctx.activityType}
주최: ${ctx.organizer ?? "미상"}

[지원자 프로필]
${ctx.userProfile}

[공고 요약]
${clip(ctx.announcementText, "공고문")}

[작성한 답변]
${clip(ctx.submissionText, "답변")}

다음 JSON 형식으로만 답하라.
{
  "score": 0-100 정수,
  "summary": "한두 문장 총평",
  "answersQuestion": true/false (문항이 묻는 것에 답했는가),
  "strengths": ["구체적인 강점", ...],
  "improvements": [{"point": "무엇이 부족한가", "why": "왜 문제인가", "suggestion": "어떻게 고칠까"}],
  "rewrites": [{"before": "원문 문장", "after": "고친 문장"}]
}

원칙:
- 추상적인 칭찬 금지. 답변에서 근거 문장을 인용해 지적하라.
- 숫자·역할·결과가 없는 경험 서술은 반드시 개선점으로 잡아라.
- 글자수 제한이 있으면 초과/미달을 improvements 에 넣어라.
- rewrites 는 실제 답변에 있는 문장만 대상으로 하고 3개 이하로 하라.`;
}

/**
 * 이력/자기소개 텍스트에서 프로필 재료를 뽑는 프롬프트.
 * 없는 경력을 지어내지 않는 것이 가장 중요하다 — 근거는 원문에 있는 것만.
 */
function buildProfilePrompt(ctx: AIContext): string {
  return `너는 커리어 코치다. 아래 사용자가 붙여넣은 이력/자기소개 글에서 프로필 재료를 정리하라.

[사용자가 붙여넣은 글]
${clip(ctx.submissionText, "이력")}

다음 JSON 형식으로만 답하라.
{
  "headline": "한 줄 소개 (예: 데이터로 문제를 푸는 산업공학 3학년)",
  "summary": "2~3문장 요약",
  "skills": ["원문에서 확인되는 역량만"],
  "evidence": [
    {
      "title": "활동/프로젝트/수상 이름",
      "description": "무엇을 했고 결과가 무엇인지 (원문 근거만)",
      "skills": ["이 경험이 증명하는 역량"],
      "kind": "activity|project|award|certificate|education|work"
    }
  ]
}

원칙:
- 원문에 없는 경험·수치·기관을 만들어내지 마라. 확실하지 않으면 넣지 마라.
- 한 줄짜리 나열도 근거가 될 수 있으면 evidence 로 만들어라.
- skills 는 일반적인 역량 이름으로 표준화하라 (예: "파이썬" → "Python").`;
}

/**
 * 면접 예상 질문.
 * 공고·평가 기준뿐 아니라 지원자가 쓴 자기소개서 답변까지 근거로 삼아,
 * "그 사람에게만 나올 질문"이 나오게 한다.
 */
function buildInterviewPrompt(ctx: AIContext): string {
  return `너는 채용·선발 면접관이다. 아래 자료를 읽고 이 지원자에게 실제로 나올 만한 면접 질문을 만들어라.

[활동] ${ctx.activityName} (${ctx.activityType})${ctx.organizer ? ` · 주최 ${ctx.organizer}` : ""}

[공고]
${ctx.announcementText.slice(0, 4000) || "(없음)"}

[평가 기준]
${ctx.criteria.map((c) => `- ${c.name} (${c.weight})`).join("\n") || "(없음)"}

[지원자가 제출한 글 · 자기소개서 답변]
${ctx.submissionText.slice(0, 6000) || "(없음)"}

[지원자 프로필]
${ctx.userProfile || "(없음)"}

규칙:
- 지원자가 쓴 문장에서 파고들 만한 지점을 찾아 구체적으로 물어라. 일반론적인 질문만 나열하지 마라.
- 답하기 곤란한 지점(수치 근거 부족, 역할이 모호한 부분)도 포함하라.
- 10~14개를 만들어라.
- why 에는 왜 이 질문이 나올지, hint 에는 답변에 반드시 담아야 할 포인트를 적어라.
- 없는 사실을 지어내지 마라. 자료에 없으면 "자료에 없음"이라고 적어라.

JSON 만 출력하라:
{"questions":[{"question":"...","why":"...","hint":"..."}]}`;
}
