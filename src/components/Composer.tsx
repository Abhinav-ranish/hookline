"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines, ChevronDown, Globe } from "lucide-react";

const DURATIONS = [30, 45, 60, 90];

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  durationSec: number;
  onDuration: (value: number) => void;
  trendsAvailable: boolean;
  useTrends: boolean;
  onUseTrends: (value: boolean) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
};

export function Composer({ value, onChange, onSubmit, busy, durationSec, onDuration, trendsAvailable, useTrends, onUseTrends, inputRef, placeholder }: Props) {
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recognition = useRef<any>(null);
  const live = useRef(value);
  live.current = value;

  useEffect(() => {
    const speech = window as unknown as Record<string, unknown>;
    setCanDictate(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    return () => recognition.current?.stop();
  }, []);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [value, inputRef]);

  const dictate = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const speech = window as unknown as Record<string, any>;
    const Recognition = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    const session = new Recognition();
    const base = live.current ? `${live.current.trimEnd()} ` : "";
    session.continuous = true;
    session.interimResults = true;
    session.onresult = (event: any) => onChange(base + Array.from(event.results as ArrayLike<any>).map((result) => result[0].transcript).join(""));
    session.onend = () => setListening(false);
    session.onerror = () => setListening(false);
    recognition.current = session;
    session.start();
    setListening(true);
  };

  const hasText = value.trim().length > 0;
  const showMic = canDictate && (!hasText || listening);

  return (
    <div className={listening ? "composer is-listening" : "composer"}>
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        aria-label="Message"
        placeholder={listening ? "Listening…" : placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="composer-row">
        <label className="select-pill">
          <span className="sr-only">Video length</span>
          <select value={durationSec} onChange={(event) => onDuration(Number(event.target.value))}>
            {DURATIONS.map((value) => <option key={value} value={value}>{value} seconds</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <div className="composer-tools">
          <button
            type="button"
            className={trendsAvailable && useTrends ? "tool is-on" : "tool"}
            disabled={!trendsAvailable}
            aria-pressed={trendsAvailable && useTrends}
            aria-label={useTrends ? "Live trends on" : "Live trends off"}
            title={!trendsAvailable ? "Add APIFY_TOKEN to .env.local to use trends" : useTrends ? "Live trends on" : "Live trends off"}
            onClick={() => onUseTrends(!useTrends)}
          >
            <Globe size={18} />
          </button>
          {showMic ? (
            <button type="button" className={listening ? "send is-listening" : "send"} aria-label={listening ? "Stop dictating" : "Dictate"} onClick={dictate}>
              <AudioLines size={18} />
            </button>
          ) : (
            <button type="button" className="send" disabled={busy || !hasText} aria-label="Send" onClick={onSubmit}>
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
