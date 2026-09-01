import "server-only";
import type { AIAction } from "@/lib/constants";
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
    case "expected_questions":
      return buildAdvicePrompt(
        ctx,
        "이 제출물로 발표/면접을 한다고 가정하고 심사위원이 던질 만한 예상 질문 15~20개를 생성하라. 평가 기준과 연결된 질문을 포함하라.",
        false,
      );
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
