/**
 * Question similarity used by the data pipeline (dedupe) and at runtime
 * (the interviewer must never repeat itself).
 *
 * Two signals are combined:
 *  - lexical: character-bigram Jaccard — robust for Korean, which has no reliable word boundaries;
 *  - semantic: canonical concept tokens — particles and request endings are stripped and synonyms are
 *    folded ("팀원/동료", "갈등/의견 충돌", "경험/사례"), plus the question's frame (past experience vs
 *    hypothetical vs opinion), so that different wordings of the same question collide while
 *    "an experience of X" and "what would you do if X" stay distinct.
 */

const STRIP = /[\s"'“”‘’`.,!?…·:;()[\]{}\-_/~]+/g;

export function bigrams(text: string): Set<string> {
  const s = text.toLowerCase().replace(STRIP, "");
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

const jaccard = <T>(A: Set<T>, B: Set<T>): number => {
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};

/** Character-bigram Jaccard similarity (0–1). */
export function lexicalSimilarity(a: string, b: string): number {
  return jaccard(bigrams(a), bigrams(b));
}

/* ───────────────────────────── semantic tokens ───────────────────────── */

/** Synonym groups → canonical concept. Order matters: longer phrases first. */
const SYNONYMS: [RegExp, string][] = [
  [/의견\s?(?:충돌|차이|대립|불일치)|갈등|마찰|불화|다툼|충돌|이견|disagree\w*|conflict/g, "갈등"],
  [/팀\s?동료|팀원|동료|협업자|같이\s?일한\s?사람|teammates?|colleagues?|co-?workers?/g, "동료"],
  [/상사|관리자|팀장|선배|매니저|상급자|manager|supervisor|boss/g, "상사"],
  [/고객|손님|클라이언트|이용자|소비자|customer|client/g, "고객"],
  [/실패|실수|좌절|잘못|failure|mistake/g, "실패"],
  [/성공|성취|해낸|자랑스러운|achievement|success/g, "성공"],
  [/강점|장점|잘하는\s?점|strength/g, "강점"],
  [/약점|단점|부족한\s?점|보완할\s?점|weakness/g, "약점"],
  [/지원\s?동기|지원한\s?이유|지원하신\s?이유|선택한\s?이유|선택하신\s?이유|why\s+(?:do\s+you\s+)?want|why\s+did\s+you\s+(?:apply|choose)/g, "지원동기"],
  [/자기\s?소개|introduce\s+yourself|about\s+yourself/g, "자기소개"],
  [/리더십|리더|이끌|주도|leadership|lead/g, "리더십"],
  [/우선\s?순위|priorit\w*/g, "우선순위"],
  [/마감|기한|데드라인|일정|납기|deadline|timeline/g, "일정"],
  [/스트레스|압박감|stress/g, "스트레스"],
  [/부당한\s?지시|부당한\s?요구|unfair\s+instruction/g, "부당지시"],
  [/윤리|부정|비리|청렴|ethic\w*|integrity/g, "윤리"],
  [/성장|발전|배운\s?점|배운\s?것|배우신|learn\w*|grow\w*/g, "성장"],
  [/목표|goal/g, "목표"],
  [/피드백|조언|feedback/g, "피드백"],
  [/설득|납득|persuad\w*|convinc\w*/g, "설득"],
  [/소통|커뮤니케이션|의사소통|communicat\w*/g, "소통"],
  [/문제\s?해결|해결|solv\w*|resolv\w*/g, "해결"],
  [/개선|향상|혁신|improv\w*/g, "개선"],
  [/5년\s?(?:후|뒤)|10년\s?(?:후|뒤)|입사\s?후\s?(?:목표|계획|포부)|five\s+years/g, "미래계획"],
  [/성과|결과|임팩트|impact|result/g, "성과"],
];

/** Question frame: past experience, hypothetical, or view/knowledge. */
function frameOf(q: string): string {
  if (/만약|라면|다면|하시겠|하겠습니까|하실\s?건가|would\s+you|if\s+you|what\s+if/i.test(q)) return "#hyp";
  if (/경험|사례|적이?\s?있|했던|있었던|하셨던|tell\s+me\s+about\s+a\s+time|describe\s+a\s+time|have\s+you\s+ever/i.test(q)) return "#exp";
  return "#view";
}

/** Words that carry no meaning for "is this the same question". */
const STOP = new Set(
  (
    "무엇 무엇인가요 무엇입니까 어떤 어떻게 어떠한 왜 언제 어디 누구 가장 좀 조금 그 이 저 그것 이것 본인 지원자 지원자님 " +
    "말씀 말씀해 말해 설명 설명해 소개 소개해 이야기 주세요 주시겠어요 주시겠습니까 부탁 부탁드립니다 드립니다 " +
    "있나요 있습니까 있으신가요 있다면 있으면 했나요 하셨나요 하시나요 생각 생각하시나요 생각하십니까 생각하는지 " +
    "경험 사례 적 때 경우 것 수 등 및 또는 혹은 하나 한 가지 대해 대한 관련 통해 위해 " +
    "what how why when which who tell me about describe explain your you a an the of to in on for with did do does have has is are was were can could would"
  ).split(/\s+/),
);

const PARTICLE = /(?:으로써|으로서|에서는|에게서|으로는|이라는|라는|이라고|라고|에서|에게|께서|부터|까지|처럼|보다|으로|하고|이나|이랑|랑|과|와|을|를|이|가|은|는|의|에|도|로|만|요)$/u;
const ENDING = /(?:하셨던|했던|있었던|생겼던|겪었던|하였던|하신|하는|했던|하던|되었던|되는|된|한|할|하게|해서|하며|하면서|하고|했을|하셨을|하셨는지|했는지|인지|는지|던)$/u;

/** Predicate endings: "분석하시겠습니까" → "분석", "말해 주세요" → "말". */
const PREDICATE = /(?:하시겠습니까|하시겠어요|하겠습니까|하겠어요|하시나요|하셨나요|하십니까|했나요|하나요|합니까|해\s?주세요|해\s?주시겠어요|해\s?주시겠습니까|주세요|주시겠어요|주시겠습니까|드립니다|습니까|십니까|세요|어요|아요|나요|까요|가요|인가요|입니까|는가요|한다면|했다면|된다면|다면|라면|는지요?)$/u;

function stem(w: string): string {
  let t = w.replace(PREDICATE, "");
  for (let i = 0; i < 2; i++) {
    const before = t;
    t = t.replace(ENDING, "").replace(PARTICLE, "");
    if (t === before || t.length <= 1) break;
  }
  return t;
}

interface Concepts {
  /** Canonical synonym concepts ("동료", "갈등"). */
  canon: Set<string>;
  /** Other content words, particles and endings stripped. */
  words: Set<string>;
  frame: string;
}

function concepts(q: string): Concepts {
  let s = q.toLowerCase();
  const canon = new Set<string>();
  for (const [re, concept] of SYNONYMS) {
    if (re.test(s)) canon.add(concept);
    re.lastIndex = 0;
    s = s.replace(re, " ");
  }
  const words = new Set<string>();
  for (const raw of s.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOP.has(raw)) continue;
    const w = stem(raw);
    if (w.length < 2 || STOP.has(w)) continue;
    words.add(w);
  }
  return { canon, words, frame: frameOf(q) };
}

/** Content words of any text (particles, endings and filler words stripped) plus synonym concepts. */
export function contentTerms(text: string): { canon: Set<string>; words: Set<string> } {
  const { canon, words } = concepts(text);
  return { canon, words };
}

/** Canonical concept tokens + other content words + frame for a question. */
export function conceptTokens(q: string): Set<string> {
  const c = concepts(q);
  return new Set([...c.canon, ...c.words, c.frame]);
}

/** Semantic similarity (0–1): Jaccard over concept tokens (frame included). */
export function semanticSimilarity(a: string, b: string): number {
  return jaccard(conceptTokens(a), conceptTokens(b));
}

/** Concept pairs that make two otherwise similar questions different ("강점" vs "약점"). */
const OPPOSITES: [string, string][] = [
  ["강점", "약점"],
  ["성공", "실패"],
];

export const LEXICAL_DUPLICATE = 0.6;

/** Precomputed form of a question, for comparing one question against thousands. */
export interface QuestionFingerprint {
  grams: Set<string>;
  canon: Set<string>;
  words: Set<string>;
  frame: string;
  all: Set<string>;
}

export function fingerprint(text: string): QuestionFingerprint {
  const c = concepts(text);
  return { grams: bigrams(text), ...c, all: new Set([...c.canon, ...c.words, c.frame]) };
}

/**
 * Same question? Lexically near-identical, or the same meaning: the same concepts in the
 * same frame ({동료, 갈등, #exp}), unless they are opposites ("강점" vs "약점").
 */
export function sameQuestion(A: QuestionFingerprint, B: QuestionFingerprint): boolean {
  for (const [x, y] of OPPOSITES) {
    if ((A.canon.has(x) && B.canon.has(y) && !A.canon.has(y)) || (A.canon.has(y) && B.canon.has(x) && !A.canon.has(x))) return false;
  }
  const lex = jaccard(A.grams, B.grams);
  if (lex >= LEXICAL_DUPLICATE) return true;
  const sem = jaccard(A.all, B.all);
  const smaller = Math.min(A.all.size, B.all.size);
  if ((sem >= 0.75 && smaller >= 4) || (sem >= 0.99 && smaller >= 3)) return true;
  if (lex >= 0.3 && sem >= 0.6 && smaller >= 4) return true;
  // Same canonical concepts in the same frame, with little else said ("상사의 부당한 지시" ×2).
  if (A.frame === B.frame && A.canon.size >= 2 && A.canon.size === B.canon.size && [...A.canon].every((c) => B.canon.has(c))) {
    const lo = Math.min(A.words.size, B.words.size);
    const hi = Math.max(A.words.size, B.words.size);
    return hi <= 1 || (lo === 0 && hi <= 2) || jaccard(A.words, B.words) >= 0.34;
  }
  return false;
}

export function isNearDuplicate(a: string, b: string): boolean {
  return sameQuestion(fingerprint(a), fingerprint(b));
}
