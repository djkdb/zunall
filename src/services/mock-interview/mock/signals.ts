/**
 * Lightweight, deterministic text analysis used by the Mock interviewer.
 * Everything here is derived from the literal answer text, so mock feedback
 * never claims anything the candidate did not say.
 */
import type { Language } from "../shared/schemas";

export interface Topic {
  id: string;
  label: Record<Language, string>;
  pattern: RegExp;
}

export const TOPICS: Topic[] = [
  { id: "performance", label: { ko: "성능 문제", en: "the performance issue" }, pattern: /성능|느려|느린|(?:처리|응답|로딩|페이지|실행|쿼리|조회)\s?속도|지연\s?시간|렌더링|로딩|병목|latency|performance(?!\s*market)|slow|bottleneck|load time/i },
  { id: "incident", label: { ko: "장애 상황", en: "that incident" }, pattern: /장애|버그|오류|에러|크래시|다운|incident|outage|bug|error|crash|downtime/i },
  { id: "conflict", label: { ko: "의견 차이", en: "the disagreement" }, pattern: /갈등|의견 ?차이|충돌|반대|설득|conflict|disagree|pushback|persuad/i },
  { id: "deadline", label: { ko: "촉박한 일정", en: "the tight deadline" }, pattern: /(?<!(?:월|분기|연|결산|회계)\s?)마감|일정|데드라인|기한|deadline|timeline|schedule|time pressure/i },
  { id: "architecture", label: { ko: "구조 설계", en: "the architecture decision" }, pattern: /아키텍처|설계|구조|마이그레이션|리팩(?:터|토)링|architecture|design|migration|refactor/i },
  { id: "data", label: { ko: "데이터 분석", en: "the data analysis" }, pattern: /데이터|지표|분석|대시보드|전환율|리텐션|metric|data|analytics|conversion|retention/i },
  { id: "user", label: { ko: "사용자 문제", en: "the user problem" }, pattern: /사용자\s?(?:문제|불편|불만|인터뷰|리서치|피드백)|고객\s?(?:불만|문의|피드백)|VOC|사용성|유저\s?리서치|user research|usability|customer complaint/i },
  { id: "collaboration", label: { ko: "협업 과정", en: "the collaboration" }, pattern: /협업|소통|커뮤니케이션|조율|이해관계자|collaborat|communicat|stakeholder|align/i },
  { id: "leadership", label: { ko: "리딩 경험", en: "leading the team" }, pattern: /리드|리더|이끌|멘토|주도|lead|mentor|drove|owned/i },
  { id: "failure", label: { ko: "실패 경험", en: "that failure" }, pattern: /실패|실수|잘못|놓친|fail|mistake|missed/i },
  { id: "learning", label: { ko: "학습 과정", en: "the learning process" }, pattern: /새로(?:운)?\s?(?:기술|언어|도구)?(?:을|를)?\s?(?:배우|익히|익혔|학습)|독학|학습\s?방법|공부\s?방법|learn(?:ed|ing)? (?:a |the )?new|picked up/i },
];

/**
 * Job-specific things candidates mention — each with the follow-up a practitioner
 * in that field would ask next. Triggered only by the candidate's own words.
 */
export interface RoleTopic {
  id: string;
  pattern: RegExp;
  ask: Record<Language, string>;
}

export const ROLE_TOPICS: RoleTopic[] = [
  { id: "closing", pattern: /결산|월\s?마감|분기\s?마감/, ask: { ko: "결산 과정에서 숫자가 맞지 않았을 때는 어떤 순서로 확인하셨나요?", en: "When the numbers didn't tie out at closing, how did you track it down?" } },
  { id: "account", pattern: /재무제표|계정\s?(?:과목|처리)|분개|전표/, ask: { ko: "그 회계 처리는 어떤 기준에 근거해 판단하셨나요?", en: "Which standard did you base that accounting treatment on?" } },
  { id: "patient", pattern: /환자/, ask: { ko: "그때 환자 안전을 위해 가장 먼저 확인하신 것은 무엇이었나요?", en: "What did you check first for the patient's safety?" } },
  { id: "guardian", pattern: /보호자/, ask: { ko: "보호자에게는 상황을 어떻게 설명하셨나요?", en: "How did you explain the situation to the family?" } },
  { id: "campaign", pattern: /캠페인/, ask: { ko: "그 캠페인의 목표 KPI는 무엇이었고, 결과는 어땠나요?", en: "What was the campaign's target KPI, and how did it turn out?" } },
  { id: "sales", pattern: /매출|판매량|영업\s?실적/, ask: { ko: "그 매출 변화가 본인의 활동 때문이라는 것은 어떻게 확인하셨나요?", en: "How did you confirm the sales change came from your work?" } },
  { id: "client", pattern: /고객사|거래처|바이어|클라이언트/, ask: { ko: "그 고객이 가장 중요하게 생각한 것은 무엇이었나요?", en: "What mattered most to that client?" } },
  { id: "production", pattern: /생산\s?(?:량|계획|목표)|가동률|생산성/, ask: { ko: "계획 대비 차이가 생긴 원인은 어떻게 찾으셨나요?", en: "How did you find why output differed from the plan?" } },
  { id: "defect", pattern: /불량|품질\s?(?:문제|이슈)|클레임/, ask: { ko: "불량의 근본 원인은 어떻게 확인하셨고, 재발은 어떻게 막으셨나요?", en: "How did you confirm the root cause of the defect, and prevent it recurring?" } },
  { id: "process", pattern: /공정\s?(?:조건|변수|개선|관리)|수율/, ask: { ko: "공정 조건을 바꿀 때 어떤 데이터를 근거로 판단하셨나요?", en: "What data did you rely on when changing the process conditions?" } },
  { id: "law", pattern: /법규|법령|규제|조항|판례/, ask: { ko: "그 판단이 법령에 맞는지는 어떻게 확인하셨나요?", en: "How did you confirm that judgment was legally sound?" } },
  { id: "contract", pattern: /계약/, ask: { ko: "계약 조건을 조율하면서 가장 양보하기 어려웠던 부분은 무엇이었나요?", en: "In negotiating the contract, what was hardest to give ground on?" } },
  { id: "student", pattern: /학생|수업|학습자|아이들/, ask: { ko: "그 학생에게 어떤 변화가 있었는지는 어떻게 확인하셨나요?", en: "How did you see whether that student changed?" } },
  { id: "civil", pattern: /민원/, ask: { ko: "민원인이 끝까지 납득하지 않았다면 어떻게 하셨을까요?", en: "If the citizen still hadn't accepted it, what would you have done?" } },
  { id: "experiment", pattern: /실험/, ask: { ko: "실험 결과가 재현되지 않았다면 어떻게 검증하셨을까요?", en: "If the result hadn't reproduced, how would you have verified it?" } },
  { id: "budget", pattern: /예산/, ask: { ko: "예산은 어떤 기준으로 배분하셨나요?", en: "How did you decide how to split the budget?" } },
  { id: "safety", pattern: /안전\s?(?:사고|점검|관리|수칙)|위험성\s?평가|아차\s?사고/, ask: { ko: "현장에서 그 안전 조치를 지키게 하려고 어떻게 설득하셨나요?", en: "How did you get people on site to follow that safety measure?" } },
  { id: "hiring", pattern: /채용|지원자|면접관/, ask: { ko: "지원자를 평가할 때 공정성은 어떻게 지키셨나요?", en: "How did you keep the evaluation of candidates fair?" } },
  { id: "inventory", pattern: /재고/, ask: { ko: "적정 재고 수준은 어떤 기준으로 정하셨나요?", en: "How did you decide the right inventory level?" } },
  { id: "delivery", pattern: /납기/, ask: { ko: "납기를 맞추기 위해 무엇을 조정하셨나요?", en: "What did you adjust to hit the delivery date?" } },
  { id: "supplier", pattern: /협력사|협력\s?업체|공급사|벤더/, ask: { ko: "그 협력사와 의견이 달랐을 때는 어떻게 조율하셨나요?", en: "When that supplier disagreed with you, how did you work it out?" } },
  { id: "client_care", pattern: /대상자|이용자|내담자/, ask: { ko: "그분의 욕구나 상황은 어떻게 파악하셨나요?", en: "How did you work out that person's needs?" } },
  { id: "guest", pattern: /승객|투숙객|손님/, ask: { ko: "그 손님의 감정은 어떻게 먼저 다루셨나요?", en: "How did you deal with that guest's feelings first?" } },
];

/** Concrete methods/tools — the best anchors for a sharp follow-up. */
const METHOD_PATTERN =
  /프로파일링|profiling|profiler|로그|logs?|logging|모니터링|monitoring|트레이싱|tracing|APM|Lighthouse|DevTools|개발자 ?도구|캐시|캐싱|cach(?:e|ing)|인덱스|index(?:ing)?|쿼리|query|코드 ?리뷰|code review|테스트 ?코드|unit test|E2E|A\/B ?테스트|A\/B test|부하 ?테스트|load test|리팩(?:터|토)링|refactoring|메모이제이션|memoi[sz]ation|lazy ?loading|코드 ?스플리팅|code splitting|번들|bundle|CDN|가상화|virtuali[sz]ation|디바운스|debounce|쓰로틀|throttl\w*|비동기|async|배치|batch(?:ing)?|큐|queue|샤딩|sharding|레플리카|replica|설문|survey|사용자 ?인터뷰|user interview|프로토타입|prototype|와이어프레임|wireframe|회고|retrospective|문서화|documentation|페어 ?프로그래밍|pair programming|스프린트|sprint|로드맵|roadmap|OKR|KPI|퍼널|funnel|코호트|cohort|파인튜닝|fine-?tuning|RAG|임베딩|embedding|프롬프트|prompt|평가 ?셋|eval(?:uation)? set/gi;

/** Technologies — used for "why did you choose X" style follow-ups. */
const TECH_PATTERN =
  /React|Next\.?js|Vue|Svelte|Angular|TypeScript|JavaScript|Redux|Zustand|React ?Query|Tailwind|Webpack|Vite|Node\.?js|Express|NestJS|Spring(?: Boot)?|Django|FastAPI|Flask|Go(?:lang)?|Kotlin|Java|Python|Rust|GraphQL|REST|gRPC|PostgreSQL|MySQL|MongoDB|Redis|Kafka|RabbitMQ|Elasticsearch|Docker|Kubernetes|AWS|GCP|Azure|Lambda|Terraform|PyTorch|TensorFlow|LangChain|Figma|Amplitude|Mixpanel|GA4|SQL|Jira|Notion/g;

export interface Signals {
  text: string;
  lang: Language;
  chars: number;
  words: number;
  sentences: string[];
  numbers: string[];
  methods: string[];
  techs: string[];
  topics: Topic[];
  firstPerson: boolean;
  teamOnly: boolean;
  hedges: number;
  fillers: number;
  structureMarkers: number;
  causal: number;
  star: { situation: number; task: number; action: number; result: number };
  questionOverlap: number;
  /** "잘 모르겠습니다" / "패스" — the candidate declined to answer. */
  dontKnow: boolean;
  /** Something the candidate said they owned ("장바구니 기능을 맡았습니다" → "장바구니 기능"). */
  roleClaim: string;
  /** A named project/system ("쇼핑몰 프로젝트", "결제 시스템"). */
  project: string;
  /** A number with its unit, as written ("100만 건", "40%"). */
  metric: string;
}

const VERB_ENDING = /(?:는|은|한|된|던|할|될|적인|하게|에서|으로|로)$/;
const PARTICLE = /(?:을|를|이|가|은|는|에서|에|과|와|도|으로|로|의)$/u;

function projectPhrase(text: string): string {
  const re = /([가-힣A-Za-z0-9]{2,12})\s?(프로젝트|서비스|기능|플랫폼|시스템|파이프라인|대시보드|캠페인|앱|현장실습|실습|인턴십|인턴|대외활동|동아리|공모전|아르바이트|봉사활동|연구)/g;
  for (const m of text.matchAll(re)) {
    const head = m[1].replace(PARTICLE, "");
    if (!head || VERB_ENDING.test(m[1]) || /^(?:팀|이|그|저|해당|여러|모든|사이드|개인|토이)$/.test(head)) continue;
    return `${head} ${m[2]}`;
  }
  return "";
}

function roleClaimPhrase(text: string): string {
  const m = text.match(/([가-힣A-Za-z0-9]{1,12}(?:\s[가-힣A-Za-z0-9]{1,12})?)\s?(?:을|를)\s?(?:맡았|맡아|담당했|담당하|주도했|리드했|책임졌)/);
  if (!m) return "";
  const words = m[1].trim().split(/\s+/).filter((w) => !VERB_ENDING.test(w) && !/^(?:제가|저는|그중|주로|직접|혼자)$/.test(w));
  return words.join(" ");
}

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const uniqueCI = (xs: string[]) => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.toLowerCase().replace(/\s+/g, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|(?<=다\.)|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function bigramOverlap(a: string, b: string): number {
  const grams = (s: string) => {
    const t = s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const out = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / A.size;
}

export function extractMethods(text: string): string[] {
  return uniqueCI(text.match(METHOD_PATTERN) ?? []);
}

export function extractTechs(text: string): string[] {
  return uniqueCI(text.match(TECH_PATTERN) ?? []);
}

export function readSignals(text: string, question: string, lang: Language): Signals {
  const t = text.trim();
  const sentences = splitSentences(t);
  const firstPerson = /제가|저는|저의|제 역할|직접|주도|맡아|맡았|담당|\bI\b|\bI'm\b|\bI've\b|\bmy\b|\bme\b/i.test(t);
  const team = /우리|저희|팀|\bwe\b|\bour\b|\bteam\b/i.test(t);
  return {
    text: t,
    lang,
    chars: t.replace(/\s/g, "").length,
    words: t.split(/\s+/).filter(Boolean).length,
    sentences,
    numbers: t.match(/\d+(?:[.,]\d+)?\s*(?:%|퍼센트|배|초|ms|분|시간|일|주|개월|년|명|개|건|만|천|x|times|seconds?|minutes?|hours?|days?|weeks?|months?|users?|percent)?/gi) ?? [],
    methods: extractMethods(t),
    techs: extractTechs(t),
    topics: TOPICS.filter((tp) => tp.pattern.test(t)),
    firstPerson,
    teamOnly: team && !firstPerson,
    hedges: count(t, /것 ?같|아마|잘 모르|글쎄|어쩌면|딱히|그냥|maybe|i think|probably|not sure|kind of|sort of|i guess/gi),
    fillers: count(t, /(?:^|\s)(?:음+|어+|그+|um+|uh+|like,)(?=\s|$)/gi),
    structureMarkers: count(t, /먼저|첫째|둘째|셋째|그 ?다음|이후|마지막으로|결과적으로|요약하면|first(?:ly)?|second(?:ly)?|then|after that|finally|in the end|to summari[sz]e/gi),
    causal: count(t, /때문|왜냐하면|그래서|따라서|덕분|이유는|because|so that|therefore|which meant|as a result/gi),
    star: {
      situation: count(t, /당시|상황|프로젝트|회사|서비스|팀에서|인턴|동아리|수업|when|while|during|at the time|project|situation|company/gi),
      task: count(t, /목표|역할|맡|해야|과제|요구|책임|문제는|goal|task|responsible|needed to|my role|had to|objective/gi),
      action: count(t, /해결|구현|도입|개선|분석|적용|설계|만들|진행|사용|최적화|수정|제안|설득|정리|implemented|built|analy[sz]ed|introduced|designed|used|optimi[sz]ed|refactored|fixed|solved|proposed|created|led/gi),
      result: count(t, /결과|개선되|줄었|줄였|감소|증가|향상|달성|단축|성과|절감|올랐|올렸|마쳤|완료했|해냈|성공했|끝냈|수상|합격|result|reduced|increased|improved|achieved|saved|faster|decreased|grew|cut|completed|delivered|won/gi),
    },
    questionOverlap: bigramOverlap(question, t),
    dontKnow: t.replace(/\s/g, "").length < 60 && /잘\s?모르|모르겠|몰라|모릅니다|모름|기억이\s?(?:잘\s?)?안|패스|넘어가겠|해\s?본\s?적(?:이)?\s?없|경험이\s?없|don'?t know|not sure|no idea|\bpass\b|\bskip\b/i.test(t),
    roleClaim: roleClaimPhrase(t),
    project: projectPhrase(t),
    metric: (t.match(/\d+(?:[.,]\d+)?\s?(?:%|퍼센트|배|초|ms|분|시간|명|개|건|만\s?건|만\s?명|만|천|x|times|users|percent)/i)?.[0] ?? "").trim(),
  };
}

/** Topic keyword plus the noun right after it ("성능" → "성능 문제"), particles stripped. */
export function topicPhrase(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  if (!m || m.index === undefined) return "";
  const rest = text.slice(m.index + m[0].length).match(/^[가-힣A-Za-z]*(?:\s[가-힣A-Za-z]+)?/)?.[0] ?? "";
  const phrase = (m[0] + rest).trim();
  return phrase.replace(/(을|를|이|가|은|는|에서|에|과|와|도|으로|로|의)$/u, "").trim();
}

/** Shortest verbatim clause from the answer that contains `needle`. */
export function quoteAround(text: string, needle: string, max = 48): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return "";
  let start = Math.max(0, idx - 14);
  let end = Math.min(text.length, idx + needle.length + 22);
  // snap to whitespace so we don't cut words in half
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end]) && end - start < max + 12) end++;
  return text.slice(start, end).trim().replace(/[,.]$/, "");
}

export { hasBatchim, josa, objectParticle } from "../shared/korean";
