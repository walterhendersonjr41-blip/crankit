import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, Wrench, X } from "lucide-react";
import { getMechanicReply } from "../lib/mechanicClient";
import { QUICK_CHIPS, buildGreeting, type MechanicIntent, type MechanicLink } from "../lib/mechanicEngine";
import { addUserTip, clearLearning, recordBotRating } from "../lib/mechanicLearning";
import { anonymousBrandModel } from "../lib/shareFix";
import { ShareFixButton } from "./ShareFixButton";
import { STORAGE_KEYS } from "../lib/storage";
import { useAppState, type TabId } from "../state";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  links?: MechanicLink[];
  intent?: MechanicIntent;
  fixLabel?: string;
  rating?: "helpful" | "unhelpful";
};

function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.chat);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(messages.slice(-50)));
  } catch {
    // ignore quota / private mode
  }
}

function newMsgId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function MechanicChat() {
  const { tools, setTab } = useAppState();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolId, setToolId] = useState(tools[0]?.id ?? "");
  const [teachOpen, setTeachOpen] = useState(false);
  const [teachSymptom, setTeachSymptom] = useState("");
  const [teachFix, setTeachFix] = useState("");
  const [teachMsg, setTeachMsg] = useState("");
  const [lastTip, setLastTip] = useState<{ symptom: string; fix: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const selected = tools.find((t) => t.id === toolId) ?? tools[0];

  useEffect(() => {
    if (!toolId && tools[0]) setToolId(tools[0].id);
  }, [tools, toolId]);

  useEffect(() => {
    if (!open) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const stored = loadChat();
      if (stored.length > 0) return stored;
      const greet = buildGreeting(tools);
      return [{ id: newMsgId(), role: "assistant", text: greet.text, links: greet.links }];
    });
  }, [open, tools]);

  useEffect(() => {
    if (messages.length) saveChat(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    inputRef.current?.focus();
  }, [open, messages, busy]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { id: newMsgId(), role: "user", text: trimmed }]);
    setBusy(true);
    try {
      const reply = await getMechanicReply(trimmed, { tools, toolId: selected?.id });
      const fixLabel = reply.text.split("\n").find((line) => line.trim()) ?? reply.text;
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          text: reply.text,
          links: reply.links,
          intent: reply.intent,
          fixLabel: fixLabel.slice(0, 180),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function followLink(tab: TabId) {
    setTab(tab);
    setOpen(false);
  }

  function rate(message: ChatMessage, helpful: boolean) {
    if (message.role !== "assistant" || message.rating) return;
    recordBotRating({
      toolId: selected?.id,
      toolName: selected?.name,
      symptomKey: message.intent ?? "fallback",
      symptomLabel: message.intent ?? "general",
      fixKey: message.id,
      fixLabel: message.fixLabel ?? message.text.slice(0, 180),
      helpful,
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, rating: helpful ? "helpful" : "unhelpful" } : m)),
    );
  }

  function clearChat() {
    const greet = buildGreeting(tools);
    const next: ChatMessage[] = [{ id: newMsgId(), role: "assistant", text: greet.text, links: greet.links }];
    setMessages(next);
    saveChat(next);
  }

  function onClearLearning() {
    clearLearning();
    setTeachMsg("Driveway learning on this device was cleared.");
  }

  function onTeach(e: FormEvent) {
    e.preventDefault();
    if (!teachSymptom.trim() || !teachFix.trim()) {
      setTeachMsg("Add both a symptom and a fix.");
      return;
    }
    const tip = { symptom: teachSymptom.trim(), fix: teachFix.trim() };
    addUserTip({
      ...tip,
      toolId: selected?.id,
      toolName: selected?.name,
    });
    setLastTip(tip);
    setTeachSymptom("");
    setTeachFix("");
    setTeachMsg("Saved. The mechanic will mention this tip when a later question matches.");
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 z-40 flex min-h-14 items-center gap-2 rounded-full bg-garage-orange px-4 py-3 text-sm font-black text-black shadow-lg shadow-black/40"
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
            <Wrench className="h-5 w-5" />
            <MessageCircle className="absolute -bottom-1 -right-1 h-3.5 w-3.5" />
          </span>
          Ask Mechanic
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:p-3" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-garage-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-garage-orange">CrankIt</p>
                <h2 id={titleId} className="text-lg font-black leading-snug text-white sm:text-xl">
                  Master 2-Stroke Mechanic AI
                </h2>
                <p className="text-xs text-neutral-400">Works offline. Learns on this device only.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={clearChat} className="min-h-11 px-2 text-xs font-bold text-neutral-400">
                  Clear chat
                </button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-full text-neutral-400" aria-label="Close mechanic chat">
                  <X className="mx-auto h-6 w-6" />
                </button>
              </div>
            </div>

            {tools.length > 0 && (
              <label className="block border-b border-white/10 px-4 py-2 text-xs font-semibold text-neutral-400">
                Talking about
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setToolId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#121212] px-3 text-sm font-bold text-white"
                >
                  {tools.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.brandModel ? ` · ${t.brandModel}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-3 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-garage-orange text-black" : "bg-white/5 text-neutral-100"
                    }`}
                  >
                    {m.text}
                    {m.role === "assistant" && m.links && m.links.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {m.links.map((link) => (
                          <button
                            key={`${m.id}-${link.tab}-${link.label}`}
                            type="button"
                            onClick={() => followLink(link.tab)}
                            className="min-h-11 rounded-xl border border-garage-orange/70 px-3 text-left text-sm font-bold text-orange-200"
                          >
                            {link.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && m.intent && m.intent !== "greeting" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={Boolean(m.rating)}
                          onClick={() => rate(m, true)}
                          className={`min-h-11 rounded-xl px-3 text-xs font-bold ${
                            m.rating === "helpful" ? "bg-diy text-black" : "border border-white/20 text-neutral-200"
                          }`}
                        >
                          That fixed it
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(m.rating)}
                          onClick={() => rate(m, false)}
                          className={`min-h-11 rounded-xl px-3 text-xs font-bold ${
                            m.rating === "unhelpful" ? "bg-shop text-white" : "border border-white/20 text-neutral-200"
                          }`}
                        >
                          Didn't help
                        </button>
                      </div>
                    )}
                    {m.role === "assistant" && m.rating === "helpful" && (
                      <div className="mt-3">
                        <ShareFixButton
                          input={{
                            toolType: selected?.toolType,
                            brandModel: anonymousBrandModel(selected),
                            symptom: m.intent ?? "general",
                            fix: m.fixLabel ?? m.text.slice(0, 180),
                            worked: "yes",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <p className="text-xs font-semibold text-neutral-500">Checking the driveway steps…</p>}
            </div>

            <div className="border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setTeachOpen((v) => !v)}
                  className="min-h-11 text-left text-xs font-bold text-orange-200"
                >
                  {teachOpen ? "Hide teach form" : "Teach the mechanic"}
                </button>
                <button type="button" onClick={onClearLearning} className="min-h-11 text-xs font-bold text-neutral-400">
                  Reset learning
                </button>
              </div>
              {teachOpen && (
                <form onSubmit={onTeach} className="mb-3 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Symptom
                    <input
                      value={teachSymptom}
                      onChange={(e) => setTeachSymptom(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#121212] px-3 text-sm"
                      placeholder="Dies when I tilt it"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-300">
                    What fixed it
                    <input
                      value={teachFix}
                      onChange={(e) => setTeachFix(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#121212] px-3 text-sm"
                      placeholder="Replaced the in-tank fuel line"
                    />
                  </label>
                  <button type="submit" className="min-h-11 w-full rounded-xl bg-garage-orange text-sm font-black text-black">
                    Save tip
                  </button>
                </form>
              )}
              {teachMsg && <p className="mb-2 text-xs text-neutral-300">{teachMsg}</p>}
              {lastTip && (
                <div className="mb-2">
                  <ShareFixButton
                    input={{
                      toolType: selected?.toolType,
                      brandModel: anonymousBrandModel(selected),
                      symptom: lastTip.symptom,
                      fix: lastTip.fix,
                      worked: "yes",
                    }}
                  />
                </div>
              )}
              <div className="chip-scroll mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Quick questions">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void ask(chip)}
                    disabled={busy}
                    className="min-h-11 shrink-0 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-bold leading-tight text-neutral-100 disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <form onSubmit={onSubmit} className="flex gap-2">
                <label htmlFor="mechanic-input" className="sr-only">
                  Ask the mechanic
                </label>
                <input
                  id="mechanic-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask in plain English…"
                  className="min-h-12 flex-1 rounded-xl border border-white/15 bg-[#121212] px-3 text-sm text-white"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-garage-orange text-black disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
