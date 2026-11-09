"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Flame, GitCompareArrows, Lightbulb, MessageCircle, Radar, ScrollText, ShieldX, Sparkles, X } from "lucide-react";
import type { Conversation } from "@/lib/schemas";

const STARTERS = [
  { label: "Hot take", icon: Flame, text: "A hot take about " },
  { label: "Bust a myth", icon: ShieldX, text: "Bust a common myth about " },
  { label: "Tell a story", icon: ScrollText, text: "A story that teaches " },
  { label: "Quick how-to", icon: Lightbulb, text: "A quick how-to on " },
  { label: "This vs that", icon: GitCompareArrows, text: "Compare " },
];

const DISMISS_KEY = "hookline.tip-dismissed";

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function Reveal({ text, step, delay = 0, className, as: Tag = "p" }: { text: string; step: number; delay?: number; className?: string; as?: "h1" | "p" }) {
  return (
    <Tag className={className} aria-label={text}>
      {[...text].map((char, index) => (
        <span key={index} aria-hidden style={{ animationDelay: `${delay + index * step}ms` }}>{char === " " ? " " : char}</span>
      ))}
    </Tag>
  );
}

type Props = {
  name: string;
  hasProfile: boolean;
  conversations: Conversation[];
  latestScan: { topic: string; scanned: number; fetchedAt: string } | null;
  trendsOn: boolean;
  composer: React.ReactNode;
  onStarter: (text: string) => void;
  onOpen: (id: string) => void;
  onProfile: () => void;
};

export function Home({ name, hasProfile, conversations, latestScan, trendsOn, composer, onStarter, onOpen, onProfile }: Props) {
  const [greeting, setGreeting] = useState("");
  const [tipGone, setTipGone] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    const part = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    setGreeting(name ? `${part}, ${name}` : part);
    try {
      setTipGone(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setTipGone(false);
    }
  }, [name]);

  const dismissTip = () => {
    setTipGone(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const lead = greeting.length * 26 + 80;
  if (!greeting) return <div className="home" />;

  return (
    <div className="home">
      <div className="home-inner">
        <header className="greeting">
          <Reveal as="h1" text={greeting} step={26} />
          <Reveal className="greeting-sub" text="What's the reel about?" step={18} delay={lead} />
        </header>

        <div className="rise" style={{ animationDelay: `${lead + 160}ms` }}>{composer}</div>

        <div className="starters rise" style={{ animationDelay: `${lead + 240}ms` }}>
          {STARTERS.map(({ label, icon: Icon, text }) => (
            <button key={label} onClick={() => onStarter(text)}><Icon size={16} />{label}</button>
          ))}
        </div>

        <div className={tipGone ? "widgets rise is-solo" : "widgets rise"} style={{ animationDelay: `${lead + 320}ms` }}>
          <section className="card scan">
            <div className="scan-top">
              <span>Trend scanner</span>
              <Radar size={24} />
            </div>
            <div className="scan-bottom">
              <strong>{!trendsOn ? "Off" : latestScan ? latestScan.scanned : "Ready"}</strong>
              <p>
                {!trendsOn ? "Add your Apify token" : latestScan ? <>posts scanned<br />{timeAgo(latestScan.fetchedAt)}</> : <>Instagram<br />and TikTok</>}
              </p>
            </div>
          </section>
          {!tipGone && (
            <section className="card tip">
              <button className="tip-close" aria-label="Dismiss" onClick={dismissTip}><X size={16} /></button>
              <span className="badge"><Sparkles size={12} />{hasProfile ? "Try this" : "Start here"}</span>
              <h2>{hasProfile ? "See any script another way" : "Tell it who you're talking to"}</h2>
              <p>
                {hasProfile
                  ? "Once you have a script, ask for a shot list, a hook comparison or a filming checklist."
                  : "Add your audience, your space and real stories. Hooks get sharper, and it never invents your experience."}
              </p>
              {!hasProfile && <button className="tip-action" onClick={onProfile}>Set up profile<ChevronRight size={15} /></button>}
            </section>
          )}
        </div>

        {conversations.length > 0 && (
          <section className="recent rise" style={{ animationDelay: `${lead + 400}ms` }}>
            <h2><MessageCircle size={17} />Your recent scripts</h2>
            <div className="recent-grid">
              {conversations.slice(0, 3).map((conversation) => (
                <button key={conversation.id} className="card recent-card" onClick={() => onOpen(conversation.id)}>
                  <MessageCircle size={17} />
                  <strong>{conversation.title}</strong>
                  <span>{timeAgo(conversation.updatedAt)}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
