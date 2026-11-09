"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FlipHorizontal2, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";

const SETTINGS_KEY = "hookline.prompter";
type Settings = { wpm: number; size: number; mirror: boolean };
const DEFAULTS: Settings = { wpm: 150, size: 52, mirror: false };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.round(seconds % 60))).padStart(2, "0")}`;

export function Teleprompter({ hook, beats, title }: { hook: string; beats: string[]; title: string }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [controls, setControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const position = useRef(0);
  const live = useRef({ playing, wpm: settings.wpm });
  live.current = { playing, wpm: settings.wpm };
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const totalWords = useMemo(() => countWords([hook, ...beats].join(" ")), [hook, beats]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      const base = window.innerWidth < 700 ? { ...DEFAULTS, size: 36 } : DEFAULTS;
      setSettings(saved ? { ...base, ...JSON.parse(saved) } : base);
    } catch {}
  }, []);

  const update = useCallback((change: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...change };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // navigator.wakeLock needs HTTPS, so phones on the LAN fall back to a silent looping video.
  const keepAwake = useCallback(async (on: boolean) => {
    if (!on) {
      await wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
      video.current?.pause();
      return;
    }
    try {
      wakeLock.current = await navigator.wakeLock.request("screen");
    } catch {
      video.current?.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const element = scroller.current;
      const body = text.current;
      if (element && body) {
        if (Math.abs(element.scrollTop - position.current) > 2) position.current = element.scrollTop;
        if (live.current.playing) {
          const seconds = (totalWords / live.current.wpm) * 60;
          position.current += (body.offsetHeight / seconds) * dt;
          element.scrollTop = position.current;
          setElapsed((value) => value + dt);
          if (position.current >= body.offsetHeight - 4) {
            setPlaying(false);
            setControls(true);
            void keepAwake(false);
          }
        }
        setProgress(clamp(position.current / Math.max(body.offsetHeight, 1), 0, 1));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [totalWords, keepAwake]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setPlaying(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(timer);
  }, [countdown]);

  const seek = useCallback((top: number) => {
    position.current = Math.max(0, top);
    if (scroller.current) scroller.current.scrollTop = position.current;
  }, []);

  const restart = useCallback(() => {
    seek(0);
    setElapsed(0);
    setPlaying(false);
    setCountdown(null);
    setControls(true);
  }, [seek]);

  const toggle = useCallback(() => {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (live.current.playing) {
      setPlaying(false);
      setControls(true);
      void keepAwake(false);
      return;
    }
    void keepAwake(true);
    const finished = text.current && position.current >= text.current.offsetHeight - 4;
    if (finished) {
      seek(0);
      setElapsed(0);
    }
    if (position.current < 4) setCountdown(3);
    else setPlaying(true);
    setControls(false);
  }, [countdown, keepAwake, seek]);

  const jump = useCallback(
    (direction: 1 | -1) => {
      const paragraphs = [...(text.current?.children ?? [])] as HTMLElement[];
      const here = position.current;
      const target =
        direction > 0
          ? paragraphs.find((p) => p.offsetTop > here + 8)
          : [...paragraphs].reverse().find((p) => p.offsetTop < here - 8);
      seek(target?.offsetTop ?? (direction > 0 ? here : 0));
    },
    [seek],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        " ": toggle,
        ArrowUp: () => update({ wpm: clamp(settings.wpm + 10, 80, 300) }),
        ArrowDown: () => update({ wpm: clamp(settings.wpm - 10, 80, 300) }),
        ArrowRight: () => jump(1),
        ArrowLeft: () => jump(-1),
        m: () => update({ mirror: !settings.mirror }),
        r: restart,
        "=": () => update({ size: clamp(settings.size + 4, 20, 120) }),
        "+": () => update({ size: clamp(settings.size + 4, 20, 120) }),
        "-": () => update({ size: clamp(settings.size - 4, 20, 120) }),
      };
      const action = actions[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, jump, restart, update, settings]);

  useEffect(() => () => void wakeLock.current?.release().catch(() => {}), []);

  const remaining = (totalWords / settings.wpm) * 60 * (1 - progress);
  const showControls = controls || !playing;

  return (
    <main
      className="prompter"
      data-chrome={showControls ? "on" : "off"}
      onPointerMove={(event) => event.pointerType === "mouse" && setControls(true)}
    >
      <video ref={video} className="prompter-keepawake" src="/keepawake.mp4" muted loop playsInline aria-hidden />
      <div className="prompter-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="prompter-guide" aria-hidden />

      <div className="prompter-scroll" ref={scroller} onClick={toggle} style={{ transform: settings.mirror ? "scaleX(-1)" : undefined }}>
        <div className="prompter-pad-top" />
        <div className="prompter-text" ref={text} style={{ fontSize: settings.size }}>
          <p className="prompter-hook">{hook}</p>
          {beats.map((beat, index) => (
            <p key={index}>{beat}</p>
          ))}
        </div>
        <div className="prompter-pad-bottom" />
      </div>

      {countdown !== null && countdown > 0 && <div className="prompter-countdown">{countdown}</div>}

      <header className="prompter-top">
        <Link href="/" className="prompter-exit" aria-label="Back to chat">
          <ArrowLeft size={20} />
        </Link>
        <span className="prompter-title">{title}</span>
        <span className="prompter-clock">
          {clock(elapsed)} · {clock(remaining)} left
        </span>
      </header>

      <footer className="prompter-controls">
        <button className="prompter-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing || countdown !== null ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {playing || countdown !== null ? "Pause" : progress > 0.995 ? "Replay" : "Start"}
        </button>
        <div className="stepper" aria-label="Speed">
          <button onClick={() => update({ wpm: clamp(settings.wpm - 10, 80, 300) })} aria-label="Slower"><Minus size={16} /></button>
          <span>{settings.wpm} wpm</span>
          <button onClick={() => update({ wpm: clamp(settings.wpm + 10, 80, 300) })} aria-label="Faster"><Plus size={16} /></button>
        </div>
        <div className="stepper" aria-label="Text size">
          <button onClick={() => update({ size: clamp(settings.size - 4, 20, 120) })} aria-label="Smaller text">A−</button>
          <button onClick={() => update({ size: clamp(settings.size + 4, 20, 120) })} aria-label="Larger text">A+</button>
        </div>
        <button className={settings.mirror ? "chip is-on" : "chip"} onClick={() => update({ mirror: !settings.mirror })}>
          <FlipHorizontal2 size={16} />Mirror
        </button>
        <button className="chip" onClick={restart}>
          <RotateCcw size={16} />Restart
        </button>
        <span className="prompter-keys">Space play · ↑↓ speed · ←→ jump</span>
      </footer>
    </main>
  );
}
