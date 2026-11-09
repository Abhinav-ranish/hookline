"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, House, Menu, MessageCircle, Palette, PanelLeft, Settings, SquarePen, UserRound, X } from "lucide-react";
import type { ChatMessage, Conversation, Script, StreamEvent, ViewKind } from "@/lib/schemas";
import { applyAppearance } from "@/lib/appearance";
import { AppearanceModal } from "./AppearanceModal";
import { Composer } from "./Composer";
import { Home } from "./Home";
import { Logo, Mark, ThinkingMark } from "./Logo";
import { Modal } from "./Modal";
import { QuestionCard } from "./QuestionCard";
import { ScriptCard } from "./ScriptCard";
import { ViewCard } from "./ViewCard";

const COLLAPSE_KEY = "hookline.sidebar-collapsed";
const PROFILE_TIP_KEY = "hookline.profile-tip-dismissed";

type Stage = { label: string; detail?: string };
type SendOptions = { text: string; refresh?: boolean; skipBrief?: boolean; swap?: { messageId: string; hookIndex: number }; view?: { kind: ViewKind; messageId: string } };
type Props = {
  initialConversations: Conversation[];
  initialNotes: string;
  initialName: string;
  latestScan: { topic: string; scanned: number; fetchedAt: string } | null;
  trendsOn: boolean;
};

export function Chat(props: Props) {
  const { trendsOn, latestScan } = props;
  const [conversations, setConversations] = useState(props.initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [durationSec, setDurationSec] = useState(45);
  const [useTrends, setUseTrends] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileTipGone, setProfileTipGone] = useState(true);
  const [notes, setNotes] = useState(props.initialNotes);
  const [name, setName] = useState(props.initialName);
  const [draftNotes, setDraftNotes] = useState(props.initialNotes);
  const [draftName, setDraftName] = useState(props.initialName);
  const activeRef = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, stages]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      setProfileTipGone(localStorage.getItem(PROFILE_TIP_KEY) === "1");
    } catch {
      setProfileTipGone(false);
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {}
      return !value;
    });
  };

  const refreshList = useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (response.ok) setConversations(await response.json());
  }, []);

  const open = useCallback(async (id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    setDrawer(false);
    setError("");
    if (!id) {
      setMessages([]);
      return;
    }
    const response = await fetch(`/api/conversations/${id}`);
    if (response.ok && activeRef.current === id) setMessages(await response.json());
  }, []);

  const remove = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeRef.current === id) await open(null);
    await refreshList();
  };

  const send = async (options: SendOptions) => {
    if (busy || !options.text.trim()) return;
    setBusy(true);
    setError("");
    setStages([]);
    let streamConversation = activeRef.current;
    const showing = () => activeRef.current === streamConversation;

    const handle = (event: StreamEvent) => {
      if (event.type === "conversation") {
        const startedFromBlank = activeRef.current === null;
        streamConversation = event.id;
        if (startedFromBlank) {
          activeRef.current = event.id;
          setActiveId(event.id);
          setConversations((all) => [{ id: event.id, title: event.title, updatedAt: new Date().toISOString() }, ...all]);
        }
      } else if (event.type === "stage") {
        if (showing()) setStages((all) => (all.at(-1)?.label === event.label ? [...all.slice(0, -1), event] : [...all, event]));
      } else if (event.type === "user" || event.type === "assistant") {
        if (showing()) setMessages((all) => [...all, event.message]);
      } else if (event.type === "error") {
        if (showing()) setError(event.message);
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeRef.current,
          text: options.text,
          durationSec,
          refresh: options.refresh ?? false,
          skipBrief: options.skipBrief ?? false,
          useTrends,
          swap: options.swap ?? null,
          view: options.view ?? null,
        }),
      });
      if (!response.ok || !response.body) throw new Error("The server couldn't take that request.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as StreamEvent);
      }
    } catch {
      setError("Connection lost before the script finished. Keep this page open while it writes, then try again.");
    } finally {
      setBusy(false);
      setStages([]);
      void refreshList();
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send({ text });
  };

  const starter = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const element = composer.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(text.length, text.length);
    });
  };

  const openProfile = () => {
    setDraftNotes(notes);
    setDraftName(name);
    setDrawer(false);
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: draftNotes, name: draftName }) });
    setNotes(draftNotes);
    setName(draftName.trim());
    setProfileOpen(false);
  };

  const dismissProfileTip = () => {
    setProfileTipGone(true);
    try {
      localStorage.setItem(PROFILE_TIP_KEY, "1");
    } catch {}
  };

  const replaceScript = (id: string, script: Script) => setMessages((all) => all.map((m) => (m.id === id ? { ...m, script } : m)));
  const lastMessage = messages.at(-1);
  const inChat = Boolean(activeId) || messages.length > 0 || busy;
  const title = conversations.find((c) => c.id === activeId)?.title;

  const composerElement = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={submit}
      busy={busy}
      durationSec={durationSec}
      onDuration={setDurationSec}
      trendsAvailable={trendsOn}
      useTrends={useTrends}
      onUseTrends={setUseTrends}
      inputRef={composer}
      placeholder={inChat ? "A new topic, or a change to the script" : "Give me a topic…"}
    />
  );

  return (
    <div className="app" data-collapsed={collapsed}>
      <div className="wall" aria-hidden>
        <i className="wall-image" />
        <i className="wall-tint" />
        <i className="wall-veil" />
      </div>

      <aside className={drawer ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-btn collapse" aria-label="Collapse sidebar" onClick={toggleCollapsed}><PanelLeft size={18} /></button>
          <button className="icon-btn drawer-close" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={18} /></button>
        </div>
        <button className="new" onClick={() => open(null)}><SquarePen size={16} />New script</button>
        <nav className="nav">
          <button className={inChat ? "nav-item" : "nav-item is-active"} onClick={() => open(null)}><House size={17} />Home</button>
        </nav>
        {conversations.length > 0 && <h3 className="nav-label">History</h3>}
        <nav className="history" aria-label="Past scripts">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={conversation.id === activeId ? "row is-active" : "row"}>
              <button className="row-open" onClick={() => open(conversation.id)}><MessageCircle size={16} /><span>{conversation.title}</span></button>
              <button className="row-delete" aria-label={`Delete ${conversation.title}`} onClick={() => remove(conversation.id)}><X size={14} /></button>
            </div>
          ))}
        </nav>
        {!notes.trim() && !profileTipGone && (
          <div className="side-card">
            <button className="side-card-close" aria-label="Dismiss" onClick={dismissProfileTip}><X size={14} /></button>
            <strong><UserRound size={15} />Make it sound like you</strong>
            <p>Add your audience, tone and real stories so scripts fit you.</p>
            <button className="btn btn-wide" onClick={openProfile}>Set up profile</button>
          </div>
        )}
        <button className="user" onClick={openProfile}>
          <span className="avatar">{name.trim()[0]?.toUpperCase() || <UserRound size={15} />}</span>
          <span className="user-text">
            <strong>{name.trim() || "Your profile"}</strong>
            <small>{trendsOn ? "Trends on" : "Trends off"}</small>
          </span>
          <ChevronsUpDown size={16} />
        </button>
      </aside>
      {drawer && <button className="scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={19} /></button>
          {collapsed && <button className="icon-btn expand" aria-label="Expand sidebar" onClick={toggleCollapsed}><PanelLeft size={18} /></button>}
          <span className="topbar-brand"><Mark size={20} /></span>
          <span className="topbar-title">{inChat ? title : ""}</span>
          <button className="pill-btn" onClick={() => setAppearanceOpen(true)}><Palette size={16} /><span>Appearance</span></button>
          <button className="icon-btn" aria-label="Profile settings" onClick={openProfile}><Settings size={18} /></button>
        </header>

        {!inChat ? (
          <Home name={name} hasProfile={Boolean(notes.trim())} conversations={conversations} latestScan={latestScan} trendsOn={trendsOn} composer={composerElement} onStarter={starter} onOpen={open} onProfile={openProfile} />
        ) : (
          <>
            <div className="thread">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="bubble-row enter"><p className="bubble">{message.content}</p></div>
                ) : (
                  <div key={message.id} className="reply enter">
                    <Mark size={20} className="reply-mark" />
                    <div className="reply-body">
                      <p className="reply-text">{message.content}</p>
                      {message.questions && message.questions.length > 0 && message === lastMessage && (
                        <QuestionCard questions={message.questions} busy={busy} onAnswer={(text) => void send({ text })} onSkip={() => void send({ text: "Just write it with your best assumptions.", skipBrief: true })} />
                      )}
                      {message.questions && message !== lastMessage && (
                        <ul className="asked">{message.questions.map((q) => <li key={q.question}>{q.question}</li>)}</ul>
                      )}
                      {message.view && messages.find((m) => m.id === message.view!.scriptMessageId)?.script && (
                        <ViewCard
                          kind={message.view.kind}
                          messageId={message.view.scriptMessageId}
                          script={messages.find((m) => m.id === message.view!.scriptMessageId)!.script!}
                          busy={busy}
                          onSwap={(hookIndex, hook) => void send({ text: `Use this hook: "${hook}"`, swap: { messageId: message.view!.scriptMessageId, hookIndex } })}
                        />
                      )}
                      {message.script && (
                        <ScriptCard
                          messageId={message.id}
                          script={message.script}
                          busy={busy}
                          onEdited={(script) => replaceScript(message.id, script)}
                          onView={(kind, label) => void send({ text: label, view: { kind, messageId: message.id } })}
                          onSwap={(hookIndex, hook) => void send({ text: `Use this hook: "${hook}"`, swap: { messageId: message.id, hookIndex } })}
                          onRescan={() => void send({ text: `Write a new script about ${message.script!.topic}`, refresh: true, skipBrief: true })}
                        />
                      )}
                    </div>
                  </div>
                ),
              )}

              {busy && (
                <div className="reply enter" role="status">
                  <ThinkingMark />
                  <div className="reply-body stages">
                    {stages.length === 0 && <p className="stage is-current"><span>Thinking</span></p>}
                    {stages.map((stage, index) =>
                      index === stages.length - 1 ? (
                        <p key={stage.label} className="stage is-current">
                          <span>{stage.label}</span>
                          {stage.detail && <small>{stage.detail}</small>}
                        </p>
                      ) : (
                        <p key={stage.label} className="stage"><Check size={14} />{stage.label}</p>
                      ),
                    )}
                  </div>
                </div>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              <div ref={bottom} />
            </div>

            <div className="composer-dock rise-fast">
              {composerElement}
              <p className="disclaimer">Hookline can make mistakes. Check facts before filming.</p>
            </div>
          </>
        )}
      </main>

      {profileOpen && (
        <Modal
          title="Your profile"
          icon={<UserRound size={19} />}
          onClose={() => setProfileOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setProfileOpen(false)}>Cancel</button>
              <button className="btn btn-solid" onClick={saveProfile}>Save changes</button>
            </>
          }
        >
          <label className="field">
            <span>Your name</span>
            <input value={draftName} maxLength={60} placeholder="Used in your greeting" onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="field">
            <span>About you and your audience</span>
            <textarea rows={8} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} placeholder={"Audience: first-time founders\nSpace: startups\nTone: blunt, dry humour\nStory: I burned $40k on ads before finding product-market fit"} />
          </label>
          <p className="field-hint">Scripts only use first-person stories and results you write here.</p>
        </Modal>
      )}
      {appearanceOpen && <AppearanceModal onClose={() => setAppearanceOpen(false)} />}
    </div>
  );
}
