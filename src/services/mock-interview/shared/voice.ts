/**
 * Phrases that make the panel sound like a chatbot rather than an interviewer (see the humanizer
 * skill and PLAIN_VOICE in server/prompts/common.ts). Used by the prompt evaluation to count
 * how often a prompt version lets them through.
 */
const TELLS: [string, RegExp][] = [
  ["줄표", /[—–]/],
  ["화살표", /→/],
  ["느낌표", /!/],
  ["단순히 ~가 아니라", /단순히[^.?]{0,40}(?:아니라|아닌)/],
  ["~뿐만 아니라", /뿐만\s?아니라/],
  ["상투어", /핵심|인사이트|포인트|돋보였|인상적|훌륭합니다|효과적으로/],
  ["not X but Y", /\bnot (?:just|only|merely)\b[^.?]{0,60}\bbut\b/i],
  ["stock words", /\b(?:crucial|delve|robust|showcase|valuable|impressive)\b/i],
];

/** The tells found in a line the panel would say or write. */
export function chatbotTells(text: string): string[] {
  return TELLS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
