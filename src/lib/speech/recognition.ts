/**
 * Web Speech API speech-to-text. Only ever started by an explicit user click;
 * audio is processed by the browser's speech service and never by this app.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isSpeechRecognitionSupported = (): boolean => getCtor() !== null;

export interface RecognizerHandlers {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (code: string) => void;
  onStop: () => void;
}

export interface Recognizer {
  start(): void;
  stop(): void;
}

export function createRecognizer(lang: string, h: RecognizerHandlers): Recognizer | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  let wanted = false;
  let rec: SpeechRecognitionLike | null = null;

  const boot = () => {
    rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) h.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      h.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted = false;
      h.onError(e.error);
    };
    rec.onend = () => {
      // Browsers end sessions after silence; keep listening while the user wants to.
      if (wanted) {
        try {
          boot();
          rec?.start();
          return;
        } catch {
          wanted = false;
        }
      }
      h.onInterim("");
      h.onStop();
    };
  };

  return {
    start() {
      wanted = true;
      boot();
      try {
        rec?.start();
      } catch {
        wanted = false;
        h.onError("start-failed");
      }
    },
    stop() {
      wanted = false;
      rec?.stop();
    },
  };
}
