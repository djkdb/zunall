/** Korean particle helpers shared by the app and the server. */

/** Does the word, as read aloud in Korean, end in a final consonant (받침)? */
export function hasBatchim(word: string): boolean {
  const w = word.trim().replace(/[^\p{L}\p{N}]+$/u, "");
  const last = w.slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/\d/.test(last)) return "0136780".includes(last); // 영·일·삼·육·칠·팔·(십)
  // Acronyms are read letter by letter: L(엘) M(엠) N(엔) R(알) end in a consonant.
  if (/^[A-Z0-9]{2,}$/.test(w)) return "LMNR".includes(last);
  // English words: -m/-n/-l/-ng keep a final consonant ("Kotlin", "Python"); others add 으 ("React"→리액트).
  return /[mnl]$/i.test(w) || /ng$/i.test(w);
}

export type JosaPair = "을/를" | "이/가" | "은/는" | "와/과";

/** Pick the particle form that fits the word: josa("캐시", "을/를") → "를". */
export function josa(word: string, pair: JosaPair): string {
  const [withB, without] = pair.split("/");
  // "(재무회계)" / "(PM)" at the end is read as part of the word before it.
  const spoken = word.replace(/\s*\([^)]*\)\s*$/, "");
  return hasBatchim(spoken) ? withB : without;
}

/** Korean object particle 을/를 that reads naturally after the word. */
export function objectParticle(word: string): string {
  return josa(word, "을/를");
}

/** Fills {var} and {var:을/를}-style slots, choosing the particle to match the value. */
export function fillSlots(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)(?::(을\/를|이\/가|은\/는|와\/과))?\}/g, (_, k: string, pair?: JosaPair) => {
    const v = vars[k] ?? "";
    return pair ? v + josa(v, pair) : v;
  });
}
