"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Volume2, VolumeX, RotateCcw, Square, Send, ChevronDown } from "lucide-react";
import { answerMockInterview, endMockInterview } from "@/actions/mock-interview";
import type { RoomView } from "@/services/mock-interview/view";
import type { PanelLine } from "@/services/mock-interview/engine";
import type { PanelMember, Seat } from "@/services/mock-interview/panel";
import { QUESTION_TYPE_KO } from "@/services/mock-interview/labels-ko";
import { cancelSpeech, isSpeechSynthesisSupported, speak } from "@/lib/speech/synthesis";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PanelScene, type RoomMode } from "./panel-scene";
import { useVoiceInput } from "./use-voice-input";

const MAX_ANSWER = 4000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ORIGIN_LABEL: Record<string, string> = {
  후기: "공개 면접 후기 기반",
  공개후기: "공개 면접 후기 기반",
  공식자료: "인재상·공식자료 기반",
  공고기반: "채용 공고 기반",
  직무기반: "직무 기반 연습 질문",
  서류기반: "내 서류 기반",
};

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function InterviewRoom({ initial, panel, label }: { initial: RoomView; panel: Record<Seat, PanelMember>; label: string }) {
  const router = useRouter();
  const [view, setView] = React.useState(initial);
  const [mode, setMode] = React.useState<RoomMode>("asking");
  const [speaking, setSpeaking] = React.useState<Seat | null>(initial.current?.seat ?? null);
  // 새로고침해도 지금 질문 앞에 면접관이 한 말은 다시 보인다
  const initialLines = React.useMemo<PanelLine[]>(
    () => (initial.current?.reaction ? [{ seat: initial.history.length ? initial.current.seat : "center", text: initial.current.reaction, kind: initial.history.length ? "reaction" : "greeting" }] : []),
    [initial],
  );
  const [lines, setLines] = React.useState<PanelLine[]>(initialLines);
  const [answer, setAnswer] = React.useState("");
  const [usedVoice, setUsedVoice] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [voiceOn, setVoiceOn] = React.useState(initial.voiceEnabled);
  const [listenStart, setListenStart] = React.useState<number>(() => Date.now());
  const [elapsed, setElapsed] = React.useState(0);
  const [showHistory, setShowHistory] = React.useState(false);
  const runRef = React.useRef(0);
  const voiceRef = React.useRef(voiceOn);
  voiceRef.current = voiceOn;

  const mic = useVoiceInput((text) => {
    setUsedVoice(true);
    setAnswer((a) => (a ? `${a} ${text}` : text).slice(0, MAX_ANSWER));
  });

  const say = React.useCallback(
    async (text: string, seat: Seat, run: number) => {
      if (runRef.current !== run) return;
      setSpeaking(seat);
      if (voiceRef.current && isSpeechSynthesisSupported()) {
        const v = panel[seat].voice;
        await speak(text, "ko-KR", { pitch: v.pitch, rate: v.rate, voiceIndex: v.index });
      } else {
        // 읽을 시간을 준다 (길이에 비례, 늘어지지 않게)
        await wait(Math.min(1400, 450 + text.length * 10));
      }
    },
    [panel],
  );

  const ask = React.useCallback(
    async (v: RoomView, pre: PanelLine[], run: number) => {
      setMode("asking");
      for (const l of pre) await say(l.text, l.seat, run);
      if (runRef.current !== run) return;
      if (v.current) await say(v.current.text, v.current.seat, run);
      if (runRef.current !== run) return;
      setSpeaking(null);
      setMode("listening");
      setListenStart(Date.now());
    },
    [say],
  );

  // 처음 들어오면 인사와 첫 질문
  React.useEffect(() => {
    const runs = runRef;
    const run = ++runs.current;
    void ask(initial, initialLines, run);
    return () => {
      // 화면을 떠나면 진행 중이던 말하기·대기를 모두 무효로 만든다
      runs.current++;
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (mode !== "listening") return;
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - listenStart) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [mode, listenStart]);

  async function submit() {
    const text = answer.trim();
    if (!view.current || !text || mode === "reviewing") return;
    mic.stop();
    cancelSpeech();
    const run = ++runRef.current;
    setMode("reviewing");
    setSpeaking(null);
    setError(null);
    const result = await answerMockInterview(view.id, {
      questionId: view.current.id,
      answer: text,
      mode: usedVoice ? "voice" : "text",
      durationSec: Math.round((Date.now() - listenStart) / 1000),
    });
    if (runRef.current !== run) return;
    if (!result.ok) {
      setError(result.error);
      setMode("listening");
      return;
    }
    setAnswer("");
    setUsedVoice(false);
    setLines(result.lines);
    setElapsed(0);
    if (result.finished) {
      setMode("asking");
      for (const l of result.lines) await say(l.text, l.seat, run);
      setSpeaking(null);
      router.refresh();
      return;
    }
    setView(result.view);
    await ask(result.view, result.lines, run);
  }

  async function end() {
    if (!window.confirm("면접을 여기서 끝낼까요? 지금까지 답한 질문으로 리포트를 만듭니다.")) return;
    mic.stop();
    cancelSpeech();
    const run = ++runRef.current;
    setMode("reviewing");
    const result = await endMockInterview(view.id);
    if (runRef.current !== run) return;
    if (!result.ok) {
      setError(result.error);
      setMode("listening");
      return;
    }
    if (!view.history.length) router.push("/interview");
    else router.refresh();
  }

  function replay() {
    if (!view.current) return;
    const run = ++runRef.current;
    void (async () => {
      setMode("asking");
      await say(view.current!.text, view.current!.seat, run);
      if (runRef.current !== run) return;
      setSpeaking(null);
      setMode("listening");
    })();
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) cancelSpeech();
  }

  const q = view.current;
  const busy = mode === "reviewing";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            질문 {Math.min(view.mainIndex, view.total)} / {view.total}
          </span>
          {q?.isFollowUp && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">꼬리질문</span>}
          {q && <span className="text-xs text-muted-foreground">{QUESTION_TYPE_KO[q.type]}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={toggleVoice} aria-pressed={voiceOn} title="면접관 목소리로 질문 읽기">
            {voiceOn ? <Volume2 /> : <VolumeX />}
            <span className="hidden sm:inline">{voiceOn ? "소리 켬" : "소리 끔"}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={end} disabled={busy}>
            <Square /> 면접 끝내기
          </Button>
        </div>
      </div>

      <PanelScene panel={panel} speaking={speaking} mode={mode} typing={answer.length > 0} label={label} />

      <div className="rounded-lg border bg-card p-4 shadow-sm" aria-live="polite">
        {lines.length > 0 && (
          <div className="mb-3 space-y-1">
            {lines.map((l, i) => (
              <p key={i} className={cn("text-sm", l.kind === "closing" ? "font-medium" : "text-muted-foreground")}>
                <span className="mr-1 text-xs text-muted-foreground/80">{panel[l.seat].name}</span>
                {l.text}
              </p>
            ))}
          </div>
        )}
        {q ? (
          <>
            <p className="text-xs text-muted-foreground">
              {panel[q.seat].role} {panel[q.seat].name} {panel[q.seat].title}
              {q.origin && ORIGIN_LABEL[q.origin] && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5">{ORIGIN_LABEL[q.origin]}</span>}
            </p>
            <h2 className="mt-1 text-base font-semibold leading-relaxed" data-testid="mi-question">
              {q.text}
            </h2>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 리포트를 정리하는 중입니다…
          </p>
        )}
      </div>

      {q && (
        <div className="space-y-2">
          <label htmlFor="mi-answer" className="sr-only">
            내 답변
          </label>
          <Textarea
            id="mi-answer"
            value={mic.recording && mic.interim ? `${answer}${answer ? " " : ""}${mic.interim}` : answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, MAX_ANSWER))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={6}
            disabled={busy}
            placeholder={mode === "asking" ? "질문을 듣는 중입니다. 바로 써도 됩니다." : "결론부터 한 문장, 그다음 근거가 된 경험과 결과를 말해 보세요. 질문이 헷갈리면 '질문을 다시 설명해 주세요'라고 써도 됩니다."}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {mic.supported && (
                <Button type="button" variant={mic.recording ? "destructive" : "outline"} size="sm" onClick={mic.recording ? mic.stop : mic.start} disabled={busy}>
                  {mic.recording ? <MicOff /> : <Mic />}
                  {mic.recording ? "말하기 멈춤" : "말로 답하기"}
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={replay} disabled={busy || mode === "asking"}>
                <RotateCcw /> 다시 듣기
              </Button>
              <span className="tabular-nums">
                {mode === "listening" ? `${fmt(elapsed)} · ` : ""}
                {answer.length}/{MAX_ANSWER}자
              </span>
            </div>
            <Button type="button" onClick={() => void submit()} disabled={busy || !answer.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              {busy ? "면접관이 답변을 보는 중…" : "답변 제출"}
            </Button>
          </div>
          <ReviewingHint active={busy} />
          {mic.error && <p className="text-xs text-destructive">{mic.error}</p>}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            1분 안팎(300~500자)이 적당합니다. 결론 → 상황 → 내가 한 일 → 결과(숫자) 순서로 말하면 꼬리질문이 줄어듭니다. Ctrl+Enter 로 제출.
          </p>
        </div>
      )}

      {view.history.length > 0 && (
        <div className="rounded-lg border">
          <button type="button" className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
            지금까지 한 문답 {view.history.length}개
            <ChevronDown className={cn("h-4 w-4 transition-transform", showHistory && "rotate-180")} />
          </button>
          {showHistory && (
            <ol className="space-y-3 border-t px-4 py-3 text-sm">
              {view.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">
                    {h.isFollowUp && <span className="mr-1 text-xs text-amber-700 dark:text-amber-300">↳ 꼬리</span>}
                    {h.text}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{h.answer}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/** 면접관이 답을 읽는 동안 (AI 면접관은 10~25초 걸린다). 멈춘 줄 알고 새로고침하지 않게. */
function ReviewingHint({ active }: { active: boolean }) {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active || seconds < 2) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span role="status">면접관들이 답변을 평가지에 적고 다음 질문을 고르는 중입니다. 보통 10~25초 걸립니다.</span>{" "}
      <span aria-hidden="true">({seconds}초)</span>
    </p>
  );
}
