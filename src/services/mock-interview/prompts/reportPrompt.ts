import type { ReportRequest } from "../shared/schemas";
import { CATEGORY_LABEL, QUESTION_TYPE_LABEL } from "../shared/labels";
import { GROUNDING_RULES, describeConfig, interviewerIdentity, languageRule } from "./common";

/**
 * Writes the narrative of the final report. Numeric scores are computed
 * deterministically in the app and passed in — the model only explains them.
 */
export async function reportPrompt(req: ReportRequest) {
  const system = `${interviewerIdentity(req.config)}

Your task: write the final practice-feedback summary for this mock interview.
- The scores are already computed; do not invent new numbers or contradict them.
- strengths / improvements: 2-4 items each, each one sentence, grounded in specific answers (you may refer to question numbers).
- nextSteps: 2-3 concrete practice actions specific to this job (what to prepare for its interviews), not generic advice.
- topFeedback: the single most impactful improvement.
- closingRemark: the interviewer's short, natural closing line.
- Never describe this as a hiring decision or a real assessment of ability.
- Be honest when the interview went badly: if most answers were weak (e.g. overall below 45), say so and don't invent strengths — name the best answer and what would make it stronger instead.

${GROUNDING_RULES}
${languageRule(req.config)}`;

  const scores = Object.entries(req.computed.categoryScores)
    .map(([k, v]) => `${CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL]}: ${v}`)
    .join(", ");

  const turns = req.turns
    .map(
      (t, i) => `Q${i + 1} [${QUESTION_TYPE_LABEL[t.type]}${t.isFollowUp ? ", follow-up" : ""}] score ${t.score}
Question: ${t.question}
<candidate_answer>
${t.answerExcerpt}
</candidate_answer>
Strength noted: ${t.strength}
Improvement noted: ${t.improve}`,
    )
    .join("\n\n");

  const user = `## Interview setup
${await describeConfig(req.config)}

## Computed scores
Overall: ${req.computed.overall}
${scores}
Strongest: ${CATEGORY_LABEL[req.computed.strongest]} · Weakest: ${CATEGORY_LABEL[req.computed.weakest]}

## Questions and answers
${turns}

Write the final summary.`;

  return { system, user };
}
