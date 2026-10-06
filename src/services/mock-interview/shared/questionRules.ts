/**
 * Questions this interview room can't support, whoever wrote them (the role bank, a company
 * bank or the AI): the panel has no portfolio, editor or whiteboard, it has the résumé and
 * cover letter only when the candidate submitted them, the self-introduction is asked once,
 * and a question can't open with "이 기술…" pointing at nothing that was said.
 */

/** "이력서에 적으신 …" — fine only when the candidate actually submitted documents. */
const DOC_REF =
  /(?:이력서|자기소개서|자소서)(?:에서?|를|을)\s?(?:보|적|쓴|쓰신|적으신|기재|말씀|언급)|제출(?:하신|해\s?주신)\s?서류|(?:on|in) your (?:resume|résumé|cv|cover letter)/i;

const NO_MATERIAL =
  /포트폴리오에\s?(?:적|쓴|쓰신|적으신|기재)|라이브\s?코딩|화이트보드|코드를\s?(?:직접\s?)?(?:작성|짜)|손으로\s?(?:풀|그려)|^이\s?(?:부분|코드|화면|문제|기술|방법|서비스|구조|설계|프로젝트)(?:을|를|은|는|이|가|의)?\s|(?:on|in) your portfolio|live[- ]?cod|whiteboard/i;

/** Anything that needs material the room doesn't have when no documents were submitted. */
export const NEEDS_MATERIAL = new RegExp(`${DOC_REF.source}|${NO_MATERIAL.source}`, "i");

/** Does the question need material the room doesn't have? */
export function needsMaterial(question: string, hasDocuments = false): boolean {
  const q = question.trim();
  return NO_MATERIAL.test(q) || (!hasDocuments && DOC_REF.test(q));
}

/** Does the question point at the submitted résumé / cover letter? */
export const refersToDocuments = (question: string): boolean => /이력서|자기소개서|자소서|제출(?:하신|해\s?주신)\s?서류|résumé|resume|cover letter/i.test(question);

/**
 * `askedSoFar`: questions already asked in this interview (a self-introduction is fine only first).
 * `hasDocuments`: the candidate submitted a résumé or cover letter, so the panel may cite them.
 */
export function unaskable(question: string, askedSoFar: number, hasDocuments = false): boolean {
  return needsMaterial(question, hasDocuments) || (askedSoFar > 0 && /자기\s?소개(?!서)|introduce yourself/i.test(question));
}
