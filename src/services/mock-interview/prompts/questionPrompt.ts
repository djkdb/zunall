import type { InterviewContext } from "../shared/schemas";
import { QUESTION_TYPE_LABEL } from "../shared/labels";
import { roleContextFor } from "../shared/roles";
import { hasDocuments } from "../shared/documents";
import { refersToDocuments } from "../shared/questionRules";
import { GROUNDING_RULES, describeDocuments, roomRules, describeCandidates, describeContext, interviewerIdentity, languageRule, plannedNext } from "./common";

/** Generates the next *main* question (a new topic, not a follow-up). */
export async function questionPrompt(ctx: InterviewContext) {
  const isFirst = ctx.progress.asked === 0;
  const role = roleContextFor(ctx.config);
  const { next, plan } = plannedNext(ctx);
  const system = `${interviewerIdentity(ctx.config)}

Your task: choose the next main interview question for a ${role.title} candidate.

Question types (use the one that fits; not every job uses every type):
- opening: background / self-introduction. Use for the first question.
- motivation: why this job / field / organization.
- role_understanding: what the job really involves, key competencies, its hard parts.
- company_understanding: the organization (company mode only).
- behavioral: past behavior showing a competency (teamwork, conflict, ownership) in this job's context.
- experience: a concrete, job-related experience ("~한 경험을 말씀해 주세요").
- deep_dive: pick up a concrete situation the candidate mentioned earlier and explore it.
- situational: a realistic work situation in this job ("~라면 어떻게 하시겠어요?").
- role_specific: practical job knowledge and judgment (결산 절차, 간호 우선순위, 채용 평가 기준, 캠페인 지표…).
- technical: technical knowledge — ONLY for engineering, IT and science jobs.
- case / numerical / analytical: reason through a work case, numbers or causes.
- industry: the candidate's view of the industry or market (no trivia).
- leadership / communication / ethics: as named.
- challenge: a counter-scenario or pressure question.
- reflection: lessons, weaknesses, growth, values.
- result: verify outcomes, impact or metrics.
- pt / debate: a presentation or discussion prompt.

Rules:
- The interview blueprint (given with each request) recommends the type of the next question. Follow it unless building on something the candidate just said is clearly better.
- Every question must be about this job's real work — a ${role.title} must never get questions from another field (e.g. no software questions for an accountant or a nurse).
- Prefer a question from the role question bank below (as written or lightly adapted); in company mode mix in the company's questions for motivation, values and fit.
- Fit the experience level, interview type, difficulty and job description.
- Prefer building on something the candidate already said, so the interview feels like one conversation.
- Vary the type: do not use the same type as the previous question unless it is clearly best.
- Never repeat or closely paraphrase an already-asked question — including asking again about a job-posting requirement that has already been covered (e.g. a second question about K-IFRS).
- Difficulty: easy = broad and welcoming; normal = specific; hard = probing and sharp in this field's terms (constraints, trade-offs, "how do you know it was your contribution?").

${roomRules(ctx.config)}
${GROUNDING_RULES}
${languageRule(ctx.config)}${ctx.config.language === "en" ? "\nThe question bank is written in Korean — translate and adapt it into natural English." : ""}${describeDocuments(ctx.config, "ask")}`;

  const [context, candidates] = await Promise.all([describeContext(ctx, { next }), isFirst ? Promise.resolve("") : describeCandidates(ctx, next)]);
  const user = `${context}

${candidates}

Interview blueprint: the recommended next type is **${next}** (planned sequence: ${plan.join(" → ")}).
${hasDocuments(ctx.config.documents) ? `Document-based questions so far: ${ctx.askedQuestions.filter(refersToDocuments).length} of ${ctx.progress.asked} main questions asked (aim for about half of ${ctx.progress.total}).${isFirst ? " Open by saying briefly that the panel has read the submitted documents." : ""}
` : ""}
${isFirst ? "Ask the opening question. A short greeting clause is fine (e.g. 'Let's begin.')." : `Ask the next main question (recommended type: ${next} — ${QUESTION_TYPE_LABEL[next]}).`}`;

  return { system, user };
}
