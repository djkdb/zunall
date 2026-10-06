import type { CurrentTurn, InterviewContext } from "../shared/schemas";
import { QUESTION_TYPE_LABEL } from "../shared/labels";
import { blueprintFor } from "../shared/blueprints";
import { roleContextFor } from "../shared/roles";
import { GROUNDING_RULES, describeDocuments, roomRules, describeContext, interviewerIdentity, languageRule } from "./common";

/**
 * Decides whether to dig deeper into the answer just given, and if so writes
 * the follow-up. This is the core "the interviewer listened" moment.
 */
export async function followUpPrompt(ctx: InterviewContext, turn: CurrentTurn, depth: number) {
  const role = roleContextFor(ctx.config);
  const bp = blueprintFor(role.archetype);
  const system = `${interviewerIdentity(ctx.config)}

Your task: read the candidate's latest answer and decide whether a follow-up question on the same topic is the most valuable next question.

Ask a follow-up (needed=true) when the answer:
- makes a claim without explaining how (e.g. "I solved the performance problem" → how was the cause found?),
- is abstract or generic and needs one concrete example,
- describes the team's work but not the candidate's own actions or decisions,
- skips the result or impact,
- mentions an interesting decision or trade-off worth probing.

Do not ask a follow-up (needed=false) when the answer is already complete and specific, or the thread has been probed enough (the current depth comes with the request; above 1 prefer moving on). Also move on, without a follow-up, when the answer:
- repeats an earlier answer almost word for word,
- is only a resolution with no content ("열심히 하겠습니다", "최선을 다하겠습니다"),
- is a refusal or says the candidate doesn't know.

When the answer did not address the question at all, ask the same question again once in simpler words ("제가 여쭌 건 ~였는데요, …") — at depth 0 only.

Listen to what the candidate meant, not to keywords:
- Only ask "how did you …" about things the candidate said they actually did. A plan, a wish or a hypothetical ("~하겠습니다", "~하고 싶습니다", "저라면 …") is not an experience — test it instead ("그 방법이 통하지 않으면 어떻게 하시겠어요?") or move on.
- A word used in another sense is not a topic ("performance marketer" is not a performance problem; "회전 속도" is not a slow system).

How this field digs (${bp.label.en}): follow-ups usually move ${bp.chain.map((c) => `${c.key} ("${c.ask[ctx.config.language]}")`).join(" → ")}. Ask about the first step the answer has not covered yet, in the candidate's own terms.
${ctx.config.difficulty === "hard" ? `Hard (pressure) interview: when the answer is solid, push back the way this field's interviewers do, e.g. "${bp.pressure.map((p) => p[ctx.config.language]).join('", "')}". Stay respectful.` : ""}

A good follow-up:
- directly references something the candidate actually said — quote that phrase verbatim in "anchor",
- asks for exactly one missing piece,
- is short and natural, as a human interviewer would say it,
- stays inside ${role.title}'s work.

${roomRules(ctx.config)}
${GROUNDING_RULES}
${languageRule(ctx.config)}${describeDocuments(ctx.config, "ask")}`;

  const user = `${await describeContext(ctx)}

Current follow-up depth on this question: ${depth}.

## Latest question [${QUESTION_TYPE_LABEL[turn.type]}${turn.isFollowUp ? ", follow-up" : ""}]
${turn.question}

<candidate_answer>
${turn.answer}
</candidate_answer>

Decide on the follow-up.`;

  return { system, user };
}
