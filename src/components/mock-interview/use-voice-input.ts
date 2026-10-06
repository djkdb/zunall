"use client";

import * as React from "react";
import { createRecognizer, isSpeechRecognitionSupported, type Recognizer } from "@/lib/speech/recognition";

const ERROR_COPY: Record<string, string> = {
  "not-allowed": "마이크 권한이 거부되었습니다. 글로 답해도 됩니다.",
  "service-not-allowed": "이 브라우저에서는 음성 인식을 쓸 수 없습니다. 글로 답해 주세요.",
  "audio-capture": "마이크를 찾지 못했습니다. 글로 답해 주세요.",
  network: "음성 인식에는 인터넷 연결이 필요합니다. 글로 답해 주세요.",
  "start-failed": "녹음을 시작하지 못했습니다. 다시 누르거나 글로 답해 주세요.",
};

/**
 * 말로 답하기 (브라우저 음성 인식). 버튼을 눌렀을 때만 켜지고, 화면을 떠나면 꺼진다.
 * 소리는 브라우저의 음성 인식 서비스가 처리하며 이 앱으로 보내지 않는다.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<Recognizer | null>(null);
  const onFinalRef = React.useRef(onFinal);
  React.useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  React.useEffect(() => setSupported(isSpeechRecognitionSupported()), []);

  const stop = React.useCallback(() => recRef.current?.stop(), []);
  const start = React.useCallback(() => {
    if (!isSpeechRecognitionSupported()) return;
    setError(null);
    recRef.current?.stop();
    recRef.current = createRecognizer("ko-KR", {
      onFinal: (t) => t && onFinalRef.current(t),
      onInterim: setInterim,
      onError: (code) => setError(ERROR_COPY[code] ?? `음성 인식 오류 (${code})`),
      onStop: () => setRecording(false),
    });
    recRef.current?.start();
    setRecording(true);
  }, []);

  React.useEffect(() => () => recRef.current?.stop(), []);
  return { supported, recording, interim, error, start, stop };
}
