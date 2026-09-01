import "server-only";
import type { AIProvider, AIRequest, AIContext } from "./provider";
import type {
  AnnouncementSummary,
  EvaluationResult,
  FinalCheckResult,
  AdviceResult,
  OpportunityRequirements,
} from "./schemas";
import { detectSkills } from "@/services/career/skill-detect";

/**
 * Claude CLI가 없는 개발/데모 환경용 Mock provider.
 * 단순 고정 응답이 아니라, 업로드된 문서 텍스트를 휴리스틱으로 분석해
 * (날짜/평가 기준 추출, 결정적 점수 생성 등) 실제와 유사한 결과를 만든다.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async complete(request: AIRequest): Promise<string> {
    // 실제 AI 실행처럼 약간의 지연
    await new Promise((r) => setTimeout(r, 400));

    const ctx = request.context;
    switch (request.action) {
      case "analyze_announcement":
      case "extract_criteria":
        return JSON.stringify(analyzeAnnouncement(ctx));
      case "analyze_opportunity":
        return JSON.stringify(analyzeOpportunity(ctx));
      case "evaluate_submission":
        return JSON.stringify(evaluateSubmission(ctx));
      case "final_check":
        return JSON.stringify(finalCheck(ctx));
      case "fit_analysis":
        return JSON.stringify(fitAnalysis(ctx));
      case "proofread":
        return JSON.stringify(proofread(ctx));
      case "improvements":
        return JSON.stringify(improvements(ctx));
      case "expected_questions":
        return JSON.stringify(expectedQuestions(ctx));
      default:
        return JSON.stringify(improvements(ctx));
    }
  }
}

// ─── 유틸 ────────────────────────────────────────────────────

/** 문자열 해시 (결정적 점수 생성용) */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** min~max 사이의 결정적 값 */
function seeded(seed: string, min: number, max: number): number {
  return min + (hash(seed) % 1000) / 1000 * (max - min);
}

const DATE_PATTERNS = [
  /(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?/g,
];

function findDatesNear(text: string, keywords: string[]): string | null {
  const lines = text.split("\n");
  for (const line of lines) {
    if (!keywords.some((k) => line.includes(k))) continue;
    for (const pattern of DATE_PATTERNS) {
      // "2026.08.20 ~ 2026.09.20" 같은 기간 표기는 마지막 날짜(종료일)가 마감이다.
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        const [, y, mo, d] = matches[matches.length - 1];
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
  }
  return null;
}

/** "아이디어 30점", "창의성(20%)", "실현 가능성 25" 등의 평가 기준 패턴 추출 */
function extractCriteriaFromText(
  text: string,
): Array<{ name: string; weight: number; description: string | null; source: "official" }> {
  const results: Array<{ name: string; weight: number; description: string | null; source: "official" }> = [];
  const seen = new Set<string>();
  // 기준명과 배점은 같은 줄에 있어야 한다 (줄바꿈을 넘는 오탐 방지)
  const pattern =
    /([가-힣A-Za-z][가-힣A-Za-z ·]{1,20}?)[ \t]*[(:]?[ \t]*(\d{1,3})[ \t]*[%점]/g;
  const stopwords = ["페이지", "이내", "이하", "이상", "년", "월", "일", "명", "개", "시", "분", "mb", "MB"];

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null && results.length < 10) {
    const name = m[1].trim().replace(/\s+/g, " ");
    const weight = Number(m[2]);
    if (weight < 5 || weight > 100) continue;
    if (name.length < 2 || stopwords.some((w) => name.includes(w))) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ name, weight, description: null, source: "official" });
  }

  // 합계가 100에 가까운 부분집합만 신뢰 (공고의 배점표일 가능성)
  const total = results.reduce((s, c) => s + c.weight, 0);
  if (results.length >= 2 && total >= 80 && total <= 120) return results;
  if (results.length >= 3) return results;
  return [];
}

function extractListNear(text: string, keywords: string[], max = 6): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  let capture = false;
  let captureRemaining = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (keywords.some((k) => trimmed.includes(k))) {
      capture = true;
      captureRemaining = 8;
      continue;
    }
    if (capture && captureRemaining > 0) {
      // 다음 섹션 머리글(■, 【 등)을 만나면 수집 종료 — 섹션 경계를 넘지 않는다.
      if (/^[■□◆▶►●#【\[]/.test(trimmed)) break;
      captureRemaining--;
      const item = trimmed.replace(/^[-•*·▶►○●\d.)\s]+/, "").trim();
      if (item.length >= 4 && item.length <= 120) out.push(item);
      if (out.length >= max) break;
    }
  }
  return out;
}

// ─── 액션별 결과 생성 ────────────────────────────────────────

function analyzeAnnouncement(ctx: AIContext): AnnouncementSummary {
  const text = ctx.announcementText;
  const hasText = text.trim().length > 50;

  const applyDeadline = findDatesNear(text, ["지원 마감", "접수 마감", "접수기간", "접수 기간", "모집 마감", "신청 마감"]);
  const submitDeadline = findDatesNear(text, ["제출 마감", "제출기한", "제출 기한", "최종 제출", "결과물 제출"]);
  const announceDate = findDatesNear(text, ["발표", "결과 발표", "수상자 발표", "합격자 발표"]);

  const criteria = hasText ? extractCriteriaFromText(text) : [];
  const requirements = hasText
    ? extractListNear(text, ["제출물", "제출 서류", "제출서류", "필수 제출", "제출 형식"])
    : [];
  const cautions = hasText
    ? extractListNear(text, ["유의사항", "유의 사항", "주의사항", "주의 사항"])
    : [];
  const prizes = hasText ? extractListNear(text, ["시상", "상금", "혜택"], 5) : [];
  const eligibility = hasText ? extractListNear(text, ["지원 자격", "참가 자격", "참가대상", "참가 대상", "지원자격"], 4) : [];

  const schedule: AnnouncementSummary["schedule"] = [];
  if (applyDeadline) schedule.push({ label: "지원 마감", date: applyDeadline });
  if (submitDeadline) schedule.push({ label: "최종 제출", date: submitDeadline });
  if (announceDate) schedule.push({ label: "결과 발표", date: announceDate });

  const summaryParts: string[] = [];
  if (hasText) {
    summaryParts.push(
      `"${ctx.activityName}" 공고 문서(${Math.round(text.length / 100) / 10}천자)를 분석했습니다.`,
    );
    summaryParts.push(
      criteria.length > 0
        ? `배점표에서 평가 기준 ${criteria.length}개를 발견했습니다.`
        : "명시적인 배점표를 찾지 못했습니다. 평가 기준을 직접 추가하거나 문서를 확인해주세요.",
    );
    if (schedule.length > 0) summaryParts.push(`주요 일정 ${schedule.length}건을 추출했습니다.`);
  } else {
    summaryParts.push(
      "분석할 공고 문서 텍스트가 없습니다. '공고 / 안내' 분류로 PDF 등의 문서를 업로드한 뒤 다시 실행해주세요.",
    );
  }

  return {
    summary: summaryParts.join(" "),
    schedule,
    eligibility,
    requirements,
    criteria,
    cautions,
    prizes,
    keyDates: { applyDeadline, submitDeadline, announceDate },
  };
}

function analyzeOpportunity(ctx: AIContext): OpportunityRequirements {
  const text = ctx.announcementText;
  const hasText = text.trim().length > 50;
  const base = hasText ? text : `${ctx.activityName} ${ctx.organizer ?? ""}`;

  // 우대 섹션과 본문을 분리해 감지 정확도를 높인다
  const preferredSection = hasText
    ? extractListNear(text, ["우대", "우대사항", "우대 사항", "이런 분이면 좋아요"]).join("\n")
    : "";
  const allSkills = detectSkills(base, 8);
  const preferredDetected = preferredSection ? detectSkills(preferredSection, 4) : [];
  const requiredSkills = allSkills.filter((s) => !preferredDetected.includes(s)).slice(0, 6);

  const qualifications = hasText
    ? extractListNear(text, ["지원 자격", "지원자격", "참가 자격", "참가 대상", "모집 대상", "자격 요건"], 5)
    : [];
  const responsibilities = hasText
    ? extractListNear(text, ["주요 업무", "담당 업무", "활동 내용", "역할", "하는 일", "미션"], 5)
    : [];
  const submissionItems = hasText
    ? extractListNear(text, ["제출물", "제출 서류", "제출서류", "필수 제출", "제출 형식"], 5)
    : [];

  return {
    summary: hasText
      ? `공고 문서에서 요구 역량 ${requiredSkills.length}개${preferredDetected.length > 0 ? `, 우대 역량 ${preferredDetected.length}개` : ""}를 감지했습니다.`
      : "공고 문서가 없어 활동 이름·주최 정보만으로 추정했습니다. '공고 / 안내' 문서를 업로드하면 훨씬 정확해집니다.",
    requiredSkills,
    preferredSkills: preferredDetected,
    responsibilities,
    qualifications,
    submissionItems,
    keywords: allSkills,
  };
}

const STRENGTH_TEMPLATES: Record<string, string[]> = {
  default: [
    "핵심 주제에 대한 이해가 문서 전반에 드러납니다.",
    "구성이 논리적 순서를 따르고 있어 읽기 수월합니다.",
    "활동의 목적과 제출물의 방향이 일치합니다.",
  ],
  data: [
    "구체적인 수치와 데이터가 주장을 뒷받침하고 있습니다.",
    "정량적 근거 제시가 설득력을 높입니다.",
  ],
  user: [
    "사용자 관점의 서술이 포함되어 실용성이 느껴집니다.",
    "타깃 사용자를 의식한 문제 정의가 명확합니다.",
  ],
};

const WEAKNESS_TEMPLATES: Record<string, string[]> = {
  short: [
    "분량이 적어 세부 내용의 깊이가 부족해 보입니다.",
    "핵심 주장에 대한 부연 설명이 더 필요합니다.",
  ],
  noData: [
    "정량적 근거(수치, 데이터, KPI)가 부족합니다.",
    "예상 효과를 구체적인 숫자로 제시하면 설득력이 높아집니다.",
  ],
  noUser: [
    "실제 사용자 검증(인터뷰, 설문) 결과가 보이지 않습니다.",
    "경쟁 사례와의 차별점 비교가 부족합니다.",
  ],
};

function textFeatures(text: string) {
  return {
    isShort: text.length < 1500,
    hasNumbers: /\d{2,}[%명개건원]|KPI|지표/.test(text),
    hasUser: /사용자|고객|인터뷰|설문|검증|타깃|타겟/.test(text),
  };
}

function evaluateSubmission(ctx: AIContext): EvaluationResult {
  // 평가 기준: 등록된 기준 사용, 없으면 추론 기준(명시적으로 inferred 표기)
  const officialCriteria = ctx.criteria.filter((c) => c.weight > 0);
  const usingInferred = officialCriteria.length === 0;
  const criteriaList = usingInferred
    ? [
        { name: "문제 정의·목적 적합성", weight: 30, source: "inferred" },
        { name: "내용의 구체성", weight: 30, source: "inferred" },
        { name: "구성·완성도", weight: 25, source: "inferred" },
        { name: "전달력", weight: 15, source: "inferred" },
      ]
    : officialCriteria;

  const text = ctx.submissionText;
  const feat = textFeatures(text);
  const seedBase = `${ctx.activityName}:${text.length}:${text.slice(0, 400)}`;

  const items = criteriaList.map((criterion) => {
    // 기본 68~90% 범위의 결정적 점수 + 텍스트 특성 보정
    let ratio = seeded(`${seedBase}:${criterion.name}`, 0.68, 0.9);
    if (feat.isShort) ratio -= 0.07;
    if (feat.hasNumbers) ratio += 0.04;
    if (feat.hasUser) ratio += 0.03;
    ratio = Math.max(0.4, Math.min(0.95, ratio));

    const maxScore = criterion.weight;
    const score = Math.round(maxScore * ratio * 10) / 10;

    const strengths = [...STRENGTH_TEMPLATES.default.slice(0, 1)];
    if (feat.hasNumbers) strengths.push(STRENGTH_TEMPLATES.data[0]);
    if (feat.hasUser) strengths.push(STRENGTH_TEMPLATES.user[0]);

    const weaknesses: string[] = [];
    if (feat.isShort) weaknesses.push(WEAKNESS_TEMPLATES.short[0]);
    if (!feat.hasNumbers) weaknesses.push(WEAKNESS_TEMPLATES.noData[0]);
    if (!feat.hasUser) weaknesses.push(WEAKNESS_TEMPLATES.noUser[0]);
    if (weaknesses.length === 0) {
      weaknesses.push("세부 실행 계획의 일정·리소스 산정이 더 구체적이면 좋겠습니다.");
    }

    const recommendations = weaknesses.map((w) =>
      w.includes("정량적") || w.includes("숫자")
        ? "핵심 지표(KPI) 2~3개와 예상 수치를 표로 정리해 추가하세요."
        : w.includes("사용자") || w.includes("경쟁")
          ? "사용자 인터뷰 3~5건 또는 경쟁 사례 비교표를 추가하세요."
          : "해당 항목과 직접 연결되는 근거 문단을 1~2개 보강하세요.",
    );

    return {
      name: criterion.name,
      score,
      max_score: maxScore,
      source: (criterion.source === "official" ? "official" : "inferred") as "official" | "inferred",
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 3),
      recommendations: Array.from(new Set(recommendations)).slice(0, 3),
    };
  });

  const maxTotal = items.reduce((s, i) => s + i.max_score, 0);
  const total = Math.round(items.reduce((s, i) => s + i.score, 0) * 10) / 10;

  const criticalIssues: string[] = [];
  if (feat.isShort) criticalIssues.push("제출물 분량이 적어 평가 기준 충족 여부를 판단하기 어렵습니다.");
  if (usingInferred)
    criticalIssues.push(
      "공식 평가 기준이 등록되어 있지 않아 일반적인 기준으로 평가했습니다. 공고문 분석으로 기준을 추출하거나 직접 등록해주세요.",
    );

  const nextActions = [
    !feat.hasUser ? "사용자 인터뷰/설문 결과 추가하기" : null,
    !feat.hasNumbers ? "핵심 KPI와 예상 효과 수치화하기" : null,
    "경쟁 서비스·유사 사례 비교표 작성하기",
  ].filter((x): x is string => x !== null);

  return {
    overall_score: total,
    max_score: maxTotal,
    confidence: usingInferred ? 0.45 : 0.75,
    criteria: items,
    summary: `${ctx.submissionTitle ?? "제출물"}을 ${usingInferred ? "일반 기준(추론)" : "등록된 공식 평가 기준"}에 따라 평가한 결과 ${total}/${maxTotal}점으로 추정됩니다. ${
      feat.hasUser && feat.hasNumbers
        ? "근거와 사용자 관점이 잘 갖춰져 있습니다."
        : "정량 근거와 사용자 검증을 보강하면 점수를 더 끌어올릴 수 있습니다."
    }`,
    critical_issues: criticalIssues,
    next_actions: nextActions,
  };
}

function finalCheck(ctx: AIContext): FinalCheckResult {
  const text = ctx.submissionText;
  const feat = textFeatures(text);
  const hasFile = text.trim().length > 0 || (ctx.submissionTitle ?? "") !== "";
  const extra = ctx.extraInstruction ?? "";
  // 플래그는 [토큰] 형태로만 판별 (설명 문구의 단어와 혼동 방지)
  const sizeOk = !extra.includes("[SIZE_OVER]");
  const deadlinePassed = extra.includes("[DEADLINE_PASSED]");
  const deadlineSoon = extra.includes("[DEADLINE_SOON]");

  const checks: FinalCheckResult["checks"] = [
    {
      label: "제출 파일 존재",
      status: hasFile ? "pass" : "fail",
      detail: hasFile ? "제출물 버전 파일이 업로드되어 있습니다." : "업로드된 제출물 파일이 없습니다.",
    },
    {
      label: "파일 크기",
      status: sizeOk ? "pass" : "warn",
      detail: sizeOk ? "허용 범위 이내입니다." : "파일 크기가 큽니다. 공고의 용량 제한을 확인하세요.",
    },
    {
      label: "제출 마감 확인",
      status: deadlinePassed ? "fail" : deadlineSoon ? "warn" : "pass",
      detail: deadlinePassed
        ? "제출 마감일이 이미 지났습니다!"
        : deadlineSoon
          ? "마감이 임박했습니다. 여유를 두고 제출하세요."
          : "마감까지 시간이 남아 있습니다.",
    },
    {
      label: "평가 기준 대응",
      status: ctx.criteria.length > 0 ? (feat.isShort ? "warn" : "pass") : "warn",
      detail:
        ctx.criteria.length > 0
          ? feat.isShort
            ? "등록된 평가 기준 대비 내용 분량이 부족해 보입니다."
            : "등록된 평가 기준을 다룰 수 있는 분량입니다."
          : "평가 기준이 등록되어 있지 않아 충족 여부를 확인할 수 없습니다.",
    },
    {
      label: "정량 근거 포함",
      status: feat.hasNumbers ? "pass" : "warn",
      detail: feat.hasNumbers ? "수치 기반 근거가 포함되어 있습니다." : "수치·데이터 근거가 부족합니다.",
    },
    {
      label: "개인정보 노출 위험",
      status: /\d{6}[-\s]?\d{7}|\d{3}-\d{3,4}-\d{4}/.test(text) ? "warn" : "pass",
      detail: /\d{6}[-\s]?\d{7}|\d{3}-\d{3,4}-\d{4}/.test(text)
        ? "주민등록번호/전화번호로 보이는 패턴이 감지되었습니다. 제출 전 확인하세요."
        : "명시적인 개인정보 패턴이 감지되지 않았습니다.",
    },
  ];

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const score = Math.max(0, 100 - failCount * 30 - warnCount * 8);

  return {
    score,
    checks,
    summary:
      failCount > 0
        ? `치명적인 문제 ${failCount}건이 발견되었습니다. 해결 후 제출하세요.`
        : warnCount > 0
          ? `제출은 가능하지만 ${warnCount}건의 수정 권장 사항이 있습니다.`
          : "제출 준비가 잘 되어 있습니다. 마지막으로 파일을 직접 열어 확인 후 제출하세요.",
    recommendations: checks
      .filter((c) => c.status !== "pass")
      .map((c) => `${c.label}: ${c.detail}`),
  };
}

function fitAnalysis(ctx: AIContext): AdviceResult {
  const hasAnnouncement = ctx.announcementText.trim().length > 50;
  const score = Math.round(seeded(`${ctx.activityName}:fit:${ctx.userProfile}`, 62, 88));
  return {
    headline: `${ctx.activityName} 적합도 분석`,
    summary: hasAnnouncement
      ? `공고 내용과 활동 정보를 기준으로 본 적합도는 약 ${score}점입니다. 아래 강조 포인트를 지원서에 반영해보세요.`
      : `공고 문서가 없어 활동 기본 정보만으로 분석했습니다 (신뢰도 낮음). 공고문을 업로드하면 더 정확해집니다.`,
    score,
    sections: [
      {
        heading: "이 활동에서 중요해 보이는 것",
        items:
          ctx.criteria.length > 0
            ? ctx.criteria.slice(0, 4).map((c) => `${c.name} (배점 ${c.weight}) — 관련 경험을 앞부분에 배치하세요.`)
            : [
                "활동 유형상 실행력과 결과물 완성도가 중요할 가능성이 높습니다.",
                "공고문을 업로드하고 '평가 기준 추출'을 실행하면 근거 기반 분석이 가능합니다.",
              ],
      },
      {
        heading: "강조하면 좋은 포인트",
        items: [
          "관련 프로젝트/활동 경험을 결과 중심(숫자)으로 서술",
          "이 활동의 주최기관 성격에 맞는 관심사 연결",
          "팀 활동이라면 협업 역할과 기여도를 구체적으로",
        ],
      },
      {
        heading: "보완이 필요한 부분",
        items: [
          "지원 자격 요건 충족 여부를 공고 원문에서 직접 확인하세요.",
          "제출 서류 목록을 체크리스트로 만들어 누락을 방지하세요.",
        ],
      },
    ],
    next_actions: ["지원서 초안 작성", "필수 제출 서류 체크리스트 만들기"],
  };
}

function proofread(ctx: AIContext): AdviceResult {
  const text = ctx.submissionText;
  const feat = textFeatures(text);
  const longSentences = text
    .split(/[.!?。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 90).length;

  return {
    headline: "문서 첨삭 결과",
    summary: `${ctx.submissionTitle ?? "문서"}를 검토했습니다. 구조·근거·문장 측면의 개선 포인트를 정리했습니다.`,
    score: null,
    sections: [
      {
        heading: "구조",
        items: [
          "문제 정의 → 해결책 → 근거 → 기대 효과의 흐름이 유지되는지 확인하세요.",
          "각 섹션 첫 문장에 해당 섹션의 결론을 배치하면 심사자가 빠르게 파악할 수 있습니다.",
        ],
      },
      {
        heading: "내용 보강",
        items: [
          ...(!feat.hasNumbers ? ["주장을 뒷받침할 수치·데이터가 부족합니다. 최소 2~3개의 정량 근거를 추가하세요."] : []),
          ...(!feat.hasUser ? ["사용자/고객 관점의 검증 근거(인터뷰, 설문)를 추가하세요."] : []),
          ...(feat.isShort ? ["분량이 적습니다. 핵심 섹션에 부연 설명과 사례를 보강하세요."] : []),
          "경쟁/유사 사례와의 차별점을 한 문단으로 명확히 정리하세요.",
        ],
      },
      {
        heading: "문장",
        items: [
          longSentences > 0
            ? `90자 이상의 긴 문장이 ${longSentences}개 있습니다. 두 문장으로 나누는 것을 권장합니다.`
            : "문장 길이는 적절합니다.",
          "동일 어미(-습니다) 반복을 줄이면 리듬감이 좋아집니다.",
          "제출 전 맞춤법 검사기를 한 번 돌려보세요.",
        ],
      },
    ],
    next_actions: ["지적된 섹션 보강 후 새 버전 업로드", "AI 평가 다시 실행해 점수 변화 확인"],
  };
}

function improvements(ctx: AIContext): AdviceResult {
  const feat = textFeatures(ctx.submissionText);
  return {
    headline: "개선점 분석",
    summary: "현재 자료에서 우선적으로 개선하면 효과가 큰 순서로 정리했습니다.",
    score: null,
    sections: [
      {
        heading: "우선순위 높음",
        items: [
          ...(!feat.hasUser ? ["실제 사용자 검증 결과 추가 (인터뷰 3~5명 또는 설문 30명 이상)"] : []),
          ...(!feat.hasNumbers ? ["핵심 KPI 정의와 예상 효과 수치화"] : []),
          "평가 기준 배점이 큰 항목에 대응하는 섹션 분량 늘리기",
        ],
      },
      {
        heading: "우선순위 중간",
        items: [
          "경쟁 서비스 비교표 삽입",
          "실행 일정(로드맵)과 필요한 리소스 명시",
          "발표용 요약 슬라이드 1장 준비",
        ],
      },
      {
        heading: "마무리 단계",
        items: ["오탈자·서식 통일 점검", "파일명 규칙 및 제출 형식 확인", "제출 전 최종 검토(Final Check) 실행"],
      },
    ],
    next_actions: ["우선순위 높음 항목을 작업(Task)으로 등록", "보완 후 새 버전 업로드"],
  };
}

function expectedQuestions(ctx: AIContext): AdviceResult {
  const base = [
    "이 아이디어를 시작하게 된 계기는 무엇인가요?",
    "타깃 사용자를 어떻게 정의했고, 왜 그들이 이 서비스를 쓸까요?",
    "경쟁 서비스와의 핵심 차별점 한 가지만 꼽는다면?",
    "가장 큰 리스크는 무엇이고 어떻게 대응할 계획인가요?",
    "제한된 기간 안에 무엇까지 구현/검증했나요?",
    "수익 모델 또는 지속 가능성은 어떻게 확보하나요?",
    "이 결과물에서 본인이 직접 기여한 부분은 어디인가요?",
    "실제 사용자 반응 중 가장 인상 깊었던 피드백은?",
    "다음 단계로 무엇을 개선할 계획인가요?",
    "성공 여부를 판단할 핵심 지표는 무엇인가요?",
  ];
  const criteriaQs = ctx.criteria
    .slice(0, 5)
    .map((c) => `평가 기준 "${c.name}"(배점 ${c.weight}) 관점에서 이 결과물의 강점을 설명해보세요.`);

  return {
    headline: "예상 질문 리스트",
    summary: "발표·면접에서 나올 법한 질문을 평가 기준과 일반 심사 관점에서 생성했습니다.",
    score: null,
    sections: [
      { heading: "핵심 질문", items: base.slice(0, 5) },
      ...(criteriaQs.length > 0 ? [{ heading: "평가 기준 기반 질문", items: criteriaQs }] : []),
      { heading: "심화 질문", items: base.slice(5) },
    ],
    next_actions: ["질문별 30초 답변 스크립트 작성", "팀원과 모의 Q&A 진행"],
  };
}
