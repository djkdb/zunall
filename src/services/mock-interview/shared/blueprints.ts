/**
 * Interview blueprints: how each kind of job is interviewed.
 *
 * Every role belongs to an archetype (via its job family). The blueprint decides
 * the mix of question types, the order of the interview, which way follow-ups dig
 * (a marketer is asked about goal → target → channel → KPI, an accountant about
 * standard → judgment → error → fix), how hard questions are sharpened, and which
 * role-specific signal the answer analysis looks for.
 */
import type { Archetype, ExperienceLevel, InterviewType, Language, QuestionType } from "./schemas";

type L10n = Record<Language, string>;
export type Weights = Partial<Record<QuestionType, number>>;

export interface ChainStep {
  key: string;
  /** Answer already covers this step. */
  covered: RegExp;
  ask: L10n;
}

export interface Blueprint {
  archetype: Archetype;
  label: L10n;
  /** Question-type mix for this kind of job (percent-ish weights). */
  weights: Weights;
  /** Which direction follow-ups dig, in order. */
  chain: ChainStep[];
  /** Sharper follow-ups for the hard (압박) difficulty. */
  pressure: L10n[];
  /** Role-specific feedback signal for answer analysis. */
  signal: { label: L10n; evidence: RegExp; present: L10n; missing: L10n };
  /** Label for the job-knowledge interview type. */
  jobInterview: L10n;
}

const step = (key: string, covered: RegExp, ko: string, en: string): ChainStep => ({ key, covered, ask: { ko, en } });
const l = (ko: string, en: string): L10n => ({ ko, en });

const RESULT = step("result", /결과|성과|개선되|줄었|늘었|증가|감소|달성|\d+\s?%|\d+\s?배|result|improv|reduc|increas/i, "결과적으로 무엇이 얼마나 달라졌나요?", "In the end, what changed, and by how much?");

export const BLUEPRINTS: Record<Archetype, Blueprint> = {
  tech_dev: {
    archetype: "tech_dev",
    label: l("개발·엔지니어링", "Engineering"),
    weights: { technical: 35, deep_dive: 20, case: 15, experience: 15, behavioral: 10, motivation: 5 },
    chain: [
      step("choice", /선택|도입|채택|사용했|적용했|chose|adopt|used/i, "그때 어떤 기술이나 방식을 선택하셨나요?", "Which technology or approach did you choose there?"),
      step("why", /때문|이유|왜냐|판단|근거|because|reason/i, "그 방식을 선택한 이유는 무엇이었나요?", "Why that approach?"),
      step("tradeoff", /대신|트레이드\s?오프|단점|포기|대안|비교|trade-?off|downside|instead/i, "그 선택으로 포기해야 했던 것은 무엇이었나요?", "What did that choice cost you — what did you give up?"),
      step("incident", /장애|이슈|버그|오류|예상하지|incident|bug|outage/i, "적용하면서 예상하지 못한 문제는 없었나요?", "Did anything unexpected go wrong when you rolled it out?"),
      RESULT,
    ],
    pressure: [l("그 선택이 최선이었다고 판단한 근거가 있나요?", "What evidence tells you that was the best choice?"), l("같은 문제를 지금 다시 푼다면 그 방식을 또 쓰시겠어요?", "Would you use the same approach if you solved it again today?")],
    signal: {
      label: l("기술적 깊이", "Technical depth"),
      evidence: /원인|트레이드\s?오프|측정|프로파일|로그|테스트|설계|구조|복잡도|성능|trade-?off|measure|profil|test|design/i,
      present: l("원인·측정·설계 판단을 근거로 설명해 기술적 깊이가 드러납니다.", "Explains causes, measurements or design trade-offs — shows technical depth."),
      missing: l("무엇을 썼는지는 나오지만 왜·어떻게 판단했는지 기술적 근거가 부족합니다.", "Says what was used but not the technical reasoning behind it."),
    },
    jobInterview: l("기술 면접", "Technical"),
  },
  data_analytic: {
    archetype: "data_analytic",
    label: l("데이터·분석", "Data & analytics"),
    weights: { analytical: 25, technical: 20, case: 20, experience: 15, behavioral: 10, motivation: 10 },
    chain: [
      step("question", /가설|질문|목적|문제\s?정의|hypothes|goal|question/i, "그 분석에서 답하려던 질문이나 가설은 무엇이었나요?", "What question or hypothesis was the analysis meant to answer?"),
      step("metric", /지표|KPI|전환|리텐션|정의|metric|conversion|retention/i, "어떤 지표를 어떻게 정의해서 보셨나요?", "Which metric did you use, and how did you define it?"),
      step("method", /분석|모델|회귀|검정|A\/B|코호트|쿼리|SQL|regression|test|cohort/i, "어떤 분석 방법을 쓰셨고, 왜 그 방법이었나요?", "Which analysis method did you use, and why?"),
      step("decision", /의사\s?결정|결정|반영|제안|바뀌|decision|changed|recommend/i, "그 분석으로 실제로 어떤 의사결정이 바뀌었나요?", "What decision actually changed because of it?"),
      RESULT,
    ],
    pressure: [l("그 결과가 상관관계가 아니라 인과관계라고 어떻게 확신하셨나요?", "How do you know that was causation, not correlation?"), l("데이터가 틀렸을 가능성은 어떻게 검증하셨나요?", "How did you rule out that the data itself was wrong?")],
    signal: {
      label: l("분석적 사고", "Analytical thinking"),
      evidence: /가설|지표|정의|검증|표본|편향|유의|비교|원인|hypothes|metric|bias|sample|significan/i,
      present: l("가설·지표·검증 과정을 짚어 분석적 사고가 드러납니다.", "Walks through hypothesis, metric and validation — analytical."),
      missing: l("결론은 있지만 어떤 지표로 어떻게 검증했는지가 드러나지 않습니다.", "States a conclusion without how it was measured or validated."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  product_planning: {
    archetype: "product_planning",
    label: l("기획·PM", "Product"),
    weights: { case: 25, role_specific: 20, analytical: 15, experience: 15, behavioral: 15, motivation: 10 },
    chain: [
      step("problem", /문제|불편|페인|니즈|pain|problem|need/i, "그때 해결하려던 사용자 문제는 정확히 무엇이었나요?", "What exactly was the user problem you were solving?"),
      step("evidence", /데이터|인터뷰|리서치|설문|VOC|지표|data|interview|research/i, "그 문제가 진짜라는 것은 무엇으로 확인하셨나요?", "How did you confirm the problem was real?"),
      step("priority", /우선\s?순위|범위|MVP|제외|포기|priorit|scope/i, "무엇을 먼저 하고 무엇을 뺄지는 어떻게 정하셨나요?", "How did you decide what to build first and what to cut?"),
      step("stakeholder", /개발|디자인|이해관계자|설득|합의|stakeholder|align/i, "개발·디자인과 의견이 갈렸을 때는 어떻게 조율하셨나요?", "When engineering or design disagreed, how did you align?"),
      RESULT,
    ],
    pressure: [l("그 기능이 없었어도 지표가 올랐을 가능성은 없나요?", "Couldn't the metric have gone up without that feature?"), l("사용자가 원한 것과 회사가 원한 것이 달랐다면 어느 쪽을 택하셨겠어요?", "If users and the business wanted different things, which would you pick?")],
    signal: {
      label: l("제품적 사고", "Product thinking"),
      evidence: /사용자|문제|가설|지표|우선\s?순위|검증|user|problem|hypothes|metric|priorit/i,
      present: l("사용자 문제와 지표, 우선순위를 연결해 제품적 사고가 드러납니다.", "Connects user problem, metrics and priorities."),
      missing: l("기능 설명은 있지만 어떤 사용자 문제를 풀었는지가 흐릿합니다.", "Describes features but not the user problem behind them."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  strategy_business: {
    archetype: "strategy_business",
    label: l("전략·기획", "Strategy"),
    weights: { case: 25, analytical: 20, industry: 15, role_specific: 15, experience: 15, behavioral: 10 },
    chain: [
      step("issue", /문제|이슈|과제|목표|issue|objective/i, "그때 풀어야 했던 핵심 과제는 무엇이었나요?", "What was the core issue you had to solve?"),
      step("analysis", /분석|데이터|시장|경쟁|수치|analysis|market|data/i, "판단 근거가 된 분석이나 데이터는 무엇이었나요?", "What analysis or data backed your judgment?"),
      step("option", /대안|옵션|시나리오|비교|option|alternative|scenario/i, "검토한 다른 대안은 무엇이었고 왜 제외하셨나요?", "What alternatives did you consider, and why did you drop them?"),
      step("execution", /실행|보고|승인|설득|execution|approval|present/i, "그 안을 실제로 실행되게 하려고 무엇을 하셨나요?", "What did you do to get it executed?"),
      RESULT,
    ],
    pressure: [l("그 전략이 틀렸다면 가장 먼저 어디서 신호가 보였을까요?", "If the strategy were wrong, where would the first warning sign appear?"), l("그 숫자는 어떤 가정 위에 서 있나요?", "What assumptions is that number built on?")],
    signal: {
      label: l("구조적 사고", "Structured thinking"),
      evidence: /가정|근거|대안|시나리오|비교|분석|우선|리스크|assum|option|risk/i,
      present: l("가정·대안·근거를 구조적으로 제시했습니다.", "Lays out assumptions, options and evidence in a structured way."),
      missing: l("결론은 있지만 어떤 가정과 대안을 비교했는지가 드러나지 않습니다.", "Gives a conclusion without the assumptions or options weighed."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  finance_accounting: {
    archetype: "finance_accounting",
    label: l("회계·재무", "Accounting & finance"),
    weights: { role_specific: 25, case: 20, analytical: 15, experience: 15, situational: 15, behavioral: 10 },
    chain: [
      step("task", /결산|전표|장부|보고서|신고|업무|closing|ledger|report/i, "그 업무에서 본인이 맡은 범위는 어디까지였나요?", "What exactly was your part of that work?"),
      step("standard", /기준|규정|K-?IFRS|세법|원칙|내부통제|정책|standard|policy|rule/i, "그때 어떤 기준이나 규정을 근거로 판단하셨나요?", "Which standard or rule did you base that judgment on?"),
      step("error", /오류|차이|불일치|이상|누락|실수|error|mismatch|discrepanc/i, "숫자가 맞지 않거나 오류가 있었다면 어떻게 찾으셨나요?", "If the numbers didn't match, how did you track down the error?"),
      step("fix", /수정|정정|보고|재발|대사|검증|correct|reconcil|verify/i, "발견한 문제는 어떻게 처리하고 재발을 막으셨나요?", "How did you correct it and keep it from happening again?"),
      RESULT,
    ],
    pressure: [l("그 판단이 회계 기준에 맞는지 어떻게 확인하시겠습니까?", "How would you confirm that judgment complies with the accounting standard?"), l("마감이 임박했는데 근거가 부족하다면 그래도 처리하시겠어요?", "With the deadline close and the support thin, would you still book it?")],
    signal: {
      label: l("정확성·기준 준수", "Accuracy & compliance"),
      evidence: /기준|규정|검증|대사|증빙|확인|K-?IFRS|내부통제|정확|더블\s?체크|standard|reconcil|verify|control/i,
      present: l("기준과 검증 절차를 짚어 정확성에 대한 감각이 드러납니다.", "Mentions standards and checks — shows care for accuracy."),
      missing: l("숫자를 어떤 기준과 절차로 검증했는지가 드러나지 않습니다.", "Doesn't show how the numbers were checked against a standard."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  finance_markets: {
    archetype: "finance_markets",
    label: l("금융", "Financial services"),
    weights: { industry: 20, role_specific: 15, situational: 15, case: 15, role_understanding: 15, behavioral: 10, ethics: 10 },
    chain: [
      step("client", /고객|손님|기업|차주|client|customer/i, "그때 상대한 고객은 어떤 상황이었나요?", "What situation was that client in?"),
      step("need", /니즈|필요|목적|원하|need|goal/i, "그 고객에게 정말 필요했던 것은 무엇이었나요?", "What did the client really need?"),
      step("risk", /리스크|위험|손실|부실|규제|risk|loss/i, "그 과정에서 어떤 리스크를 고려하셨나요?", "What risks did you weigh along the way?"),
      step("compliance", /규정|설명|동의|적합성|소비자\s?보호|compliance|suitab|disclos/i, "규정이나 고객 보호 측면에서 지킨 원칙은 무엇이었나요?", "Which rule or customer-protection principle did you hold to?"),
      RESULT,
    ],
    pressure: [l("실적 목표와 고객 이익이 충돌한다면 어떻게 하시겠어요?", "If your sales target and the client's interest clashed, what would you do?"), l("그 판단으로 손실이 났다면 무엇이 잘못이었을까요?", "If that call had lost money, what would have been the mistake?")],
    signal: {
      label: l("고객 보호·리스크 감각", "Client protection & risk"),
      evidence: /리스크|위험|규정|고객\s?보호|설명|적합|신뢰|손실|risk|complian|suitab|trust/i,
      present: l("리스크와 고객 보호를 함께 고려하는 태도가 보입니다.", "Weighs risk and client protection together."),
      missing: l("성과는 말했지만 리스크나 고객 보호에 대한 고려가 보이지 않습니다.", "Talks results without risk or client protection."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  hr_people: {
    archetype: "hr_people",
    label: l("인사·HR", "People & HR"),
    weights: { role_specific: 25, situational: 20, case: 15, behavioral: 15, experience: 15, ethics: 10 },
    chain: [
      step("situation", /채용|평가|제도|조직|구성원|면접|교육|hiring|evaluation|policy/i, "그때 어떤 인사 상황이었는지 조금 더 설명해 주시겠어요?", "Can you tell me more about the HR situation?"),
      step("criteria", /기준|원칙|공정|평가\s?요소|역량|criteria|fair/i, "판단 기준은 무엇이었고, 공정성은 어떻게 지키셨나요?", "What criteria did you use, and how did you keep it fair?"),
      step("stakeholder", /현업|리더|구성원|노조|설득|합의|stakeholder|manager/i, "현업이나 구성원의 반발은 어떻게 다루셨나요?", "How did you handle pushback from managers or employees?"),
      step("privacy", /개인정보|비밀|보안|법|규정|privacy|confidential|law/i, "그 과정에서 개인정보나 법적 이슈는 어떻게 챙기셨나요?", "How did you handle privacy or legal issues in the process?"),
      RESULT,
    ],
    pressure: [l("그 제도가 오히려 구성원 불만을 키웠다면 어떻게 하시겠어요?", "If that policy had increased employee dissatisfaction, what would you do?"), l("현업 리더가 기준에 맞지 않는 후보를 강하게 원한다면요?", "What if a hiring manager insisted on a candidate who didn't meet the bar?")],
    signal: {
      label: l("공정성·조직 이해", "Fairness & org sense"),
      evidence: /공정|기준|원칙|구성원|조직|제도|형평|투명|fair|criteria|transparen/i,
      present: l("기준과 공정성, 구성원 관점을 함께 고려했습니다.", "Considers criteria, fairness and employees together."),
      missing: l("무엇을 했는지는 나오지만 어떤 기준으로 공정성을 지켰는지가 드러나지 않습니다.", "Doesn't show the criteria used to keep it fair."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  admin_support: {
    archetype: "admin_support",
    label: l("사무·지원", "Admin & support"),
    weights: { role_specific: 25, situational: 25, experience: 20, behavioral: 15, communication: 15 },
    chain: [
      step("task", /업무|요청|일정|문서|자산|행사|계약|task|request/i, "그 업무에서 본인이 맡은 일은 구체적으로 무엇이었나요?", "What exactly was your part?"),
      step("priority", /우선\s?순위|동시에|급한|먼저|priorit|urgent/i, "여러 요청이 겹쳤을 때 우선순위는 어떻게 정하셨나요?", "When requests piled up, how did you prioritize?"),
      step("accuracy", /확인|검토|체크|정확|실수|누락|check|review|accura/i, "실수나 누락을 막기 위해 어떻게 확인하셨나요?", "How did you guard against mistakes or omissions?"),
      step("improve", /개선|효율|정리|양식|매뉴얼|improve|streamlin/i, "그 업무를 더 효율적으로 바꾼 부분이 있었나요?", "Did you make that work more efficient in any way?"),
      RESULT,
    ],
    pressure: [l("여러 부서가 동시에 급하다고 하면 누구 일부터 하시겠어요?", "If several teams all say theirs is urgent, whose goes first?"), l("그 방식이 왜 더 나은지 수치로 보여줄 수 있나요?", "Can you show with numbers why your way was better?")],
    signal: {
      label: l("꼼꼼함·조율력", "Thoroughness & coordination"),
      evidence: /확인|정리|우선\s?순위|일정|조율|체크|정확|누락|check|priorit|coordinat/i,
      present: l("확인 절차와 우선순위 판단이 드러나 꼼꼼함이 보입니다.", "Shows checks and prioritization — thorough."),
      missing: l("업무 나열은 있지만 정확성과 우선순위를 어떻게 챙겼는지가 보이지 않습니다.", "Lists tasks without how accuracy or priority was handled."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  legal_compliance: {
    archetype: "legal_compliance",
    label: l("법무·컴플라이언스", "Legal & compliance"),
    weights: { role_specific: 30, case: 20, situational: 15, ethics: 15, experience: 10, communication: 10 },
    chain: [
      step("issue", /쟁점|이슈|문제|계약|리스크|issue|risk|contract/i, "그 사안의 핵심 쟁점은 무엇이었나요?", "What was the core legal issue?"),
      step("basis", /법|규정|조항|판례|가이드|기준|law|regulation|clause|precedent/i, "어떤 법령이나 규정을 근거로 판단하셨나요?", "Which law or rule did you base that on?"),
      step("business", /현업|사업|영업|대안|조율|business|alternative/i, "현업의 요구와 법적 리스크 사이에서 어떤 대안을 제시하셨나요?", "What alternative did you offer between the business need and the legal risk?"),
      step("communicate", /설명|보고|문서|설득|communicat|explain|memo/i, "법률을 모르는 현업에게 그 판단을 어떻게 설명하셨나요?", "How did you explain that to non-lawyers?"),
      RESULT,
    ],
    pressure: [l("현업이 '법적으로 문제없게만 해 달라'고 압박한다면요?", "What if the business pressed you to 'just make it legal'?"), l("그 해석과 반대되는 견해가 있다면 어떻게 반박하시겠어요?", "If there's a contrary reading, how would you rebut it?")],
    signal: {
      label: l("리스크 판단·근거", "Risk judgment"),
      evidence: /법|규정|조항|판례|근거|리스크|대안|책임|law|regulation|risk|liabil/i,
      present: l("법적 근거와 대안을 함께 제시해 리스크 판단력이 보입니다.", "Gives legal basis with a practical alternative."),
      missing: l("결론은 있지만 어떤 근거로 판단했는지가 드러나지 않습니다.", "Gives a conclusion without the legal basis."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  marketing_growth: {
    archetype: "marketing_growth",
    label: l("마케팅", "Marketing"),
    weights: { role_specific: 30, case: 20, analytical: 15, experience: 15, behavioral: 10, motivation: 10 },
    chain: [
      step("goal", /목표|목적|KPI|goal|objective/i, "그 캠페인의 목표는 무엇이었나요?", "What was the goal of that campaign?"),
      step("target", /타깃|타겟|고객층|페르소나|세그먼트|대상|target|persona|segment/i, "타깃은 누구였고, 어떻게 정하셨나요?", "Who was the target, and how did you choose them?"),
      step("channel", /채널|매체|광고|SNS|검색|인플루언서|channel|media|ads/i, "왜 그 채널을 선택하셨나요?", "Why that channel?"),
      step("kpi", /CTR|전환|ROAS|CAC|CPA|도달|지표|conversion|metric/i, "성과는 어떤 지표로 판단하셨나요?", "Which metric did you judge success by?"),
      RESULT,
    ],
    pressure: [l("그 결과가 정말 본인의 기여라고 어떻게 증명할 수 있나요?", "How can you prove that result was your contribution?"), l("예산을 절반으로 줄여야 했다면 어떤 채널부터 빼셨겠어요?", "If the budget were halved, which channel would you cut first?")],
    signal: {
      label: l("비즈니스 사고", "Business thinking"),
      evidence: /목표|타깃|타겟|채널|전환|CTR|ROAS|매출|지표|예산|퍼널|KPI|conversion|funnel|budget/i,
      present: l("목표·타깃·지표를 연결해 비즈니스 관점이 드러납니다.", "Links goal, target and metrics — business-minded."),
      missing: l("무엇을 했는지는 나오지만 목표와 성과 지표가 연결되지 않습니다.", "Activities aren't tied to goals or metrics."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  sales_customer: {
    archetype: "sales_customer",
    label: l("영업", "Sales"),
    weights: { situational: 25, role_specific: 20, experience: 20, behavioral: 15, case: 10, communication: 10 },
    chain: [
      step("customer", /고객|거래처|바이어|고객사|점주|customer|client|buyer/i, "그 고객은 어떤 상황이었나요?", "What situation was that customer in?"),
      step("need", /니즈|필요|원하|불만|고민|요구|need|pain/i, "고객이 정말 원했던 것은 무엇이었나요?", "What did the customer really want?"),
      step("action", /제안|방문|자료|샘플|조건|대응|proposal|offer/i, "그 니즈에 맞춰 구체적으로 무엇을 제안하셨나요?", "What exactly did you propose to meet that need?"),
      step("persuade", /설득|협상|가격|거절|반대|negotiat|objection|price/i, "고객이 망설이거나 거절했을 때는 어떻게 설득하셨나요?", "When they hesitated or said no, how did you persuade them?"),
      RESULT,
    ],
    pressure: [l("그 고객이 끝까지 거절한다면 다른 방식으로 접근하시겠습니까?", "If that customer still refused, how else would you approach them?"), l("가격을 더 낮춰 달라는 요구에 회사 기준상 응할 수 없다면요?", "What if they demanded a lower price you're not allowed to give?")],
    signal: {
      label: l("고객 지향성", "Customer orientation"),
      evidence: /고객|니즈|필요|관계|신뢰|제안|설득|협상|customer|need|relationship|trust/i,
      present: l("고객의 니즈에서 출발해 설득한 과정이 드러납니다.", "Starts from the customer's need — customer-oriented."),
      missing: l("실적은 말했지만 고객이 무엇을 원했는지가 드러나지 않습니다.", "Talks results without what the customer needed."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  commerce_md: {
    archetype: "commerce_md",
    label: l("MD·상품", "Merchandising"),
    weights: { role_specific: 25, analytical: 20, case: 20, experience: 15, industry: 10, behavioral: 10 },
    chain: [
      step("product", /상품|제품|아이템|브랜드|product|item/i, "그 상품을 고른 근거는 무엇이었나요?", "What made you pick that product?"),
      step("data", /판매|매출|재고|데이터|트렌드|고객\s?반응|sales|inventory|trend/i, "판매나 재고 데이터는 어떻게 보셨나요?", "How did you read the sales or inventory data?"),
      step("partner", /협력사|벤더|공급|협상|거래처|vendor|supplier|negotiat/i, "협력사와 조건은 어떻게 협상하셨나요?", "How did you negotiate terms with the vendor?"),
      step("margin", /마진|수익|가격|할인|원가|margin|price|discount/i, "가격과 마진은 어떻게 판단하셨나요?", "How did you judge price and margin?"),
      RESULT,
    ],
    pressure: [l("그 상품이 안 팔렸다면 재고는 어떻게 처리하셨겠어요?", "If it hadn't sold, what would you have done with the stock?"), l("본인 취향이 아니라 데이터로 고른 것이라고 어떻게 말할 수 있나요?", "How do you know it was data, not your taste, that picked it?")],
    signal: {
      label: l("상품·수익 감각", "Merchandising sense"),
      evidence: /판매|매출|재고|마진|고객|트렌드|데이터|가격|sales|inventory|margin|trend/i,
      present: l("판매·재고·마진을 근거로 판단해 상품 감각이 드러납니다.", "Grounds choices in sales, stock and margin."),
      missing: l("상품 이야기는 있지만 수익과 재고 관점의 판단이 보이지 않습니다.", "Talks products without margin or inventory thinking."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  supply_ops: {
    archetype: "supply_ops",
    label: l("구매·물류·SCM", "Supply chain"),
    weights: { role_specific: 25, situational: 20, analytical: 20, case: 15, experience: 10, behavioral: 10 },
    chain: [
      step("issue", /공급|납기|재고|단가|지연|결품|supply|delay|shortage/i, "그때 공급이나 재고에 어떤 문제가 있었나요?", "What was the supply or inventory problem?"),
      step("cause", /원인|예측|리드\s?타임|수요|cause|forecast|lead\s?time/i, "원인은 어떻게 파악하셨나요?", "How did you find the cause?"),
      step("action", /대체|협상|조정|긴급|발주|재배치|alternative|negotiat|expedite/i, "당장 어떤 조치를 하셨나요?", "What did you do right away?"),
      step("prevent", /재발|개선|프로세스|안전\s?재고|모니터링|prevent|process|safety stock/i, "같은 문제가 반복되지 않게 무엇을 바꾸셨나요?", "What did you change so it wouldn't recur?"),
      RESULT,
    ],
    pressure: [l("원가 절감과 납기 준수가 충돌하면 무엇을 택하시겠어요?", "If cost savings and on-time delivery clash, which wins?"), l("그 협력사를 바꿨다가 품질 문제가 생기면 누구 책임인가요?", "If switching that supplier caused quality problems, whose fault is it?")],
    signal: {
      label: l("원가·흐름 관리", "Cost & flow control"),
      evidence: /원가|단가|납기|재고|리드\s?타임|수요|협력사|예측|cost|lead\s?time|inventory|forecast/i,
      present: l("원가·납기·재고를 함께 고려한 판단이 드러납니다.", "Balances cost, lead time and inventory."),
      missing: l("조치는 설명했지만 원가나 납기에 미친 영향이 드러나지 않습니다.", "Describes actions without their cost or lead-time impact."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  service_hospitality: {
    archetype: "service_hospitality",
    label: l("서비스·고객응대", "Service"),
    weights: { situational: 30, role_specific: 20, behavioral: 20, experience: 15, communication: 15 },
    chain: [
      step("situation", /고객|손님|승객|투숙객|상황|customer|guest|passenger/i, "그때 고객은 어떤 상황이었나요?", "What was the guest's situation?"),
      step("feeling", /불만|화|감정|공감|사과|기분|complain|upset|empath/i, "고객의 감정은 어떻게 먼저 다루셨나요?", "How did you deal with their feelings first?"),
      step("rule", /규정|원칙|매뉴얼|정책|기준|rule|policy|manual/i, "규정과 고객 요청 사이에서 어디까지 들어줄 수 있었나요?", "Between the rules and the request, how far could you go?"),
      step("team", /동료|선배|팀|보고|인계|colleague|team|escalat/i, "혼자 해결하기 어려운 부분은 누구와 어떻게 협력하셨나요?", "What couldn't you solve alone, and who did you bring in?"),
      RESULT,
    ],
    pressure: [l("규정상 안 되는 요청을 고객이 계속 요구하면 어떻게 하시겠어요?", "If the guest kept insisting on something the rules forbid, then what?"), l("모든 고객을 만족시킬 수 없다면 무엇을 기준으로 판단하시겠어요?", "If you can't satisfy everyone, what do you judge by?")],
    signal: {
      label: l("고객 응대·침착함", "Service & composure"),
      evidence: /공감|경청|사과|안내|대안|규정|침착|동료|empath|listen|calm|alternative/i,
      present: l("공감과 대안 제시로 상황을 수습한 과정이 드러납니다.", "Shows empathy and offers alternatives."),
      missing: l("상황 설명은 있지만 고객에게 어떻게 응대했는지가 구체적이지 않습니다.", "Describes the situation, not how the guest was handled."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  design_creative: {
    archetype: "design_creative",
    label: l("디자인", "Design"),
    weights: { experience: 25, role_specific: 25, case: 15, communication: 15, behavioral: 10, reflection: 10 },
    chain: [
      step("problem", /문제|사용자|목표|브리프|요구|problem|user|brief/i, "그 작업에서 풀려던 문제는 무엇이었나요?", "What problem was that work solving?"),
      step("decision", /결정|선택|시안|대안|컨셉|decision|option|concept/i, "여러 시안 중 그 방향을 택한 이유는 무엇이었나요?", "Why that direction over the other options?"),
      step("persuade", /설득|피드백|클라이언트|개발|PM|이해관계자|stakeholder|feedback/i, "반대 의견이 있을 때 어떻게 설득하셨나요?", "How did you win over people who disagreed?"),
      step("tradeoff", /일정|제약|포기|타협|현실|constraint|trade-?off/i, "일정이나 제약 때문에 타협한 부분은 무엇이었나요?", "What did you compromise on because of constraints?"),
      RESULT,
    ],
    pressure: [l("그 디자인이 예쁘다는 것 말고 효과가 있었다는 근거가 있나요?", "Beyond looking good, what shows the design worked?"), l("사용자 테스트 결과가 본인 생각과 반대였다면요?", "What if user testing had contradicted your view?")],
    signal: {
      label: l("디자인 의사결정", "Design reasoning"),
      evidence: /사용자|문제|근거|테스트|대안|의도|일관|가설|user|test|rationale|intent/i,
      present: l("사용자 문제와 근거를 들어 디자인 결정을 설명했습니다.", "Explains decisions through user problems and evidence."),
      missing: l("결과물 설명은 있지만 왜 그렇게 결정했는지가 드러나지 않습니다.", "Describes the output but not the reasoning."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  media_content: {
    archetype: "media_content",
    label: l("콘텐츠·미디어", "Content & media"),
    weights: { role_specific: 25, experience: 20, case: 15, industry: 15, behavioral: 15, ethics: 10 },
    chain: [
      step("intent", /기획|의도|주제|메시지|컨셉|idea|intent|concept/i, "그 콘텐츠의 기획 의도는 무엇이었나요?", "What was the intent behind that piece?"),
      step("audience", /시청자|독자|구독자|관객|타깃|audience|reader|viewer/i, "누구를 위한 콘텐츠였고, 어떻게 정하셨나요?", "Who was it for, and how did you decide?"),
      step("process", /취재|섭외|촬영|편집|제작|원고|interview|shoot|edit/i, "제작 과정에서 가장 어려웠던 부분은 무엇이었나요?", "What was the hardest part of producing it?"),
      step("check", /확인|검증|팩트|저작권|윤리|fact|verify|copyright/i, "사실 확인이나 저작권 같은 부분은 어떻게 챙기셨나요?", "How did you handle fact-checking or rights?"),
      RESULT,
    ],
    pressure: [l("조회수는 잘 나왔지만 의도와 다르게 소비됐다면 성공인가요?", "If it got views but was received against your intent, is that success?"), l("마감 직전에 사실관계가 불확실하다면 내보내시겠어요?", "Right before deadline with the facts unconfirmed, would you publish?")],
    signal: {
      label: l("기획력·책임감", "Editorial judgment"),
      evidence: /의도|기획|독자|시청자|반응|검증|팩트|윤리|메시지|audience|intent|verify/i,
      present: l("기획 의도와 수용자 반응을 연결해 설명했습니다.", "Connects intent and audience response."),
      missing: l("무엇을 만들었는지는 나오지만 기획 의도와 반응이 연결되지 않습니다.", "Describes output without intent or audience response."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  engineering_design: {
    archetype: "engineering_design",
    label: l("설계·엔지니어링", "Engineering design"),
    weights: { technical: 35, experience: 20, case: 15, analytical: 15, behavioral: 10, motivation: 5 },
    chain: [
      step("requirement", /요구|사양|스펙|조건|목표|requirement|spec/i, "그 설계의 핵심 요구조건은 무엇이었나요?", "What were the key requirements?"),
      step("decision", /선택|결정|설계|구조|재질|방식|design|choice|material/i, "왜 그 설계안을 선택하셨나요?", "Why that design?"),
      step("verify", /검증|시험|해석|시뮬레이션|측정|테스트|verify|test|simulat/i, "설계가 맞는지는 어떻게 검증하셨나요?", "How did you verify it?"),
      step("issue", /문제|불량|실패|오차|변경|issue|failure/i, "검증 과정에서 나온 문제는 어떻게 해결하셨나요?", "How did you solve problems that came up in testing?"),
      RESULT,
    ],
    pressure: [l("그 설계 여유율이 충분하다고 판단한 근거는 무엇인가요?", "What makes you sure the design margin was enough?"), l("원가를 20% 줄여야 한다면 설계에서 무엇을 바꾸시겠어요?", "If you had to cut cost by 20%, what would you change in the design?")],
    signal: {
      label: l("설계 근거·검증", "Design rigor"),
      evidence: /요구|사양|검증|시험|해석|측정|오차|공차|원리|근거|spec|verify|tolerance|test/i,
      present: l("요구조건과 검증 과정을 근거로 설명해 엔지니어링 역량이 드러납니다.", "Grounds design in requirements and verification."),
      missing: l("무엇을 설계했는지는 나오지만 검증 근거가 드러나지 않습니다.", "Describes the design without how it was verified."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  manufacturing_quality: {
    archetype: "manufacturing_quality",
    label: l("생산·품질·공정", "Manufacturing & quality"),
    weights: { role_specific: 20, technical: 20, situational: 20, analytical: 15, experience: 15, behavioral: 10 },
    chain: [
      step("problem", /불량|수율|차이|지연|고장|문제|클레임|defect|yield|downtime/i, "그때 현장에서 어떤 문제가 있었나요?", "What was the problem on the floor?"),
      step("cause", /원인|4M|5\s?Why|분석|데이터|특성|cause|root|analysis/i, "원인은 어떻게 찾으셨나요?", "How did you find the root cause?"),
      step("action", /조치|개선|변경|교체|조정|action|fix|adjust/i, "어떤 조치를 하셨나요?", "What did you do about it?"),
      step("prevent", /재발|표준|관리\s?계획|모니터링|SPC|FMEA|prevent|standard/i, "재발을 막기 위해 무엇을 표준화하셨나요?", "What did you standardize to prevent recurrence?"),
      RESULT,
    ],
    pressure: [l("납기와 품질이 충돌하면 어떻게 판단하시겠어요?", "If delivery and quality clash, how do you decide?"), l("그 조치 때문에 개선됐다는 것은 어떻게 확인하셨나요?", "How did you confirm it was your fix that made the difference?")],
    signal: {
      label: l("원인 분석·재발 방지", "Root cause & prevention"),
      evidence: /원인|4M|5\s?Why|데이터|재발|표준|수율|불량률|개선|root|yield|defect|standard/i,
      present: l("원인 분석과 재발 방지까지 이어진 문제 해결이 드러납니다.", "Goes from root cause to prevention."),
      missing: l("조치는 설명했지만 원인을 어떻게 확인했고 재발을 어떻게 막았는지가 없습니다.", "Describes a fix without root cause or prevention."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  field_construction: {
    archetype: "field_construction",
    label: l("건설·현장", "Construction"),
    weights: { role_specific: 25, situational: 25, technical: 15, experience: 15, behavioral: 10, ethics: 10 },
    chain: [
      step("site", /현장|공정|공사|시공|설계|site|construction/i, "그 현장의 상황을 조금 더 설명해 주시겠어요?", "Tell me more about that site."),
      step("constraint", /공기|일정|원가|품질|안전|민원|schedule|cost|safety/i, "공기·원가·품질·안전 중 무엇이 가장 큰 제약이었나요?", "Which constraint was tightest — schedule, cost, quality or safety?"),
      step("coordinate", /협력업체|발주처|감리|작업자|조율|협의|subcontract|client|coordinat/i, "협력업체나 발주처와는 어떻게 조율하셨나요?", "How did you coordinate with subcontractors or the client?"),
      step("safety", /안전|위험|점검|TBM|보호구|safety|hazard|inspection/i, "그 과정에서 안전은 어떻게 챙기셨나요?", "How did you keep it safe?"),
      RESULT,
    ],
    pressure: [l("공기가 급한데 안전 조치가 미흡하다면 작업을 멈추시겠어요?", "If the schedule is tight but safety measures are lacking, would you stop work?"), l("설계와 현장 여건이 맞지 않으면 누구의 판단을 따르시겠어요?", "When the design doesn't fit site conditions, whose call do you follow?")],
    signal: {
      label: l("현장 판단·안전 의식", "Site judgment & safety"),
      evidence: /안전|공정|품질|원가|협력|점검|위험|현장|safety|quality|inspection/i,
      present: l("공정·품질·안전을 함께 고려한 현장 판단이 드러납니다.", "Balances schedule, quality and safety on site."),
      missing: l("일정 이야기는 있지만 품질·안전 관점이 보이지 않습니다.", "Talks schedule without quality or safety."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  safety_environment: {
    archetype: "safety_environment",
    label: l("안전·환경", "Safety & environment"),
    weights: { situational: 25, role_specific: 25, ethics: 15, experience: 15, technical: 10, communication: 10 },
    chain: [
      step("hazard", /위험|유해|사고|누출|초과|아차|hazard|risk|leak/i, "그때 어떤 위험 요인이 있었나요?", "What hazard was involved?"),
      step("assess", /평가|점검|측정|분석|기준|assess|inspect|measure/i, "위험 수준은 어떻게 평가하셨나요?", "How did you assess the level of risk?"),
      step("action", /조치|중지|개선|교육|대책|stop|measure|training/i, "어떤 조치를 취하셨나요?", "What action did you take?"),
      step("persuade", /설득|현장|작업자|관리자|협조|persuad|workers|buy-?in/i, "현장이나 관리자의 협조는 어떻게 얻으셨나요?", "How did you get the site or managers on board?"),
      RESULT,
    ],
    pressure: [l("생산 목표 때문에 작업 중지를 반대한다면 어떻게 하시겠어요?", "If production targets made them oppose a work stoppage, what would you do?"), l("기준치를 살짝 넘긴 수치를 보고하지 말자고 한다면요?", "What if you were asked not to report a reading just over the limit?")],
    signal: {
      label: l("안전·규정 준수", "Safety & compliance"),
      evidence: /위험|평가|기준|법|규정|점검|예방|보고|안전|risk|standard|regulation|prevent/i,
      present: l("위험 평가와 기준에 근거한 조치가 드러납니다.", "Acts on risk assessment and standards."),
      missing: l("조치는 있지만 어떤 기준으로 위험을 판단했는지가 드러나지 않습니다.", "Doesn't show the standard used to judge the risk."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  research_science: {
    archetype: "research_science",
    label: l("연구개발", "Research"),
    weights: { technical: 25, analytical: 20, experience: 20, case: 15, reflection: 10, behavioral: 10 },
    chain: [
      step("hypothesis", /가설|목적|질문|목표|hypothes|aim|objective/i, "그 연구의 가설이나 목적은 무엇이었나요?", "What was the hypothesis or aim?"),
      step("method", /실험|설계|조건|방법|분석|대조군|method|experiment|control/i, "실험은 어떻게 설계하셨나요?", "How did you design the experiment?"),
      step("failure", /실패|안\s?됐|예상과|재현|오차|노이즈|fail|unexpected|reproduc/i, "예상과 다른 결과가 나왔을 때 어떻게 하셨나요?", "What did you do when results didn't match expectations?"),
      step("validate", /재현|검증|반복|통계|유의|validat|replicat|significan/i, "결과가 재현 가능하다는 것은 어떻게 확인하셨나요?", "How did you confirm the result was reproducible?"),
      RESULT,
    ],
    pressure: [l("그 결과를 다른 연구자가 재현하지 못한다면 무엇부터 의심하시겠어요?", "If others couldn't reproduce it, what would you suspect first?"), l("통계적으로 유의하다는 것 말고 실질적인 의미가 있었나요?", "Beyond statistical significance, did it matter in practice?")],
    signal: {
      label: l("연구 방법론", "Research methodology"),
      evidence: /가설|실험|설계|대조|변수|재현|검증|통계|방법|hypothes|experiment|control|variable|reproduc/i,
      present: l("가설·실험 설계·검증 과정을 짚어 방법론이 드러납니다.", "Shows hypothesis, design and validation."),
      missing: l("결과는 있지만 어떤 방법으로 검증했는지가 드러나지 않습니다.", "Gives results without the method or validation."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  clinical_care: {
    archetype: "clinical_care",
    label: l("의료·보건", "Healthcare"),
    weights: { situational: 30, role_specific: 25, behavioral: 15, ethics: 10, communication: 10, experience: 10 },
    chain: [
      step("patient", /환자|대상자|보호자|상태|patient|guardian/i, "그때 환자의 상태는 어땠나요?", "What was the patient's condition?"),
      step("priority", /우선|먼저|사정|활력|확인|priorit|assess|vital/i, "무엇을 가장 먼저 확인하셨나요?", "What did you check first?"),
      step("action", /조치|처치|보고|중재|투약|intervention|report/i, "어떤 조치를 하고 누구에게 보고하셨나요?", "What did you do, and who did you report to?"),
      step("safety", /안전|확인|이중|낙상|감염|오류|safety|double-?check|infection/i, "환자 안전을 위해 어떤 부분을 한 번 더 확인하셨나요?", "What did you double-check for patient safety?"),
      step("outcome", /호전|안정|반응|결과|improv|stable|outcome/i, "그 후 환자는 어떻게 되었나요?", "How did the patient do afterwards?"),
    ],
    pressure: [l("환자 안전과 업무 효율이 충돌한다면 어떻게 판단하시겠어요?", "If patient safety and efficiency conflict, how do you decide?"), l("선배의 지시가 환자에게 위험해 보인다면 어떻게 하시겠어요?", "If a senior's instruction looked unsafe for the patient, what would you do?")],
    signal: {
      label: l("환자 안전·소통", "Safety & communication"),
      evidence: /환자|안전|확인|보고|우선|설명|공감|보호자|이중|patient|safety|report|explain/i,
      present: l("환자 안전을 우선한 판단과 소통이 드러납니다.", "Puts patient safety first and communicates clearly."),
      missing: l("상황 설명은 있지만 환자 안전을 위해 무엇을 확인했는지가 드러나지 않습니다.", "Doesn't show what was checked for patient safety."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  education: {
    archetype: "education",
    label: l("교육", "Education"),
    weights: { role_specific: 25, situational: 25, experience: 15, communication: 15, behavioral: 10, ethics: 10 },
    chain: [
      step("learner", /학생|아이|학습자|유아|교육생|student|learner|child/i, "그 학생(학습자)은 어떤 상황이었나요?", "What situation was that learner in?"),
      step("goal", /목표|성취|목적|수준|goal|objective/i, "어떤 목표를 세우셨나요?", "What goal did you set?"),
      step("method", /수업|활동|방법|자료|피드백|상담|lesson|activity|method/i, "구체적으로 어떤 방법을 쓰셨나요?", "What method did you actually use?"),
      step("change", /변화|반응|성장|성적|달라|change|progress/i, "그 뒤 학생에게 어떤 변화가 있었나요?", "What changed for the learner afterwards?"),
      step("partner", /학부모|동료\s?교사|보호자|parent|colleague/i, "학부모나 동료 교사와는 어떻게 협력하셨나요?", "How did you work with parents or colleagues?"),
    ],
    pressure: [l("그 방법이 모든 학생에게 통하지 않는다면 어떻게 하시겠어요?", "If that method didn't work for every student, then what?"), l("학부모가 선생님의 방식에 강하게 항의한다면요?", "What if a parent strongly objected to your approach?")],
    signal: {
      label: l("학습자 중심성", "Learner focus"),
      evidence: /학생|학습자|아이|수준|피드백|변화|성장|배려|관찰|student|learner|feedback|progress/i,
      present: l("학습자의 상황과 변화에 초점을 맞춘 설명이 드러납니다.", "Focuses on the learner's situation and progress."),
      missing: l("교사가 한 일은 나오지만 학습자에게 어떤 변화가 있었는지가 드러나지 않습니다.", "Describes the teacher's actions, not the learner's change."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  social_care: {
    archetype: "social_care",
    label: l("복지·상담", "Social care & counseling"),
    weights: { situational: 25, role_specific: 25, ethics: 15, experience: 15, communication: 10, behavioral: 10 },
    chain: [
      step("client", /대상자|이용자|내담자|클라이언트|가정|client|family/i, "그 대상자는 어떤 상황이었나요?", "What situation was the client in?"),
      step("assess", /욕구|사정|파악|강점|위기|assess|needs|risk/i, "욕구나 위기 수준은 어떻게 파악하셨나요?", "How did you assess their needs or risk?"),
      step("intervene", /연계|개입|상담|지원|자원|intervention|referral|support/i, "어떤 지원이나 자원 연계를 하셨나요?", "What support or referral did you arrange?"),
      step("ethics", /비밀|자기결정|동의|윤리|경계|confidential|consent|boundar/i, "그 과정에서 윤리적으로 고민된 부분은 없었나요?", "Were there ethical dilemmas along the way?"),
      step("outcome", /변화|종결|결과|회복|change|outcome/i, "그 뒤 대상자에게 어떤 변화가 있었나요?", "What changed for the client afterwards?"),
    ],
    pressure: [l("대상자가 도움을 거부한다면 어디까지 개입하시겠어요?", "If the client refused help, how far would you intervene?"), l("비밀보장과 안전이 충돌하면 무엇을 우선하시겠어요?", "If confidentiality and safety conflict, which comes first?")],
    signal: {
      label: l("대상자 중심·윤리", "Client focus & ethics"),
      evidence: /대상자|이용자|내담자|욕구|강점|자기결정|비밀|윤리|연계|client|needs|consent|confidential/i,
      present: l("대상자의 욕구와 윤리를 고려한 개입이 드러납니다.", "Centers the client's needs and ethics."),
      missing: l("무엇을 했는지는 나오지만 대상자의 욕구와 자기결정이 드러나지 않습니다.", "Doesn't show the client's needs or self-determination."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  public_service: {
    archetype: "public_service",
    label: l("공공·행정", "Public service"),
    weights: { situational: 25, role_specific: 15, ethics: 15, behavioral: 15, experience: 15, motivation: 15 },
    chain: [
      step("situation", /민원|주민|국민|시민|업무|정책|citizen|public|policy/i, "그때 어떤 상황이었는지 조금 더 말씀해 주시겠어요?", "Tell me more about the situation."),
      step("rule", /규정|법령|지침|원칙|절차|rule|regulation|procedure/i, "어떤 규정이나 원칙을 근거로 판단하셨나요?", "Which rule or principle did you rely on?"),
      step("public", /공익|형평|공정|국민|주민|public interest|fair/i, "공익이나 형평성 측면에서는 어떻게 판단하셨나요?", "How did you weigh the public interest or fairness?"),
      step("coordinate", /부서|협의|보고|상급자|조율|department|report/i, "관련 부서나 상급자와는 어떻게 협의하셨나요?", "How did you coordinate with other departments or superiors?"),
      RESULT,
    ],
    pressure: [l("규정대로 하면 민원인이 불이익을 받는 상황이라면 어떻게 하시겠어요?", "If following the rules would hurt the citizen, what would you do?"), l("상급자가 규정에 맞지 않는 처리를 지시한다면요?", "What if a superior ordered something against the rules?")],
    signal: {
      label: l("공직가치·원칙", "Public-service values"),
      evidence: /규정|원칙|공익|청렴|형평|공정|절차|책임|국민|rule|integrity|public|fair/i,
      present: l("원칙과 공익을 함께 고려하는 태도가 드러납니다.", "Balances rules and the public interest."),
      missing: l("상황 대응은 있지만 어떤 원칙과 공익을 고려했는지가 드러나지 않습니다.", "Handles the case without stating principles or public interest."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
  general: {
    archetype: "general",
    label: l("일반", "General"),
    weights: { behavioral: 20, experience: 20, situational: 20, role_understanding: 15, motivation: 15, reflection: 10 },
    chain: [
      step("role", /제가|저는|맡|담당|역할|my role|I was/i, "그중 본인이 직접 맡은 역할은 무엇이었나요?", "What was your own role in it?"),
      step("why", /때문|이유|판단|근거|because|reason/i, "그렇게 판단한 이유는 무엇이었나요?", "Why did you decide that?"),
      step("difficulty", /어려|문제|갈등|장애|hard|problem/i, "그 과정에서 가장 어려웠던 점은 무엇이었나요?", "What was the hardest part?"),
      RESULT,
    ],
    pressure: [l("그건 누구나 할 수 있는 일 아닌가요? 본인만의 차별점은 무엇인가요?", "Couldn't anyone have done that? What was distinctly yours?"), l("그 판단이 틀렸다면 어떤 결과가 있었을까요?", "If that call had been wrong, what would have happened?")],
    signal: {
      label: l("직무 적합성", "Role fit"),
      evidence: /직무|업무|역량|경험|고객|성과|책임|role|responsib/i,
      present: l("경험을 직무와 연결해 설명했습니다.", "Connects the experience to the job."),
      missing: l("경험이 지원 직무와 어떻게 연결되는지가 드러나지 않습니다.", "Doesn't connect the experience to the job."),
    },
    jobInterview: l("직무 면접", "Job knowledge"),
  },
};

export function blueprintFor(archetype: Archetype | null | undefined): Blueprint {
  return BLUEPRINTS[archetype ?? "general"] ?? BLUEPRINTS.general;
}

/* ───────────────────────────── interview plan ────────────────────────── */

/** Question types that test job knowledge (vs. experience, situations, personality). */
export const TYPE_BUCKET: Record<QuestionType, "job" | "experience" | "situation" | "fit"> = {
  role_understanding: "job",
  role_specific: "job",
  technical: "job",
  case: "job",
  numerical: "job",
  analytical: "job",
  industry: "job",
  pt: "job",
  experience: "experience",
  behavioral: "experience",
  deep_dive: "experience",
  result: "experience",
  leadership: "experience",
  situational: "situation",
  challenge: "situation",
  ethics: "situation",
  debate: "situation",
  opening: "fit",
  motivation: "fit",
  company_understanding: "fit",
  reflection: "fit",
  communication: "fit",
};

export const BUCKET_LABEL: Record<"job" | "experience" | "situation" | "fit", L10n> = {
  job: l("직무", "Job"),
  experience: l("경험", "Experience"),
  situation: l("상황", "Situational"),
  fit: l("인성", "Fit"),
};

const JOB_TYPES = new Set<QuestionType>(["role_understanding", "role_specific", "technical", "case", "numerical", "analytical", "industry", "situational", "deep_dive", "experience"]);

function interviewWeights(bp: Blueprint, type: InterviewType, experience: ExperienceLevel, company: boolean): Weights {
  const base = { ...bp.weights };
  let w: Weights;
  switch (type) {
    case "hr":
      w = { motivation: 15, behavioral: 30, reflection: 15, ethics: 10, communication: 10, situational: 15, ...(company ? { company_understanding: 10 } : {}) };
      break;
    case "technical":
      w = Object.fromEntries(Object.entries(base).filter(([k]) => JOB_TYPES.has(k as QuestionType)));
      w.role_understanding = (w.role_understanding ?? 0) + 5;
      break;
    case "project":
      w = { experience: 35, deep_dive: 20, result: 15, challenge: 10, reflection: 10, behavioral: 10 };
      break;
    case "behavioral":
      w = { behavioral: 35, experience: 20, situational: 15, communication: 10, reflection: 10, leadership: 10 };
      break;
    default:
      w = { ...base, role_understanding: (base.role_understanding ?? 0) + 8, reflection: (base.reflection ?? 0) + 5, ...(company ? { company_understanding: 8 } : {}) };
  }
  if (experience === "entry") {
    w.role_understanding = (w.role_understanding ?? 0) + 5;
    delete w.leadership;
  } else if (experience === "senior" || experience === "mid") {
    w.leadership = (w.leadership ?? 0) + (experience === "senior" ? 10 : 5);
  }
  return w;
}

/** Smooth weighted round-robin: spreads types by weight without clumping. */
function weightedSequence(weights: Weights, n: number, avoidFirst?: QuestionType): QuestionType[] {
  const entries = Object.entries(weights).filter(([, v]) => (v ?? 0) > 0) as [QuestionType, number][];
  if (!entries.length) return [];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const current = new Map<QuestionType, number>(entries.map(([k]) => [k, 0]));
  const out: QuestionType[] = [];
  let prev = avoidFirst;
  while (out.length < n) {
    for (const [k, v] of entries) current.set(k, current.get(k)! + v);
    const sorted = [...current.entries()].sort((a, b) => b[1] - a[1]);
    // Never the same type twice in a row when there's another choice.
    const [pick] = sorted.find(([k]) => k !== prev) ?? sorted[0];
    current.set(pick, current.get(pick)! - total);
    out.push(pick);
    prev = pick;
  }
  return out;
}

export interface PlanInput {
  archetype: Archetype;
  interviewType: InterviewType;
  experience: ExperienceLevel;
  questionLimit: number;
  company?: boolean;
}

/**
 * The main-question sequence for an interview — e.g. for a mixed interview of a
 * performance marketer: opening → motivation → role_specific → case → analytical → …
 * → reflection. Follow-ups are decided separately, answer by answer.
 */
export function planInterview({ archetype, interviewType, experience, questionLimit, company = false }: PlanInput): QuestionType[] {
  const n = Math.max(1, questionLimit);
  const bp = blueprintFor(archetype);
  const plan: QuestionType[] = ["opening"];
  const opensWithMotivation = interviewType === "mixed" || interviewType === "hr";
  if (opensWithMotivation && n >= 3) plan.push(company ? "company_understanding" : "motivation");
  // Short interviews spend their few questions on the job; longer ones close with reflection.
  const closesWithReflection = interviewType !== "technical" && n >= 7;
  const bodyCount = n - plan.length - (closesWithReflection ? 1 : 0);
  const weights = interviewWeights(bp, interviewType, experience, company);
  // Opening/motivation/reflection are placed explicitly.
  delete weights.opening;
  if (opensWithMotivation) delete weights.motivation;
  if (closesWithReflection) delete weights.reflection;
  plan.push(...weightedSequence(weights, Math.max(0, bodyCount), plan[plan.length - 1]));
  if (closesWithReflection) plan.push("reflection");
  return plan.slice(0, n);
}

/** Share of each bucket in a plan, in percent (rounded, sums to 100). */
export function planComposition(plan: QuestionType[]): { bucket: keyof typeof BUCKET_LABEL; pct: number }[] {
  const counts = new Map<keyof typeof BUCKET_LABEL, number>();
  for (const t of plan) counts.set(TYPE_BUCKET[t], (counts.get(TYPE_BUCKET[t]) ?? 0) + 1);
  const rows = (["job", "experience", "situation", "fit"] as const).map((bucket) => ({ bucket, pct: Math.round(((counts.get(bucket) ?? 0) / plan.length) * 100) }));
  const drift = 100 - rows.reduce((s, r) => s + r.pct, 0);
  if (drift) rows.sort((a, b) => b.pct - a.pct)[0].pct += drift;
  return rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
}
