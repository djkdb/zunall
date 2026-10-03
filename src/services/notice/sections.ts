/**
 * 공고문 섹션 읽기 (순수 함수 — 테스트 가능).
 *
 * 공고문은 "지원 자격 / 제출 서류 / 심사 기준" 처럼 머리글로 나뉜다.
 * 원하는 머리글 아래 목록만 정확히 읽어야 준비 시간 계산과 지원 판단이 맞는다.
 */

/**
 * 공고문에서 자주 쓰는 섹션 머리글.
 * 기호(■, 【) 없이 한 줄로만 오는 경우가 많다. 특히 웹페이지에서 가져오면
 * <h2>심사 기준</h2> 가 그냥 "심사 기준" 한 줄이 된다. 기호만 경계로 보면
 * 제출 서류 목록을 읽다가 심사 기준까지 넘어가 버린다.
 */
const SECTION_HEADINGS = [
  "개요", "모집 개요", "공모 개요", "공모 주제", "주제", "목적",
  "지원 자격", "지원자격", "참가 자격", "응모 자격", "자격 요건", "모집 대상", "참가 대상", "지원 대상",
  "접수 기간", "접수기간", "접수 안내", "접수 방법", "신청 방법", "지원 방법", "모집 기간", "일정", "주요 일정", "추진 일정",
  "제출물", "제출 서류", "제출서류", "제출 형식", "제출 방법",
  "심사 기준", "평가 기준", "심사 방법", "평가 방법", "심사 절차", "선발 절차", "전형 절차", "배점",
  "시상", "시상 내역", "혜택", "활동 혜택", "우대", "우대사항", "우대 사항",
  "활동 내용", "주요 업무", "담당 업무", "역할",
  "유의사항", "유의 사항", "주의사항", "주의 사항", "문의", "문의처", "기타",
];
const HEADING_SET = new Set(SECTION_HEADINGS.map((h) => h.replace(/\s/g, "")));

/** 이 줄이 다음 섹션의 머리글인가 */
export function isSectionHeading(line: string): boolean {
  if (/^[■□◆▶►●#【\[]/.test(line)) return true;
  const bare = line
    .replace(/^[\d.)\s]+/, "") // "3. 심사 기준" 같은 번호
    .replace(/[:：]\s*$/, "") // "심사 기준:" 의 끝 콜론
    .replace(/\s/g, "");
  return bare.length > 0 && bare.length <= 10 && HEADING_SET.has(bare);
}

/** "참가신청서, 아이디어 기획서(PDF, 15p 이내)" → 괄호 안 쉼표는 두고 나눈다 */
export function splitListLine(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of line) {
    if ("([{（".includes(ch)) depth++;
    if (")]}）".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || ch === "、")) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * 키워드가 나온 줄 아래의 목록을 읽는다. 다음 섹션 머리글을 만나면 멈춘다.
 * split: 한 줄에 쉼표로 여러 개를 적는 항목(제출 서류 등)은 나눠서 센다.
 */
export function extractListNear(
  text: string,
  keywords: string[],
  max = 6,
  { split = false }: { split?: boolean } = {},
): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  const push = (raw: string) => {
    const pieces = split ? splitListLine(raw) : [raw];
    for (const piece of pieces) {
      const item = piece.replace(/^[-•*·▶►○●\d.)\s]+/, "").trim();
      // 나눈 조각은 "이력서"처럼 짧을 수 있다
      if (item.length >= (split ? 2 : 4) && item.length <= 120 && !out.includes(item)) out.push(item);
    }
  };

  let capture = false;
  let captureRemaining = 0;
  for (const line of lines) {
    if (out.length >= max) break;
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (keywords.some((k) => trimmed.includes(k))) {
      capture = true;
      captureRemaining = 8;
      // "제출 서류: 이력서, 자기소개서" 처럼 머리글 줄에 내용이 같이 오는 경우
      const inline = trimmed.split(/[:：]/).slice(1).join(":").trim();
      if (inline.length >= 2) push(inline);
      continue;
    }
    if (capture && captureRemaining > 0) {
      // 다음 섹션 머리글을 만나면 수집 종료 — 섹션 경계를 넘지 않는다
      if (isSectionHeading(trimmed)) {
        capture = false;
        continue;
      }
      captureRemaining--;
      push(trimmed);
    }
  }
  return out.slice(0, max);
}

/** 공고문에서 활동 종류를 짐작한다 (AI 없이도 동작해야 하는 첫 추정) */
export function guessActivityType(text: string): string {
  // 제목 줄이 가장 정확하다. 본문 전체로 먼저 보면 "수상팀 인턴 지원 시 우대" 같은
  // 혜택 문구 때문에 공모전이 인턴으로 분류됐다.
  const title = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return matchActivityType(title) ?? matchActivityType(text) ?? "etc";
}

function matchActivityType(text: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/해커톤|hackathon/i, "hackathon"],
    [/서포터즈|기자단|앰버서더|앰배서더|홍보대사/, "supporters"],
    [/인턴/, "intern"],
    [/신입\s*채용|경력\s*채용|채용\s*공고/, "recruit"],
    [/자격증|자격\s*시험|능력\s*검정|검정\s*시험|필기\s*시험|실기\s*시험|시험\s*접수|토익|토플|지도사\s*\d\s*급/, "exam"],
    [/부트캠프|교육\s*과정|아카데미|캠프/, "education"],
    [/오픈소스|open ?source|컨트리뷰션/i, "opensource"],
    [/공모전|경진대회|아이디어\s*공모|대회/, "contest"],
    // 공모전 뒤에 둔다 — "공연 공모전"은 공모전이고, "가요제 본선 오디션"은 무대다
    [/오디션|개인전|단체전|아트페어|전시|공연|연주회|리사이틀|가요제/, "performance"],
    [/봉사|실습/, "volunteer"],
    [/대외활동|동아리/, "external"],
    [/프로젝트/, "project"],
  ];
  for (const [pattern, type] of rules) {
    if (pattern.test(text)) return type;
  }
  return null;
}
