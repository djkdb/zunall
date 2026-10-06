/** Text-to-speech for the interviewer's voice (browser speechSynthesis). */

export const isSpeechSynthesisSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let voicesCache: SpeechSynthesisVoice[] = [];
if (isSpeechSynthesisSupported()) {
  const load = () => (voicesCache = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

function pickVoice(lang: string, index = 0): SpeechSynthesisVoice | undefined {
  const prefix = lang.slice(0, 2).toLowerCase();
  const matches = voicesCache.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!matches.length) return undefined;
  // Prefer higher quality voices, then give each interviewer a different one when available.
  const ranked = [...matches].sort(
    (a, b) => Number(/google|natural|neural|premium|enhanced/i.test(b.name)) - Number(/google|natural|neural|premium|enhanced/i.test(a.name)),
  );
  return ranked[index % ranked.length];
}

export interface VoiceOptions {
  pitch?: number;
  rate?: number;
  /** Which of the available voices to use (so each interviewer sounds different). */
  voiceIndex?: number;
}

let current: { resolve: () => void } | null = null;

/** Speaks `text`; resolves when finished, cancelled, or failed (never rejects). */
export function speak(text: string, lang: string, opts: VoiceOptions = {}): Promise<void> {
  if (!isSpeechSynthesisSupported() || !text.trim()) return Promise.resolve();
  cancelSpeech();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = (lang.startsWith("ko") ? 1.05 : 1.0) * (opts.rate ?? 1);
    u.pitch = opts.pitch ?? 1;
    const voice = pickVoice(lang, opts.voiceIndex);
    if (voice) u.voice = voice;

    // Some browsers never fire `end`; cap by an estimated duration.
    const estimateMs = Math.min(30_000, 1200 + text.length * (lang.startsWith("ko") ? 110 : 65));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      if (current?.resolve === finish) current = null;
      resolve();
    };
    const safety = setTimeout(finish, estimateMs + 2500);
    u.onend = finish;
    u.onerror = finish;
    current = { resolve: finish };
    window.speechSynthesis.speak(u);
  });
}

export function cancelSpeech() {
  if (!isSpeechSynthesisSupported()) return;
  const c = current;
  current = null;
  window.speechSynthesis.cancel();
  c?.resolve();
}
