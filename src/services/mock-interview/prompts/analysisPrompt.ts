import type { CurrentTurn, InterviewContext } from "../shared/schemas";
import { QUESTION_TYPE_LABEL } from "../shared/labels";
import { blueprintFor } from "../shared/blueprints";
import { roleContextFor } from "../shared/roles";
import { GROUNDING_RULES, describeConfig, describeDocuments, interviewerIdentity, languageRule } from "./common";

/** Scores a single answer with reasons grounded in the answer text. */
export async function analysisPrompt(ctx: InterviewContext, turn: CurrentTurn) {
  const role = roleContextFor(ctx.config);
  const bp = blueprintFor(role.archetype);
  const system = `${interviewerIdentity(ctx.config)}

Your task: evaluate one answer for practice feedback. This is a mock interview for practice, not a hiring decision.

Score each category 0-100 against the position (${role.title}) and experience level:
- relevance: does it answer the question that was asked?
- logic: is the reasoning coherent and causal?
- specificity: concrete situations, actions, tools, numbers — as actually stated.
- structure: clear order (e.g. situation → action → result), easy to follow.
- communication: concise, clear wording.
- confidence: ownership and decisiveness in the wording (hedging lowers it).

Calibration — be honest, not generous:
- 85+ only with clear, specific evidence in the answer.
- 60-75 for reasonable but generic answers.
- Below 50 for very short, vague or off-topic answers; relevance at most 40 when the answer doesn't address the question.
- Below 30 for a bare resolution with no content ("열심히 하겠습니다", "최선을 다하겠습니다").
- When the answer repeats one of the earlier answers listed below, relevance at most 40 and say so in the reasons and in "improve".
- Every reason must point to something in the answer or something missing from it.

STAR: set applicable=true for behavioral, project or experience questions. For each part give present / partial / missing and a short note. For purely conceptual technical questions set applicable=false and use status "missing" with an empty note.

betterAnswer: describe the main problem, how to improve, and an illustrative example sentence. The example must not state new facts as if they were the candidate's — use [bracketed placeholders] for any number or detail the candidate did not give.

roleSignal: on top of the six common scores, judge the role-specific signal for this job — "${bp.signal.label.ko}" (${bp.signal.label.en}) for ${role.title}. label = that signal's name in the candidate's language; note = one sentence on how the answer shows or lacks it, grounded in the answer. Use null when the answer gives nothing to judge it by. Do not change the numeric scores because of it.

evidence: up to 3 short phrases copied verbatim from the answer. notFound: up to 3 things the answer did not mention.

strength: if nothing in the answer deserves praise, say so plainly instead of inventing a strength.

reaction: one natural spoken sentence the interviewer says before continuing — e.g. a brief acknowledgement for a strong answer, or a gentle nudge when the answer was vague. Do not reveal scores in it and do not ask a question in it. Vary the wording; avoid stock lines such as "좋습니다. 핵심이 잘 전달됐습니다." that would repeat after every answer. A real interviewer usually says little: "네, 알겠습니다. 수치까지 말씀해 주셔서 이해가 됩니다."

${GROUNDING_RULES}
${languageRule(ctx.config)}${describeDocuments(ctx.config, "judge")}`;

  const user = `## Interview setup
${await describeConfig(ctx.config)}

## Question [${QUESTION_TYPE_LABEL[turn.type]}${turn.isFollowUp ? ", follow-up" : ""}]
${turn.question}

<candidate_answer>
${turn.answer}
</candidate_answer>
${earlier(ctx, turn)}
Evaluate this answer.`;

  return { system, user };
}

/** The candidate's earlier answers, only so a repeated answer can be recognized. */
function earlier(ctx: InterviewContext, turn: CurrentTurn): string {
  const others = ctx.history.filter((h) => !(h.question === turn.question && h.answer === turn.answer)).slice(-4);
  if (!others.length) return "";
  return `
## Earlier answers in this interview (for spotting repetition only — do not evaluate them)
${others.map((h, i) => `<earlier_answer n="${i + 1}">\n${h.answer.slice(0, 300)}\n</earlier_answer>`).join("\n")}
`;
}
