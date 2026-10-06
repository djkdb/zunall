/**
 * MOCK MODE interviewer. Runs entirely in the browser with no API key.
 * It still behaves like an interviewer: it reads the answer, picks up the
 * candidate's own words for follow-ups, and grounds every score in the text.
 */
import {
  CATEGORY_KEYS,
  type AnswerAnalysis,
  type AnswerQuality,
  type CategoryKey,
  type CurrentTurn,
  type FinalReport,
  type FollowUpDecision,
  type GeneratedQuestion,
  type InterviewContext,
  type Language,
  type QuestionType,
  type ReportRequest,
  type StarPart,
} from "../shared/schemas";
import { clampScore, sanitizeAnalysis, sanitizeFollowUp } from "../shared/sanitize";
import { CATEGORY_LABEL } from "../shared/labels";
import { CATEGORY_KO } from "../labels-ko";
import { getCompany, loadCompanyQuestions, questionsForTrack, type CompanyQuestionCategory } from "../shared/companies";
import { blueprintFor, planInterview, TYPE_BUCKET } from "../shared/blueprints";
import { roleContextFor, type RoleContext } from "../shared/roles";
import { loadRoleProfile, questionPool, rankCandidates, typesFor } from "../shared/roleBank";
import { fillSlots } from "../shared/korean";
import { isDuplicateQuestion } from "../utils/fingerprint";
import { NEEDS_MATERIAL, refersToDocuments } from "../shared/questionRules";
import { documentClaims, documentQuestion, hasDocuments } from "../shared/documents";
import { hasProfanity, questionCoverage, repeatsEarlier, triageAnswer, type Triage } from "../shared/answerTriage";
import { delay } from "../utils/id";
import type { AIProvider } from "../provider-types";
import {
  GENERAL,
  JD_TECHNICAL,
  OPENING,
  TECHNICAL,
  TYPE_PLAN,
  roleFamily,
  type Localized,
} from "./questionBank";
import { CLOSING, hash, reactionFor } from "./phrases";
import { extractMethods, extractTechs, josa, objectParticle, quoteAround, readSignals, ROLE_TOPICS, splitSentences, topicPhrase, TOPICS, type Signals } from "./signals";

const L = (lang: Language, ko: string, en: string) => (lang === "ko" ? ko : en);

/** Fills {var} and {var:을/를}-style slots (the particle is chosen to match the value). */
const fill = fillSlots;

export class MockAIProvider implements AIProvider {
  readonly kind = "mock" as const;
  readonly label = "Mock Interviewer";

  constructor(private readonly latency = true) {}

  private wait(min: number, max: number) {
    return this.latency ? delay(min + Math.random() * (max - min)) : Promise.resolve();
  }

  /* ───────────────────────────── questions ───────────────────────────── */

  async generateQuestion(ctx: InterviewContext): Promise<GeneratedQuestion> {
    await this.wait(450, 900);
    const { config } = ctx;
    const lang = config.language;
    const asked = ctx.askedQuestions;
    const vars = { position: config.position, topic: "", jd: "" };

    // Earlier topics the candidate brought up — used to make "deep_dive" feel continuous.
    const earlierText = ctx.history.map((h) => h.answer).join("\n");
    const earlier = readSignals(earlierText, "", lang);
    const earlierTopic = TOPICS.find((t) => t.pattern.test(earlierText));
    vars.topic = earlier.project
      ? `‘${earlier.project}’`
      : earlier.roleClaim
        ? `‘${earlier.roleClaim}’`
        : earlierTopic
          ? earlierTopic.label[lang]
          : L(lang, "최근 프로젝트", "your recent project");

    const jdKeywords = [...extractTechs(config.jobDescription), ...extractMethods(config.jobDescription)];

    if (ctx.progress.asked === 0) {
      const openings = OPENING.filter((o) => o.tags?.includes(config.interviewType));
      const item = (openings.length ? openings : OPENING)[0];
      // "프로젝트" is how engineers talk; other jobs have work (or, for new graduates, experiences).
      const archetype = roleContextFor(config).archetype;
      const projectWord = archetype === "tech_dev" || archetype === "data_analytic" ? null : config.experience === "entry" ? "경험" : "업무";
      const text = fill(item[lang], vars);
      const question = projectWord && lang === "ko" ? text.replace("최근에 작업한 프로젝트", `최근에 맡았던 ${projectWord}`).replace("어려웠던 프로젝트", `어려웠던 ${projectWord}`) : text;
      if (hasDocuments(config.documents)) {
        const read = L(lang, "제출해 주신 서류는 잘 읽어 보았습니다. ", "We've read the documents you submitted. ");
        return { question: read + question, type: "opening", intent: L(lang, "서류에 없는 지원자의 모습을 파악합니다.", "See what the documents don't show.") };
      }
      return { question, type: "opening", intent: L(lang, "배경과 경험을 파악합니다.", "Understand background and experience.") };
    }

    // The job being interviewed for decides the plan (question types in order) and the bank.
    const role = roleContextFor(config);
    const company = getCompany(config.companyId);
    const plan = planInterview({ archetype: role.archetype, interviewType: config.interviewType, experience: config.experience, questionLimit: config.questionLimit, company: Boolean(company) });
    const mainIndex = Math.min(ctx.progress.asked, plan.length - 1);
    const planned = plan[mainIndex];
    const seed = hash(asked.join("|") + config.position);

    // Document-based interview: about half the main questions verify a claim from the résumé / cover letter.
    const fromDocuments = documentTurn(ctx, planned, mainIndex);
    if (fromDocuments) return fromDocuments;

    // Company + role interview: company questions for fit/motivation/culture, the role bank for the job.
    if (company && lang === "ko") {
      // The interview already opened with a self-introduction — skip the bank's "자기소개와 함께 …" variants.
      const bank = questionsForTrack(await loadCompanyQuestions(company.id), config.companyTrack).filter((q) => !/자기\s?소개/.test(q.text) && !NEEDS_MATERIAL.test(q.text) && !isDuplicateQuestion(q.text, asked));
      const bucket = TYPE_BUCKET[planned];
      const wantCompany = planned === "company_understanding" || planned === "motivation" || bucket === "fit" || (bucket !== "job" && mainIndex % 2 === 1) || (bucket === "job" && mainIndex % 3 === 0);
      if (wantCompany) {
        const cats = COMPANY_CATEGORIES_FOR[bucket];
        const pool = bank.filter((q) => cats.includes(q.category));
        const pick = (pool.length ? pool : bank)[seed % Math.max(1, (pool.length ? pool : bank).length)];
        if (pick) {
          return { question: pick.text, type: CATEGORY_TO_TYPE[pick.category], intent: `${company.name} ${pick.basis === "후기" ? "공개 면접 후기 기반" : "인재상·공식자료 기반"} ${pick.category} 질문` };
        }
      }
    }

    // Job posting: verify a stated requirement against real experience (once or twice per interview).
    const jdAsked = asked.filter((q) => q.includes("채용공고") || /job (?:description|posting)/i.test(q)).length;
    const jdReqs = extractJdRequirements(config.jobDescription);
    if (TYPE_BUCKET[planned] === "job" && jdAsked < Math.min(2, jdReqs.length) && mainIndex >= (config.interviewType === "technical" ? 1 : 2)) {
      const req = jdReqs[jdAsked];
      const q = L(lang, `채용공고에서 ${req}${josa(req, "을/를")} 요구하고 있는데, 실제 업무나 경험에서 어떻게 해 보셨나요?`, `The job posting asks for ${req}. How have you actually done that in your work or experience?`);
      if (!isDuplicateQuestion(q, asked)) return { question: q, type: "experience", intent: L(lang, "채용공고의 요구 역량을 실제 경험으로 검증합니다.", "Verify a posted requirement against real experience.") };
    }

    // Deep dive: pick up something the candidate already said, so it feels like one conversation.
    if (planned === "deep_dive" && earlierText.trim()) {
      const q = fill(GENERAL.deep_dive[0][lang], vars);
      if (!isDuplicateQuestion(q, asked)) return { question: q, type: "deep_dive", intent: intentFor("deep_dive", lang) };
    }

    // The role question bank: role → family → domain → common, filtered by type, level and repeats.
    const pool = await questionPool(role).catch(() => []);
    if (pool.length) {
      const usedCategories = asked.map((a) => pool.find((p) => p.text === a || fill(p.text, { role: role.title }) === a)?.category).filter((c): c is NonNullable<typeof c> => Boolean(c));
      const lastType = ctx.usedTypes[ctx.usedTypes.length - 1];
      const ranked = rankCandidates(pool, {
        ctx: role,
        types: typesFor(planned).filter((t) => t !== lastType || t === planned),
        difficulty: config.difficulty,
        experience: config.experience,
        language: lang,
        asked,
        usedCategories,
        limit: 6,
        seed,
      });
      // Don't re-ask a posting requirement the JD question already covered ("K-IFRS …" twice).
      const coveredReqs = jdReqs.slice(0, jdAsked).map((r) => r.split(/\s/)[0]).filter((w) => w.length >= 2);
      const fresh = ranked.filter((c) => !coveredReqs.some((w) => c.text.includes(w)) && !NEEDS_MATERIAL.test(c.text));
      const choices = fresh.length ? fresh : ranked;
      if (choices.length) {
        const pick = choices[seed % Math.min(3, choices.length)];
        return { question: pick.text, type: pick.q.type, intent: roleIntent(pick.q.type, role, lang) };
      }
    }

    // English interviews: role-specific prompts built from the role profile's topics.
    if (lang === "en") {
      const profile = await loadRoleProfile(role).catch(() => null);
      const topics = profile?.topics.en ?? [];
      for (const [i, topic] of topics.entries()) {
        if (asked.some((a) => a.toLowerCase().includes(topic.toLowerCase()))) continue;
        const tpl = EN_TEMPLATES[TYPE_BUCKET[planned]][(i + mainIndex) % EN_TEMPLATES[TYPE_BUCKET[planned]].length];
        const q = fill(tpl, { topic, role: role.titleEn });
        if (!isDuplicateQuestion(q, asked)) return { question: q, type: planned === "opening" ? "role_specific" : planned, intent: roleIntent(planned, role, lang) };
      }
    }

    // Last resort (bank unavailable or exhausted): the built-in general questions.
    const mainCount = ctx.usedTypes.length;
    const legacyPlan = TYPE_PLAN[config.interviewType];
    const lastType = ctx.usedTypes[ctx.usedTypes.length - 1];
    const order: QuestionType[] = [];
    for (let i = 0; i < legacyPlan.length; i++) order.push(legacyPlan[(mainCount + i) % legacyPlan.length]);
    // Don't ask for numbers the candidate just gave us.
    const recentlyQuantified = /\d/.test(ctx.history.slice(-2).map((h) => h.answer).join(" "));
    const candidatesTypes = order.filter(
      (t): t is Exclude<QuestionType, "opening"> => t !== "opening" && t !== lastType && !(t === "result" && recentlyQuantified),
    );

    for (const type of candidatesTypes) {
      const pool: Localized[] = [];
      if (type === "technical") {
        for (const kw of jdKeywords.slice(0, 3)) {
          for (const tpl of JD_TECHNICAL) pool.push({ ko: fill(tpl.ko, { jd: kw }), en: fill(tpl.en, { jd: kw }) });
        }
        const techRole = ["tech_dev", "data_analytic", "product_planning", "design_creative", "marketing_growth"].includes(roleContextFor(config).archetype);
        pool.push(...(techRole ? TECHNICAL[roleFamily(config.position)] : []), ...TECHNICAL.general);
      } else {
        const items = GENERAL[type as keyof typeof GENERAL] ?? [];
        const tagged = items.filter((i) => !i.tags || i.tags.includes(config.interviewType));
        pool.push(...tagged, ...items);
      }
      for (const item of pool) {
        const q = fill(item[lang], vars);
        if (!isDuplicateQuestion(q, asked)) {
          return { question: q, type, intent: intentFor(type, lang) };
        }
      }
    }
    // Everything used (very long interviews) — ask a generic reflection.
    return {
      question: L(lang, "마지막으로, 이 직무에서 꼭 보여드리고 싶은 본인의 강점은 무엇인가요?", "Finally, what strength would you most like to show in this role?"),
      type: "reflection",
      intent: intentFor("reflection", lang),
    };
  }

  /* ───────────────────────────── follow-ups ──────────────────────────── */

  async generateFollowUp(ctx: InterviewContext, turn: CurrentTurn, depth: number): Promise<FollowUpDecision> {
    await this.wait(600, 1100);
    const lang = ctx.config.language;
    const s = readSignals(turn.answer, turn.question, lang);
    const none = (reason: string): FollowUpDecision => ({ needed: false, question: "", type: "deep_dive", reason, anchor: "" });
    const asked = ctx.askedQuestions;
    const ok = (f: FollowUpDecision) => (isDuplicateQuestion(f.question, asked) ? null : sanitizeFollowUp(f, turn.answer));

    if (s.dontKnow) {
      return none(L(lang, "지원자가 잘 모른다고 답해 다른 주제로 넘어갑니다.", "The candidate didn't know; moving to another topic."));
    }
    const triage = triageAnswer(turn.answer, lang);
    if (triage) return none(L(lang, "평가할 수 있는 답변이 아니어서 다음 질문으로 넘어갑니다.", "Not an answer that can be followed up; moving on."));
    if (repeatsEarlier(turn.answer, earlierAnswers(ctx, turn))) {
      return none(L(lang, "앞선 답변을 반복해 다음 질문으로 넘어갑니다.", "Repeated an earlier answer; moving on."));
    }
    const dodge = dodgedQuestion(turn, s);
    if (dodge) {
      if (depth > 0) return none(L(lang, "다시 물었지만 질문과 다른 답변이어서 넘어갑니다.", "Still off the question; moving on."));
      const f = ok({
        needed: true,
        type: "deep_dive",
        anchor: "",
        question: L(lang, `제가 여쭌 건 ${dodge}에 관한 부분이었는데요, 그 부분에 대해 다시 말씀해 주시겠어요?`, `What I asked about was ${dodge} — could you answer that part?`),
        reason: L(lang, "답변이 질문의 핵심을 다루지 않아 같은 질문으로 다시 확인합니다.", "The answer missed the point of the question; asking again."),
      });
      if (f?.needed) return f;
    }
    // Already asked them to elaborate and it's still one line — a real interviewer moves on.
    const concrete = s.topics.length > 0 || s.methods.length > 0 || s.techs.length > 0 || Boolean(s.project || s.roleClaim || s.metric);
    if (turn.isFollowUp && s.chars < 25 && !concrete) {
      return none(L(lang, "추가 설명을 요청했지만 답변이 짧아 다음 질문으로 넘어갑니다.", "Still brief after a follow-up; moving on."));
    }
    if (isOffTopic(s)) {
      return none(L(lang, "질문과 관련성이 낮아 다음 주제로 넘어갑니다.", "Answer drifted off-topic; moving on."));
    }

    const topic = s.topics[0];
    const action = s.star.action > 0;
    const opening = turn.type === "opening";
    const role = roleContextFor(ctx.config);
    const bp = blueprintFor(role.archetype);
    const techish = role.archetype === "tech_dev" || role.archetype === "data_analytic";
    const threadText = [...ctx.history.map((h) => h.answer), turn.answer].join("\n");
    const candidates: FollowUpDecision[] = [];
    const push = (question: Localized, type: QuestionType, reason: Localized, anchor = "") =>
      candidates.push({ needed: true, question: question[lang], type, reason: reason[lang], anchor });

    // 1) Two+ concrete methods → ask them to pick the most effective one.
    if (s.methods.length >= 2) {
      const [a, b] = s.methods;
      push(
        { ko: `${a}, ${b} 중 가장 효과적이었던 방법 하나를 골라 설명해주세요.`, en: `Between ${a} and ${b}, pick the one that helped most and explain how you used it.` },
        "technical",
        { ko: `'${a}'${josa(a, "와/과")} '${b}'${josa(b, "을/를")} 언급했지만 각각을 어떻게 활용했는지는 설명되지 않았습니다.`, en: `Mentions '${a}' and '${b}' but not how each was used.` },
        a,
      );
    }

    // 2) A topic claim without the "how" — asked about the past, so only after a story, not a "저라면 …하겠습니다".
    const hypotheticalAnswer = /겠습니다|겠어요|하겠|할\s?것\s?같/.test(turn.answer) && !/(?:했|었|았|였)습니다/.test(turn.answer);
    if (topic && !hypotheticalAnswer && mentionedAsDone(turn.answer, topic.pattern) && (!action || s.chars < 40) && s.methods.length < 2) {
      const q = TOPIC_HOW[topic.id];
      if (q) push(q, "deep_dive", { ko: `'${topic.label.ko}'${josa(topic.label.ko, "을/를")} 언급했지만 해결 과정이 구체적으로 설명되지 않았습니다.`, en: `Mentions ${topic.label.en} but not how it was handled.` }, topicPhrase(turn.answer, topic.pattern));
    }

    // Hard (압박) interviews push back on a solid answer, the way this field's interviewers do.
    if (ctx.config.difficulty === "hard" && depth === 0 && s.chars >= 45 && !s.teamOnly && !opening) {
      const line = bp.pressure.find((p) => !isDuplicateQuestion(p[lang], asked));
      if (line) push(line, "challenge", { ko: "압박 면접: 답변의 근거가 버티는지 확인합니다.", en: "Pressure round: test whether the answer holds up." });
    }

    // JD question → did that skill actually change a decision or result?
    if (/채용공고|job posting/i.test(turn.question) && depth === 0) {
      const tool = s.techs[0] ?? s.methods[0];
      if (tool) {
        push(
          { ko: `그중 ${tool}${objectParticle(tool)} 활용해 실제 의사결정이나 결과를 바꾼 사례가 있었나요?`, en: `Was there a case where using ${tool} actually changed a decision or a result?` },
          "deep_dive",
          { ko: `채용공고 역량('${tool}')을 실제 성과와 연결해 확인합니다.`, en: `Tie the posted skill ('${tool}') to a real outcome.` },
          tool,
        );
      }
    }

    // Hypothetical ("what would you do if…") answers get a stress-test, not "what did you do".
    // That includes a situational or case question answered with a plan ("~하겠습니다").
    const hypothetical = turn.type === "challenge" || (["situational", "case", "ethics"].includes(turn.type) && /겠|would|I'd/.test(turn.answer));
    if (hypothetical && depth === 0 && s.chars >= 25) {
      push(
        /팀|합의|설득|동료|상사|team|agree/i.test(turn.answer)
          ? { ko: "만약 팀원들이 그 우선순위에 반대한다면 어떻게 설득하시겠어요?", en: "What if your team disagreed with those priorities — how would you persuade them?" }
          : { ko: "그렇게 했을 때 생길 수 있는 리스크는 무엇이고, 어떻게 대비하시겠어요?", en: "What risks does that choice create, and how would you handle them?" },
        "challenge",
        { ko: "가정 상황에 대한 판단 기준이 실제로 버틸 수 있는지 확인합니다.", en: "Stress-test the judgment behind the hypothetical answer." },
      );
    }

    // 3) Team did it — what did *you* do?
    // ("팀에서 일하고 싶었습니다" is a wish, not team work.)
    if (s.teamOnly && !hypothetical && mentionedAsDone(turn.answer, /팀|우리|저희|\bwe\b|\bteam\b/i)) {
      push(
        { ko: "그중 본인이 직접 해결한 부분은 무엇인가요?", en: "Which part of that did you personally handle?" },
        "deep_dive",
        { ko: "팀 단위의 활동은 설명했지만 본인의 역할이 확인되지 않습니다.", en: "Describes team work but not the candidate's own role." },
        turn.answer.match(/팀|우리|저희|\bwe\b|\bteam\b/i)?.[0] ?? "",
      );
    }

    // 3b) Job-specific things the candidate mentioned (결산, 환자, 캠페인, 불량, 민원…).
    // (In a self-introduction, the experience they named comes first — see rule 4.)
    const roleTopic = opening && (s.project || s.roleClaim) ? undefined : ROLE_TOPICS.find((t) => t.pattern.test(turn.answer) && mentionedAsDone(turn.answer, t.pattern));
    if (roleTopic && depth <= 1) {
      const anchor = turn.answer.match(roleTopic.pattern)?.[0] ?? "";
      push(roleTopic.ask, "deep_dive", { ko: `'${anchor}'${josa(anchor, "을/를")} 언급해 이 직무에서 중요한 판단 과정을 확인합니다.`, en: `Mentions '${anchor}' — probe the judgment this job depends on.` }, anchor);
    }
    // 3c) The field's own follow-up path (마케팅: 목표→타깃→채널→KPI, 회계: 기준→오류→처리…):
    // ask for the first step the answer (or this thread) hasn't covered yet.
    // The field's path ("그 후 환자는…", "그 업무에서…") presumes the answer told a story of something done.
    const story = s.star.action > 0 && /(?:했|었|았|였)/.test(turn.answer) && !/(?:겠습니다|겠어요|ㄹ\s?것)/.test(turn.answer.slice(-20));
    // Motivation answers tell why, not what was built; "어떤 기술을 선택하셨나요?" doesn't follow from them.
    const chainStep = !opening && story && s.chars >= 25 && turn.type !== "motivation" && turn.type !== "company_understanding" ? bp.chain.find((st) => !st.covered.test(threadText) && !isDuplicateQuestion(st.ask[lang], asked)) : undefined;
    const chainAsk = chainStep
      ? () =>
          push(chainStep.ask, chainStep.key === "result" ? "result" : "deep_dive", {
            ko: `${bp.label.ko} 직무 관점에서 아직 답변에 나오지 않은 부분을 확인합니다.`,
            en: `From a ${bp.label.en} angle, ask about what the answer hasn't covered yet.`,
          })
      : null;
    if (chainAsk && !techish) chainAsk();

    // 4) Something they owned or built — real interviewers dig into it.
    if (depth === 0 && (s.roleClaim || s.project)) {
      const k = s.roleClaim || s.project;
      push(
        s.roleClaim
          ? { ko: `${k}${objectParticle(k)} 맡으시면서 가장 어려웠던 점은 무엇이었나요?`, en: `What was the hardest part of owning ${k}?` }
          : { ko: `${k}${projectVerb(k)} 가장 어려웠던 점은 무엇이었나요?`, en: `What was the hardest part of ${k}?` },
        "deep_dive",
        { ko: `'${k}'${josa(k, "을/를")} 언급했지만 그 과정에서의 어려움과 본인의 판단은 아직 나오지 않았습니다.`, en: `Mentions '${k}' but not the challenges or the candidate's decisions.` },
        k,
      );
    }

    // 5) Actions but no result.
    if (action && s.star.result === 0 && s.numbers.length === 0 && !opening) {
      push(
        { ko: "그 결과 어떤 변화가 있었나요? 가능하면 수치로 말씀해주세요.", en: "What changed as a result? Numbers would help if you have them." },
        "result",
        { ko: "행동은 설명했지만 결과나 성과가 언급되지 않았습니다.", en: "Actions described, but no result or impact." },
      );
    }

    // 6) A number claim — verify how it was measured.
    if (depth === 0 && s.metric) {
      push(
        { ko: `말씀하신 '${s.metric}'${josa(s.metric, "은/는")} 어떻게 측정하거나 확인하셨나요?`, en: `How did you measure or verify the '${s.metric}' you mentioned?` },
        "result",
        { ko: `'${s.metric}'이라는 수치를 제시했지만 측정 방법은 언급되지 않았습니다.`, en: `Gives '${s.metric}' but not how it was measured.` },
        s.metric,
      );
    }

    // 7) A technology choice → why that one? (prefer frameworks/infra over languages)
    const tech = s.techs.find((t) => !/^(?:TypeScript|JavaScript|Java|Python|Go|Golang|Kotlin|Rust|SQL)$/i.test(t)) ?? (s.techs.length === 1 ? s.techs[0] : undefined) ?? (s.methods.length === 1 ? s.methods[0] : undefined);
    if (tech) {
      push(
        { ko: `${tech}${objectParticle(tech)} 선택한 이유는 무엇이었나요? 다른 대안과 비교해서 설명해주세요.`, en: `Why ${tech}? How did it compare to the alternatives?` },
        "technical",
        { ko: `'${tech}'${josa(tech, "을/를")} 사용했다고 했지만 선택 이유는 언급되지 않았습니다.`, en: `Uses '${tech}' but doesn't say why.` },
        tech,
      );
    }

    // Engineers get the field's path after the more specific technical probes above.
    if (chainAsk && techish) chainAsk();

    // 8) Too short to work with — ask them to expand (naturally, depending on the question).
    if (s.chars < 25) {
      push(
        opening
          ? { ko: "조금 더 자세히 말씀해 주시겠어요? 어떤 경험을 해 오셨는지 궁금합니다.", en: "Could you tell me a bit more? I'd like to hear what you've worked on." }
          : { ko: "조금 더 구체적으로 말씀해 주시겠어요? 실제 경험 한 가지를 예로 들어 주세요.", en: "Could you be more specific? Give me one real example." },
        "deep_dive",
        { ko: "답변이 짧아 판단할 근거가 부족합니다.", en: "The answer is too short to assess." },
      );
    }

    // 9) Vague (a substantial self-introduction is not "abstract" — move on instead).
    if (!action && !topic && s.methods.length === 0 && !s.project && !s.roleClaim && !(opening && s.chars > 80)) {
      push(
        { ko: "조금 추상적으로 들리는데, 실제 사례를 하나 들어주실 수 있을까요?", en: "That sounds a bit abstract — could you give me one real example?" },
        "deep_dive",
        { ko: "답변에서 구체적인 사례가 확인되지 않습니다.", en: "No concrete example in the answer." },
      );
    }

    // Deeper threads need a stronger reason to continue.
    if (depth >= 2) return none(L(lang, "이 주제는 충분히 다뤘습니다.", "This thread has been covered enough."));
    for (const c of candidates) {
      const f = ok(c);
      if (f && f.needed) return f;
    }
    return none(L(lang, "답변이 충분히 구체적이어서 다음 주제로 넘어갑니다.", "The answer was specific enough; moving on."));
  }

  /* ───────────────────────────── analysis ────────────────────────────── */

  async analyzeAnswer(ctx: InterviewContext, turn: CurrentTurn): Promise<AnswerAnalysis> {
    await this.wait(700, 1300);
    const lang = ctx.config.language;
    const s = readSignals(turn.answer, turn.question, lang);
    const seed = hash(turn.answer + turn.question);
    const jitter = (k: number) => ((seed >> k) % 7) - 3;

    const triage = triageAnswer(turn.answer, lang);
    if (triage && triage !== "clarify") return triagedAnalysis(triage, ctx, turn, seed);
    const platitude = isPlatitude(turn.answer);
    // Answers that don't address the question, or repeat an earlier answer, can't score on length alone.
    const repeated = !s.dontKnow && repeatsEarlier(turn.answer, earlierAnswers(ctx, turn));
    const dodge = s.dontKnow || repeated ? null : dodgedQuestion(turn, s);
    const profane = hasProfanity(turn.answer);

    const lengthBase = s.chars < 20 ? 34 : s.chars < 60 ? 52 : s.chars < 150 ? 64 : s.chars < 700 ? 71 : 65;
    // Complete, owned stories (situation → action → result, in first person, with numbers) earn a bonus.
    const completeness = (s.firstPerson ? 3 : 0) + (s.numbers.length ? 3 : 0) + (s.star.situation && s.star.action && s.star.result ? 4 : 0);
    const starCount = (["situation", "task", "action", "result"] as const).filter((k) => s.star[k] > 0).length;

    const raw: Record<CategoryKey, number> = {
      relevance: lengthBase + 6 + completeness + Math.min(18, s.questionOverlap * 60) + (s.topics.length ? 4 : 0),
      logic: lengthBase + completeness + Math.min(12, s.causal * 5) + Math.min(8, s.structureMarkers * 3),
      specificity: lengthBase - 6 + completeness + Math.min(16, s.numbers.length * 8) + Math.min(14, s.methods.length * 5) + Math.min(6, s.techs.length * 3),
      structure: lengthBase - 4 + completeness + starCount * 4 + Math.min(10, s.structureMarkers * 4),
      communication: lengthBase + 6 + completeness - s.fillers * 4 - (s.sentences.some((x) => x.length > 220) ? 8 : 0),
      confidence: lengthBase + completeness + (s.firstPerson ? 10 : 0) - s.hedges * 7,
    };
    // A fluent answer to a different question is still a miss: cap every category, relevance hardest.
    if (repeated || dodge) {
      for (const k of CATEGORY_KEYS) raw[k] = Math.min(raw[k] - 10, 55);
      raw.relevance = Math.min(raw.relevance, 35);
    }
    if (profane) {
      raw.communication -= 25;
      raw.confidence -= 10;
    }
    const scores = {} as AnswerAnalysis["scores"];
    CATEGORY_KEYS.forEach((k, i) => {
      scores[k] = { score: clampScore(raw[k] + jitter(i * 3)), reason: reasonFor(k, s) };
    });
    if (repeated) scores.relevance.reason = L(lang, "앞선 답변과 같은 내용을 반복했습니다.", "Repeats an earlier answer.");
    if (dodge) scores.relevance.reason = L(lang, `질문의 핵심('${dodge}')에 대한 답이 없습니다.`, `Doesn't address the question ('${dodge}').`);

    const avg = CATEGORY_KEYS.reduce((a, k) => a + scores[k].score, 0) / CATEGORY_KEYS.length;
    const quality: AnswerQuality =
      s.dontKnow || s.chars < 20 ? "insufficient" : repeated || dodge || isOffTopic(s) ? "off_topic" : avg >= 78 ? "strong" : avg >= 62 ? "adequate" : s.chars < 60 ? "insufficient" : "vague";

    const starApplicable = turn.type !== "technical" || /경험|사례|프로젝트|때|experience|time|project/i.test(turn.question);
    const part = (n: number, strongAt: number, notes: [string, string, string]): StarPart => ({
      status: n >= strongAt ? "present" : n > 0 ? "partial" : "missing",
      note: n >= strongAt ? notes[0] : n > 0 ? notes[1] : notes[2],
    });
    const star = {
      applicable: starApplicable,
      situation: part(s.star.situation, 1, [L(lang, "배경이 언급되었습니다.", "Context is given."), L(lang, "배경이 간략합니다.", "Context is brief."), L(lang, "상황 설명이 확인되지 않습니다.", "No situation described.")]),
      task: part(s.star.task, 1, [L(lang, "본인의 역할/목표가 드러납니다.", "Role/goal is stated."), L(lang, "역할이 암시만 됩니다.", "Role is only implied."), L(lang, "본인의 역할이나 목표가 확인되지 않습니다.", "No role or goal stated.")]),
      action: part(s.star.action + (s.firstPerson ? 1 : 0), 2, [L(lang, "직접 한 행동이 설명되었습니다.", "Personal actions are described."), L(lang, "행동이 있지만 본인 기여가 불분명합니다.", "Actions exist but personal contribution is unclear."), L(lang, "구체적인 행동이 확인되지 않습니다.", "No concrete actions described.")]),
      result: part(s.star.result + s.numbers.length, 2, [L(lang, "결과가 구체적으로 제시되었습니다.", "Result is specific."), L(lang, "결과가 언급되었지만 수치가 없습니다.", "Result mentioned without numbers."), L(lang, "결과가 확인되지 않습니다.", "No result mentioned.")]),
    };

    const evidence = [...s.numbers.map((n) => quoteAround(turn.answer, n.trim())), ...s.methods.map((m) => quoteAround(turn.answer, m)), ...s.techs.map((t) => quoteAround(turn.answer, t))]
      .filter(Boolean)
      .slice(0, 3);
    if (!evidence.length && s.sentences[0]) evidence.push(s.sentences[0].slice(0, 60));

    const notFound: string[] = [];
    if (!s.numbers.length) notFound.push(L(lang, "결과를 보여주는 수치", "Numbers showing the result"));
    if (!s.firstPerson) notFound.push(L(lang, "본인이 직접 한 역할", "Your personal role"));
    if (!s.methods.length && !s.techs.length) notFound.push(L(lang, "사용한 방법이나 도구", "Methods or tools used"));

    const sorted = [...CATEGORY_KEYS].sort((a, b) => scores[b].score - scores[a].score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    return sanitizeAnalysis(
      {
        quality,
        scores,
        star,
        strength: s.dontKnow
          ? L(lang, "모르는 부분을 솔직하게 인정했습니다.", "You were honest about what you don't know.")
          : avg < 45 || repeated || dodge
            ? L(lang, "이 답변에서는 뚜렷한 강점을 찾기 어려웠습니다.", "No clear strength came through in this answer.")
            : avg < 55
              ? s.firstPerson && s.chars >= 40
                ? L(lang, "본인의 입장을 분명하게 말했습니다.", "You stated your own position clearly.")
                : L(lang, "질문에 답하려는 시도는 보였습니다.", "You made an attempt at the question.")
              : strengthFor(best, s),
        improve: s.dontKnow
          ? L(lang, "모르는 질문도 '직접 해 보진 않았지만 저라면 ~부터 확인하겠습니다'처럼 접근 방법을 말하면 좋습니다.", "Even when you don't know, explain how you would approach it.")
          : platitude
            ? L(lang, "'열심히 하겠습니다' 같은 다짐은 답변이 되지 않습니다. 질문에 대한 본인의 생각이나 실제 경험을 한두 문장이라도 말해 보세요.", "A promise to work hard isn't an answer — give your actual view or one real example.")
            : repeated
            ? L(lang, "앞선 질문에 했던 답변을 그대로 반복했습니다. 질문마다 그 질문에 맞는 다른 경험이나 근거를 준비해 두세요.", "You repeated an earlier answer. Prepare a different example or reason for each question.")
            : dodge
              ? L(lang, `질문은 '${dodge}'에 관한 것이었는데 답변에서 다루지 않았습니다. 첫 문장에서 질문에 바로 답하고 경험을 덧붙이세요.`, `The question was about '${dodge}', which the answer didn't address. Answer it directly first, then add your experience.`)
              : profane
                ? L(lang, "면접에서 비속어는 내용과 상관없이 큰 감점 요인입니다. 정중한 표현으로 바꿔 말해 보세요.", "Profanity costs heavily in an interview whatever the content — rephrase politely.")
                : s.chars < 25
                  ? L(lang, "답변이 너무 짧습니다. 결론 한 문장에 근거가 되는 경험을 2~3문장 덧붙여 보세요.", "Too short — add two or three sentences of supporting experience.")
                  : improveFor(worst, s),
        betterAnswer: s.dontKnow
          ? {
              problem: L(lang, "답변을 포기함", "Declined to answer"),
              suggestion: L(lang, "모른다고 끝내지 말고 생각의 순서를 보여주기", "Show how you'd reason about it"),
              example: L(lang, "“직접 경험은 없지만, 저라면 먼저 [확인할 지표]를 보고 [접근 방법]으로 원인을 좁혀 보겠습니다.”", "“I haven't done it myself, but I'd start by checking [metric] and narrow it down with [approach].”"),
            }
          : betterAnswerFor(worst, s),
        roleSignal: roleSignalFor(ctx, turn.answer, s),
        evidence,
        notFound,
        reaction: s.dontKnow
          ? dontKnowReaction(ctx.config.persona, lang)
          : platitude && turn.type !== "opening"
            ? L(lang, "각오는 잘 들었습니다. 다만 제가 여쭌 것에 대한 답을 듣고 싶었습니다.", "I hear the commitment, but I was looking for an answer to the question.")
          : repeated
            ? L(lang, "앞에서 하신 말씀과 같은 내용이네요.", "That's the same as your earlier answer.")
            : // Rotate by turn so the same kind of answer doesn't get the same line every time.
              reactionFor(quality, ctx.config.persona, lang, ctx.progress.asked + (ctx.progress.followUps ?? 0)),
      },
      turn.answer,
    );
  }

  /* ───────────────────────────── report ──────────────────────────────── */

  async generateFinalReport(req: ReportRequest): Promise<FinalReport> {
    await this.wait(700, 1200);
    const lang = req.config.language;
    const { strongest, weakest, overall, categoryScores } = req.computed;
    const bestTurn = [...req.turns].sort((a, b) => b.score - a.score)[0];
    const worstTurn = [...req.turns].sort((a, b) => a.score - b.score)[0];
    const bestIdx = req.turns.indexOf(bestTurn) + 1;
    const worstIdx = req.turns.indexOf(worstTurn) + 1;
    const names = lang === "ko" ? CATEGORY_KO : CATEGORY_LABEL;
    const sName = names[strongest];
    const wName = names[weakest];

    // Mostly non-answers: say so plainly instead of praising what wasn't there.
    const barely = overall < 45;
    const headline = barely
      ? L(lang, "대부분의 질문에 평가할 만한 답변이 나오지 않아 판단 근거가 부족했습니다.", "Most questions didn't get an answer that could be assessed.")
      : overall >= 80
        ? L(lang, `대부분의 질문에 근거를 갖춰 답했습니다. 항목 중에서는 ${sName}${josa(sName, "이/가")} 가장 좋았습니다.`, `You backed up most answers. ${sName} was your best category.`)
        : overall >= 65
          ? L(lang, `답변의 뼈대는 갖췄습니다. ${wName}${josa(wName, "을/를")} 보완하면 점수가 가장 많이 오를 겁니다.`, `The basics are there. Work on ${wName} first; that's where your score moves most.`)
          : L(lang, `질문마다 무엇을 했고 결과가 어땠는지 더 구체적으로 말해야 합니다.`, `Say more concretely what you did and how it turned out.`);

    return {
      headline,
      topFeedback: barely
        ? L(lang, "모든 질문에 '결론 한 문장 + 근거가 되는 경험 두세 문장'으로 답하는 연습부터 시작해 보세요. 모르는 질문은 '잘 모르겠습니다'라고 정중하게 말해도 괜찮습니다.", "Start by answering every question with one sentence of conclusion plus two or three of supporting experience. It's fine to say politely that you don't know.")
        : TOP_FEEDBACK[weakest][lang],
      strengths:
        bestTurn.score >= 55
          ? [
              L(lang, `${sName} 점수가 ${categoryScores[strongest]}점으로 가장 높았습니다.`, `${sName} was your highest category at ${categoryScores[strongest]}.`),
              L(lang, `Q${bestIdx}: ${bestTurn.strength}`, `Q${bestIdx}: ${bestTurn.strength}`),
            ]
          : [L(lang, `가장 점수가 높았던 답변은 Q${bestIdx}(${bestTurn.score}점)였지만, 뚜렷한 강점으로 볼 만한 답변은 아직 없었습니다.`, `Your best answer was Q${bestIdx} (${bestTurn.score}), but no clear strength came through yet.`)],
      improvements: [
        L(lang, `가장 낮은 항목은 ${wName}(${categoryScores[weakest]}점)입니다.`, `Your lowest category was ${wName} (${categoryScores[weakest]}).`),
        L(lang, `Q${worstIdx}: ${worstTurn.improve}`, `Q${worstIdx}: ${worstTurn.improve}`),
      ],
      nextSteps: NEXT_STEPS[weakest][lang],
      closingRemark: CLOSING[req.config.persona][lang],
    };
  }
}

/* ───────────────────────────── copy helpers ──────────────────────────── */

const CATEGORY_TO_TYPE: Record<CompanyQuestionCategory, QuestionType> = {
  기업이해: "company_understanding",
  경험: "experience",
  인성: "reflection",
  상황: "situational",
  "PT·토론": "pt",
  직무: "role_specific",
  기술: "technical",
};

/** Which company-bank categories fit each part of the plan. */
const COMPANY_CATEGORIES_FOR: Record<"job" | "experience" | "situation" | "fit", CompanyQuestionCategory[]> = {
  fit: ["기업이해", "인성"],
  experience: ["경험", "인성"],
  situation: ["상황", "PT·토론"],
  job: ["직무", "기술", "PT·토론"],
};

/** English role prompts, built from the role profile's topics (the bank itself is Korean). */
const EN_TEMPLATES: Record<"job" | "experience" | "situation" | "fit", string[]> = {
  job: ["In a {role} role, how would you approach {topic}?", "Walk me through how you would handle {topic}.", "What do you pay most attention to when it comes to {topic}?"],
  experience: ["Tell me about a time you worked on {topic}.", "What is the hardest {topic} problem you've dealt with, and what did you do?"],
  situation: ["Suppose something went wrong with {topic} right before a deadline. What would you do first?", "If your manager and a client disagreed about {topic}, how would you handle it?"],
  fit: ["What draws you to {topic} as part of a {role} role?", "What have you done to prepare yourself for {topic}?"],
};

/**
 * Requirements stated in a job posting ("GA4 및 SQL 활용 능력", "B2B 영업 경험 우대")
 * → short phrases to verify ("GA4 및 SQL 활용", "B2B 영업").
 */
export function extractJdRequirements(jd: string): string[] {
  const out: string[] = [];
  for (const raw of jd.split(/\n|[•·▪■◦\-*]\s|[,;]|(?<=[.])\s/)) {
    const line = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim();
    const m = line.match(/^(.{2,28}?)\s*(?:에\s?대한|관련|업무)?\s*(?:경험|능력|역량|지식|이해|활용\s?능력|가능자|가능|보유자|우대|자격증|숙련|역량 보유)/);
    if (!m) continue;
    const phrase = m[1].replace(/\s*(?:을|를|의|에|과|와|및)$/u, "").replace(/^(?:관련|유관)\s*/, "").trim();
    if (phrase.length >= 2 && phrase.length <= 24 && !/^(?:해당|관련|직무|업무|원활한|우수한|뛰어난)$/.test(phrase)) out.push(phrase);
  }
  // Named tools come first ("React와 TypeScript"): they're the most concrete thing to verify.
  const tools = [...extractTechs(jd), ...extractMethods(jd)].slice(0, 2);
  const toolPhrase = tools.length === 2 ? `${tools[0]}${josa(tools[0], "와/과")} ${tools[1]}` : (tools[0] ?? "");
  const rest = out.filter((o) => !tools.some((t) => o.includes(t)));
  return [...new Set([toolPhrase, ...rest].filter(Boolean))].slice(0, 4);
}

/** "회계(재무회계) 직무의 실무 판단을 확인합니다." */
function roleIntent(type: QuestionType, role: RoleContext, lang: Language): string {
  const base = intentFor(type, lang);
  if (lang !== "ko" || !role.family) return base;
  return `${role.title} — ${base}`;
}

/** Role-specific feedback lens (회계 → 정확성·기준 준수, 간호 → 환자 안전·소통…). */
function roleSignalFor(ctx: InterviewContext, answer: string, s: Signals): AnswerAnalysis["roleSignal"] {
  if (s.dontKnow || s.chars < 25) return null;
  const bp = blueprintFor(roleContextFor(ctx.config).archetype);
  const lang = ctx.config.language;
  const present = bp.signal.evidence.test(answer);
  return { label: bp.signal.label[lang], note: (present ? bp.signal.present : bp.signal.missing)[lang] };
}

/**
 * The next question from the candidate's documents, when it's their turn: every other main
 * question (or the motivation slot meets a motivation claim, or the remaining slots are needed to reach half).
 */
function documentTurn(ctx: InterviewContext, planned: QuestionType, mainIndex: number): GeneratedQuestion | null {
  const { config, askedQuestions: asked } = ctx;
  if (!hasDocuments(config.documents)) return null;
  const target = Math.ceil((config.questionLimit - 1) / 2);
  const done = asked.filter(refersToDocuments).length - (refersToDocuments(asked[0] ?? "") ? 1 : 0);
  if (done >= target) return null;
  const options = documentClaims(config.documents)
    .filter((c) => !asked.some((a) => a.includes(c.quote)))
    .map((c) => documentQuestion(c, config.language))
    .filter((q) => !isDuplicateQuestion(q.question, asked));
  if (!options.length) return null;
  // The motivation slot is the natural place for the cover letter's motivation; otherwise the most askable claim (numbers first).
  const matching = planned === "motivation" ? options.find((q) => q.type === "motivation") : undefined;
  const remaining = config.questionLimit - mainIndex;
  if (!matching && mainIndex % 2 === 0 && remaining > target - done) return null;
  const lastType = ctx.usedTypes[ctx.usedTypes.length - 1];
  return matching ?? options.find((q) => q.type !== lastType) ?? options[0];
}

/** "쇼핑몰 프로젝트를 진행하면서", "결제 시스템을 만들면서", "현장실습에서" */
function projectVerb(k: string): string {
  if (/(?:서비스|기능|플랫폼|시스템|파이프라인|대시보드|앱)$/.test(k)) return `${objectParticle(k)} 만들면서`;
  if (/(?:프로젝트|캠페인)$/.test(k)) return `${objectParticle(k)} 진행하면서`;
  return "에서";
}

/** The topic comes up in something the candidate did, not in a plan or wish ("장애가 생기면 …하고 싶습니다"). */
function mentionedAsDone(answer: string, pattern: RegExp): boolean {
  const sentence = splitSentences(answer).find((x) => pattern.test(x)) ?? answer;
  return !/(?:싶습니다|싶어요|싶었습니다|겠습니다|겠어요|하려고|할\s?것|예정|would|will|want to)/.test(sentence) || /(?<!싶)(?:했|었|았|였)습니다/.test(sentence);
}

/** Answers to other questions. The follow-up request's history already contains this very turn. */
function earlierAnswers(ctx: InterviewContext, turn: CurrentTurn): string[] {
  return ctx.history.filter((h) => !(h.question === turn.question && h.answer === turn.answer)).map((h) => h.answer);
}

/** Nothing but a resolution ("열심히 하겠습니다", "최선을 다하겠습니다") in place of an answer. */
function isPlatitude(answer: string): boolean {
  const t = answer.replace(/\s+/g, "");
  return t.length <= 30 && /(?:열심히|최선을\s?다|성실히|노력하|배우겠|배우며|잘\s?하겠|하겠습니다)/.test(answer) && !/\d/.test(answer);
}

/** Question types about a specific subject, where an answer can miss the point (not open questions or follow-ups). */
// Knowledge questions only: a situational or case question can be answered well in entirely different words.
const SPECIFIC_TYPES = new Set<QuestionType>(["role_specific", "technical", "numerical", "analytical", "industry", "role_understanding"]);

/** The question's key phrase when a substantial answer picks up none of its content words. */
function dodgedQuestion(turn: CurrentTurn, s: Signals): string | null {
  if (turn.isFollowUp || !SPECIFIC_TYPES.has(turn.type) || s.chars < 25) return null;
  const { coverage, terms } = questionCoverage(turn.question, turn.answer);
  if (coverage > 0 || terms.length < 2) return null;
  return terms.slice(0, 2).join(", ");
}

/** A reply that isn't an answer: rude, meaningless, or a refusal. Scored low with feedback about the reply itself. */
function triagedAnalysis(kind: Exclude<Triage, "clarify">, ctx: InterviewContext, turn: CurrentTurn, seed: number): AnswerAnalysis {
  const lang = ctx.config.language;
  const strict = ctx.config.persona === "strict";
  const base = kind === "hostile" ? 4 : kind === "informal" ? 5 : kind === "nonsense" ? 6 : 10;
  const copy: Record<typeof kind, { reason: Localized; improve: Localized; problem: Localized; suggestion: Localized; example: Localized; reaction: Localized }> = {
    hostile: {
      reason: { ko: "면접에 적절하지 않은 표현으로, 답변 내용이 없습니다.", en: "Inappropriate language; no answer content." },
      improve: { ko: "면접에서는 어떤 질문이든 정중하게 답해야 합니다. 답하기 어렵다면 '잘 모르겠습니다'나 '잠시 생각해도 될까요?'라고 말하는 편이 훨씬 낫습니다.", en: "Answer every question politely. If you can't, saying 'I'm not sure' or asking for a moment is far better." },
      problem: { ko: "부적절한 표현", en: "Inappropriate language" },
      suggestion: { ko: "감정을 드러내기보다 정중하게 모른다고 말하거나 생각할 시간을 요청하기", en: "Instead of reacting, say you don't know or ask for a moment" },
      example: { ko: "“죄송합니다. 잠시 생각을 정리한 뒤 답변드려도 될까요?”", en: "“Sorry — may I take a moment to gather my thoughts?”" },
      reaction: strict
        ? { ko: "지금 답변은 면접에서 적절하지 않습니다. 다음 질문으로 넘어가겠습니다.", en: "That's not an appropriate answer in an interview. Next question." }
        : { ko: "면접 자리인 만큼 표현은 정중하게 부탁드립니다. 다음 질문으로 넘어가겠습니다.", en: "This is an interview, so please keep it polite. Let's move on." },
    },
    informal: {
      reason: { ko: "면접관에게 반말이나 채팅체로 답해 답변으로 평가할 수 없습니다.", en: "Answered the panel in an overly casual register." },
      improve: { ko: "면접에서는 짧은 대답이라도 '네, ~입니다', '잘 모르겠습니다'처럼 존댓말로 답해야 합니다. 반말이나 'ㅇㅇ' 같은 채팅체는 그 자체로 탈락 사유가 됩니다.", en: "Answer in a polite register even when brief — casual or chat-style replies alone can end an interview." },
      problem: { ko: "반말·채팅체 답변", en: "Casual, chat-style reply" },
      suggestion: { ko: "짧게 답하더라도 존댓말로, 결론 한 문장부터 말하기", en: "Even when brief, answer politely with a one-sentence conclusion" },
      example: { ko: "“네, 저는 [결론]이라고 생각합니다. 예를 들어 [경험]에서 …”", en: "“Yes — I think [conclusion]. For example, in [experience] …”" },
      reaction: { ko: "면접 자리에서 반말이나 채팅체로 답하시는 건 적절하지 않습니다.", en: "That's not an appropriate way to answer in an interview." },
    },
    nonsense: {
      reason: { ko: "의미 있는 답변 내용이 없습니다.", en: "No meaningful answer content." },
      improve: { ko: "의미 있는 답변이 입력되지 않았습니다. 결론 한 문장에 근거가 되는 경험 두세 문장을 붙여 답해 보세요.", en: "No real answer was given. Try one sentence of conclusion plus two or three of supporting experience." },
      problem: { ko: "답변 내용 없음", en: "No answer content" },
      suggestion: { ko: "짧더라도 질문에 대한 본인의 생각을 한 문장으로 먼저 말하기", en: "Say your view in one sentence, even briefly" },
      example: { ko: "“제 생각에는 [결론]입니다. 예를 들어 [경험]에서 [행동]을 했고, [결과]가 있었습니다.”", en: "“I think [conclusion]. For example, in [experience] I [action], which led to [result].”" },
      reaction: { ko: "답변을 알아듣기 어렵네요. 다음 질문으로 넘어가겠습니다.", en: "I couldn't make out an answer there. Let's move on." },
    },
    refuse: {
      reason: { ko: "답변을 거절해 평가할 내용이 없습니다.", en: "Declined to answer; nothing to assess." },
      improve: { ko: "답하기 어려운 질문도 짧게라도 생각을 말하는 것이 좋습니다. '경험은 없지만 저라면 ~하겠습니다'처럼 접근 방법을 보여 주세요.", en: "Even for hard questions, give a short view — e.g. 'I haven't done it, but I'd start by …'." },
      problem: { ko: "답변 거절", en: "Declined to answer" },
      suggestion: { ko: "모르거나 답하기 어려워도 생각의 방향을 짧게 말하기", en: "Give at least the direction of your thinking" },
      example: { ko: "“직접 겪어 본 적은 없지만, 저라면 먼저 [확인할 것]부터 보겠습니다.”", en: "“I haven't faced that myself, but I'd start by checking [X].”" },
      reaction: strict ? { ko: "알겠습니다. 다음으로 넘어가죠.", en: "Understood. Moving on." } : { ko: "알겠습니다. 다음 질문으로 넘어가겠습니다.", en: "All right. Let's go to the next question." },
    },
  };
  const c = copy[kind];
  const scores = {} as AnswerAnalysis["scores"];
  CATEGORY_KEYS.forEach((k, i) => {
    scores[k] = { score: clampScore(base + ((seed >> (i * 3)) % 5)), reason: c.reason[lang] };
  });
  const missing = (ko: string, en: string): StarPart => ({ status: "missing", note: L(lang, ko, en) });
  return sanitizeAnalysis(
    {
      quality: kind === "hostile" || kind === "informal" ? "off_topic" : "insufficient",
      scores,
      star: {
        applicable: false,
        situation: missing("상황 설명이 없습니다.", "No situation."),
        task: missing("역할이나 목표가 없습니다.", "No role or goal."),
        action: missing("행동 설명이 없습니다.", "No actions."),
        result: missing("결과가 없습니다.", "No result."),
      },
      strength: L(lang, "평가할 수 있는 답변 내용이 없었습니다.", "There was no answer content to assess."),
      improve: c.improve[lang],
      betterAnswer: { problem: c.problem[lang], suggestion: c.suggestion[lang], example: c.example[lang] },
      roleSignal: null,
      evidence: [],
      notFound: [L(lang, "질문에 대한 답변", "An answer to the question")],
      reaction: c.reaction[lang],
    },
    turn.answer,
  );
}

/** Only call an answer off-topic when there's nothing concrete to hold on to. */
function isOffTopic(s: Signals): boolean {
  return s.questionOverlap < 0.02 && s.chars > 80 && !s.topics.length && !s.methods.length && !s.techs.length && !s.project && !s.roleClaim;
}

function dontKnowReaction(persona: InterviewContext["config"]["persona"], lang: Language): string {
  if (persona === "strict") return L(lang, "알겠습니다. 다음으로 넘어가죠.", "Understood. Let's move on.");
  if (persona === "friendly") return L(lang, "괜찮아요. 다른 질문으로 넘어가 볼게요.", "That's fine — let's try another question.");
  return L(lang, "괜찮습니다. 다음 질문으로 넘어가겠습니다.", "That's alright. Let's move to the next question.");
}

const TOPIC_HOW: Record<string, Localized> = {
  performance: { ko: "그 성능 문제의 원인은 구체적으로 어떻게 찾으셨나요?", en: "How exactly did you find the cause of that performance issue?" },
  incident: { ko: "그 장애의 원인은 어떻게 파악하셨나요?", en: "How did you identify the root cause of that incident?" },
  conflict: { ko: "그 의견 차이는 구체적으로 어떻게 좁히셨나요?", en: "How exactly did you close that disagreement?" },
  deadline: { ko: "촉박한 일정 속에서 무엇을 먼저 하기로 결정하셨나요?", en: "Under that deadline, what did you decide to do first?" },
  architecture: { ko: "그 구조를 선택한 가장 큰 이유는 무엇이었나요?", en: "What was the main reason you chose that structure?" },
  data: { ko: "그 분석에서 어떤 지표를 가장 중요하게 보셨나요?", en: "Which metric did you focus on most in that analysis?" },
  user: { ko: "사용자의 문제를 어떤 방법으로 확인하셨나요?", en: "How did you confirm what the users' problem really was?" },
  collaboration: { ko: "협업 과정에서 본인이 맡은 역할은 무엇이었나요?", en: "What was your specific role in that collaboration?" },
  leadership: { ko: "팀을 이끌면서 가장 어려웠던 순간은 언제였나요?", en: "What was the hardest moment while leading the team?" },
  failure: { ko: "그 실패의 원인을 스스로 어떻게 분석하셨나요?", en: "How did you analyze why it failed?" },
  learning: { ko: "새로운 내용을 익힐 때 어떤 방법이 가장 효과적이었나요?", en: "What method worked best for you when learning it?" },
};

function intentFor(type: QuestionType, lang: Language): string {
  const m: Record<QuestionType, Localized> = {
    opening: { ko: "배경과 경험을 파악합니다.", en: "Understand background." },
    motivation: { ko: "지원 동기와 직무 선택의 이유를 확인합니다.", en: "Check motivation for the role." },
    role_understanding: { ko: "직무를 얼마나 이해하고 있는지 확인합니다.", en: "Check understanding of the role." },
    company_understanding: { ko: "지원 조직에 대한 이해도를 확인합니다.", en: "Check understanding of the organization." },
    behavioral: { ko: "과거 행동으로 역량을 확인합니다.", en: "Assess competencies through past behavior." },
    experience: { ko: "직무와 관련된 실제 경험을 확인합니다.", en: "Check real, role-related experience." },
    deep_dive: { ko: "구체적인 상황을 깊게 확인합니다.", en: "Dig into a concrete situation." },
    situational: { ko: "실제 업무 상황에서의 판단을 봅니다.", en: "Test judgment in a realistic work situation." },
    role_specific: { ko: "직무 실무 지식과 판단 기준을 확인합니다.", en: "Check practical job knowledge and judgment." },
    technical: { ko: "기술적 판단 기준을 확인합니다.", en: "Check technical decision-making." },
    case: { ko: "사례를 구조적으로 풀어가는 방식을 봅니다.", en: "See how a case is reasoned through." },
    numerical: { ko: "숫자와 지표를 다루는 감각을 확인합니다.", en: "Check comfort with numbers and metrics." },
    analytical: { ko: "원인과 근거를 분석하는 방식을 봅니다.", en: "See how causes and evidence are analyzed." },
    industry: { ko: "산업과 시장에 대한 관점을 확인합니다.", en: "Check perspective on the industry." },
    leadership: { ko: "사람을 이끌고 영향을 주는 방식을 봅니다.", en: "See how the candidate leads and influences." },
    communication: { ko: "설명하고 설득하는 방식을 봅니다.", en: "See how the candidate explains and persuades." },
    ethics: { ko: "원칙과 윤리적 판단을 확인합니다.", en: "Check integrity and ethical judgment." },
    challenge: { ko: "예상치 못한 상황에서의 판단을 봅니다.", en: "Test judgment under a counter-scenario." },
    reflection: { ko: "경험에서 배운 점을 확인합니다.", en: "Check learning and self-awareness." },
    result: { ko: "성과와 임팩트를 검증합니다.", en: "Verify outcomes and impact." },
    pt: { ko: "주제를 구조화해 발표하는 역량을 봅니다.", en: "See how a topic is structured and presented." },
    debate: { ko: "근거를 들어 입장을 세우는 방식을 봅니다.", en: "See how a position is argued with evidence." },
  };
  return m[type][lang];
}

function reasonFor(k: CategoryKey, s: Signals): string {
  const ko = s.lang === "ko";
  switch (k) {
    case "relevance":
      return s.questionOverlap > 0.12 || s.topics.length
        ? ko ? "질문의 핵심 주제에 맞춰 답변했습니다." : "Stays on the question's topic."
        : ko ? "질문과 답변의 연결이 약하게 느껴집니다." : "The link to the question feels weak.";
    case "logic":
      return s.causal > 0
        ? ko ? "원인과 결과를 연결해 설명했습니다." : "Connects causes and effects."
        : ko ? "왜 그렇게 했는지에 대한 이유가 드러나지 않습니다." : "The 'why' behind decisions is missing.";
    case "specificity":
      if (s.numbers.length) return ko ? `수치(${s.numbers[0].trim()})를 사용해 구체성이 높습니다.` : `Uses numbers (${s.numbers[0].trim()}), which adds precision.`;
      if (s.methods.length || s.techs.length) {
        const k2 = [...s.methods, ...s.techs].slice(0, 2).join(", ");
        return ko ? `사용한 방법(${k2})을 언급했지만 수치는 없습니다.` : `Names methods (${k2}) but gives no numbers.`;
      }
      return ko ? "구체적인 방법, 도구, 수치가 확인되지 않습니다." : "No concrete methods, tools or numbers.";
    case "structure":
      return s.structureMarkers > 0 || (s.star.situation && s.star.action && s.star.result)
        ? ko ? "상황, 행동, 결과 순서가 비교적 분명합니다." : "Situation, action, result flow is fairly clear."
        : ko ? "답변의 순서가 정리되어 있지 않습니다." : "The answer lacks a clear order.";
    case "communication":
      return s.chars < 25
        ? ko ? "답변이 너무 짧아 전달력이 제한적입니다." : "Too short to communicate much."
        : s.fillers > 1
          ? ko ? "군더더기 표현이 전달을 방해합니다." : "Filler words get in the way."
          : ko ? "문장이 간결하게 전달됩니다." : "Sentences are concise.";
    case "confidence":
      return s.hedges > 0
        ? ko ? "'~것 같다' 같은 표현이 확신을 약하게 만듭니다." : "Hedging phrases weaken the answer."
        : s.firstPerson
          ? ko ? "본인이 주도한 부분을 분명하게 말했습니다." : "Clearly owns the actions described."
          : ko ? "본인의 기여가 드러나지 않아 확신이 약해 보입니다." : "Personal ownership isn't clear.";
  }
}

function strengthFor(k: CategoryKey, s: Signals): string {
  const ko = s.lang === "ko";
  const m: Record<CategoryKey, string> = {
    relevance: ko ? "묻는 내용에 첫 문장부터 바로 답했습니다." : "Answered the actual question directly.",
    logic: ko ? "왜 그렇게 판단했는지 이유를 함께 말했습니다." : "Explained the reasoning logically.",
    specificity: ko ? "실제로 쓴 방법과 사례를 들어 답했습니다." : "Backed the answer with concrete methods and examples.",
    structure: ko ? "상황, 한 일, 결과 순서로 말해 따라가기 쉬웠습니다." : "Well structured from situation to result.",
    communication: ko ? "문장이 짧아 알아듣기 쉬웠습니다." : "Concise and easy to follow.",
    confidence: ko ? "본인의 역할과 결정을 분명하게 말했습니다." : "Spoke clearly about your own role and decisions.",
  };
  return s.chars < 20 ? (ko ? "질문에 바로 답하려는 태도가 보였습니다." : "You responded directly.") : m[k];
}

function improveFor(k: CategoryKey, s: Signals): string {
  const ko = s.lang === "ko";
  const m: Record<CategoryKey, string> = {
    relevance: ko ? "질문이 묻는 핵심에 먼저 답한 뒤 배경을 덧붙이세요." : "Answer the core of the question first, then add context.",
    logic: ko ? "왜 그 방법을 선택했는지 이유를 한 문장 추가하세요." : "Add one sentence on why you chose that approach.",
    specificity: ko ? "성과를 수치로 표현하면 더 명확합니다." : "Quantify the outcome to make it clearer.",
    structure: ko ? "상황, 한 일, 결과 순서로 정리해 말해 보세요." : "Try ordering it as situation, action, then result.",
    communication: ko ? "한 문장에 하나의 내용만 담아 간결하게 말해보세요." : "Keep one idea per sentence.",
    confidence: ko ? "'저는 ~을 했습니다'처럼 본인의 행동을 주어로 말해보세요." : "Use 'I did…' to make your own actions explicit.",
  };
  return m[k];
}

function betterAnswerFor(k: CategoryKey, s: Signals): AnswerAnalysis["betterAnswer"] {
  const ko = s.lang === "ko";
  const m: Record<CategoryKey, AnswerAnalysis["betterAnswer"]> = {
    relevance: {
      problem: ko ? "질문의 핵심과 답변의 초점이 어긋남" : "Focus drifts from the question",
      suggestion: ko ? "첫 문장에서 질문에 대한 결론을 먼저 말하기" : "Lead with a one-sentence direct answer",
      example: ko ? "“가장 어려웠던 점은 [핵심 문제]였고, 저는 [해결 방법]으로 해결했습니다.”" : "“The hardest part was [core problem], and I solved it by [approach].”",
    },
    logic: {
      problem: ko ? "결정의 이유가 드러나지 않음" : "Reasoning behind decisions is missing",
      suggestion: ko ? "선택지와 선택 이유를 함께 말하기" : "State the options and why you picked one",
      example: ko ? "“[대안 A]와 [대안 B]를 비교했고, [기준] 때문에 [선택]을 택했습니다.”" : "“I compared [option A] and [option B] and chose [choice] because of [criterion].”",
    },
    specificity: {
      problem: ko ? "성과가 추상적임" : "The outcome is abstract",
      suggestion: ko ? "수치를 사용해 결과를 설명" : "Describe the result with numbers",
      example: ko ? "“[지표]를 [이전 수치]에서 [개선 수치]로 개선했습니다.”" : "“I improved [metric] from [before] to [after].”",
    },
    structure: {
      problem: ko ? "답변 흐름이 정리되지 않음" : "The answer has no clear flow",
      suggestion: ko ? "STAR(상황-과제-행동-결과) 순서로 말하기" : "Follow STAR: situation, task, action, result",
      example: ko ? "“[상황]에서 저는 [과제]를 맡았고, [행동]을 해서 [결과]를 만들었습니다.”" : "“In [situation], I owned [task], did [action], and achieved [result].”",
    },
    communication: {
      problem: ko ? "문장이 길거나 불필요한 표현이 많음" : "Long sentences or filler",
      suggestion: ko ? "결론, 근거, 결과를 짧은 문장으로" : "Short sentences: point, evidence, result",
      example: ko ? "“핵심은 [요점]입니다. [근거] 덕분에 [결과]가 나왔습니다.”" : "“The key point is [point]. Because of [evidence], we got [result].”",
    },
    confidence: {
      problem: ko ? "본인의 기여가 불분명하거나 표현이 조심스러움" : "Ownership is unclear or hedged",
      suggestion: ko ? "'저는'을 주어로, 단정적인 표현 사용" : "Use 'I' and decisive wording",
      example: ko ? "“저는 [구체적 행동]을 직접 제안하고 실행했습니다.”" : "“I personally proposed and executed [specific action].”",
    },
  };
  return m[k];
}

const TOP_FEEDBACK: Record<CategoryKey, Localized> = {
  relevance: { ko: "첫 문장에서 질문에 바로 답하세요. 설명은 그다음에 붙여도 됩니다.", en: "Answer the question in your first sentence, then explain." },
  logic: { ko: "무엇을 했는지 말한 뒤, 왜 그렇게 판단했는지 한 문장을 덧붙여 보세요.", en: "After saying what you did, add one sentence on why you decided to." },
  specificity: { ko: "무엇을 했고 그 결과 무엇이 얼마나 달라졌는지 숫자로 말하는 연습이 가장 필요합니다.", en: "Say what you did and how much changed, in numbers. That's what was missing most." },
  structure: { ko: "상황, 행동, 결과 순서로 말하면 듣는 사람이 따라가기 쉽습니다.", en: "Tell it as situation, action, result so the panel can follow." },
  communication: { ko: "한 문장에 한 가지 내용만 담아 짧고 명확하게 말하는 연습을 해보세요.", en: "Practice short sentences with one idea each." },
  confidence: { ko: "'저는 ~했습니다'처럼 본인의 역할과 결정을 분명하게 말해보세요.", en: "State your own role and decisions plainly: 'I did…'." },
};

const NEXT_STEPS: Record<CategoryKey, Record<Language, string[]>> = {
  relevance: { ko: ["질문을 한 문장으로 요약한 뒤 답변 시작하기", "결론 먼저 말하는 연습 5회"], en: ["Restate the question in one line before answering", "Practice answer-first responses 5 times"] },
  logic: { ko: ["주요 경험마다 '왜?'를 3번 적어보기", "대안을 비교하고 고른 이유를 말하는 순서로 답변 정리"], en: ["Write 'why?' three times for each key experience", "Frame answers as options, choice, then reason"] },
  specificity: { ko: ["대표 경험 3개에 대해 전후 수치 정리하기", "사용한 도구와 방법을 한 줄씩 적어두기"], en: ["Write before/after numbers for 3 key experiences", "List the tools and methods you used for each"] },
  structure: { ko: ["대표 경험을 STAR 템플릿으로 정리하기", "1분 안에 STAR로 말하는 연습"], en: ["Rewrite key stories with a STAR template", "Practice 1-minute STAR answers"] },
  communication: { ko: ["답변을 녹음해 군더더기 표현 체크하기", "한 문장 30자 이내로 말하는 연습"], en: ["Record answers and count filler words", "Keep sentences under ~15 words"] },
  confidence: { ko: ["'저는'으로 시작하는 문장으로 경험 다시 말하기", "'~것 같다' 표현을 줄이는 연습"], en: ["Retell experiences starting with 'I'", "Remove hedges like 'I think' / 'maybe'"] },
};
