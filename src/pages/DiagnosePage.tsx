import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "../components/Badge";
import { Disclaimer } from "../components/Disclaimer";
import { PartLinkList } from "../components/PartLink";
import { SafetyNote } from "../components/SafetyNote";
import { STAMPED_LETTER_NOTE, TOOL_TYPES, TREES, type DiagStep, type DiagTree, type ToolType } from "../data/diagnostics";
import { anonymousBrandModel } from "../lib/shareFix";
import type { GarageTool } from "../lib/storage";
import { FixedItButton } from "../components/FixedItButton";
import { ShareFixButton } from "../components/ShareFixButton";
import type { RepairWin } from "../lib/wins";
import { loadWins } from "../lib/wins";
import { useAppState } from "../state";

type Stage = "tool" | "tree" | "step" | "done";

type DoneState = {
  title: string;
  body: string;
  kind: "fixed" | "info";
  hint?: string;
};

export function DiagnosePage() {
  const { tools, setTools, addHistory, setTab } = useAppState();
  const [stage, setStage] = useState<Stage>("tool");
  const [toolType, setToolType] = useState<ToolType | null>(null);
  const [tree, setTree] = useState<DiagTree | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<DoneState | null>(null);
  const [logToolId, setLogToolId] = useState(tools[0]?.id ?? "");
  const [savedMsg, setSavedMsg] = useState("");
  const [lastWin, setLastWin] = useState<RepairWin | null>(null);

  const step: DiagStep | null = tree ? tree.steps[stepIndex] ?? null : null;
  const matchingTools = useMemo(
    () => (toolType ? tools.filter((t) => t.toolType === toolType) : tools),
    [tools, toolType],
  );

  function reset() {
    setStage("tool");
    setToolType(null);
    setTree(null);
    setStepIndex(0);
    setDone(null);
    setSavedMsg("");
    setLastWin(null);
  }

  function pickTree(next: DiagTree) {
    setTree(next);
    setStepIndex(0);
    setDone(null);
    setSavedMsg("");
    setLastWin(null);
    setStage("step");
  }

  function currentTool(): GarageTool | undefined {
    return tools.find((t) => t.id === logToolId) ?? matchingTools[0] ?? tools[0];
  }

  function record(outcome: "fixed" | "still-broken" | "branched", note?: string) {
    if (!tree || !step) return;
    const tool = currentTool();
    addHistory({
      toolId: tool?.id,
      toolName: tool?.name,
      toolType: toolType ?? tool?.toolType,
      treeId: tree.id,
      treeTitle: tree.title,
      stepId: step.id,
      stepTitle: step.title,
      outcome,
      note,
    });
  }

  function appendGarageNote(text: string) {
    const tool = currentTool();
    if (!tool) return false;
    const stamp = new Date().toLocaleString();
    const line = `[${stamp}] ${text}`;
    setTools(
      tools.map((t) =>
        t.id === tool.id
          ? { ...t, repairNotes: t.repairNotes ? `${t.repairNotes}\n${line}` : line }
          : t,
      ),
    );
    return true;
  }

  function onFixedWin(winId: string) {
    if (!tree || !step) return;
    const win = loadWins().find((w) => w.id === winId) ?? null;
    setLastWin(win);
    record("fixed", win?.fix ?? "Marked fixed");
    const saved = appendGarageNote(
      `${tree.shortTitle}: fixed — ${win?.fix || step.title}`,
    );
    setDone({
      kind: "fixed",
      title: "Nice — log it and get back to work",
      body: saved
        ? `Saved to My Wins, ${currentTool()?.name ?? "your garage"}, and the diagnostic history.`
        : "Saved to My Wins and diagnostic history. Add a tool in My Garage if you want this attached to a machine.",
    });
    setSavedMsg(saved ? "Saved to My Wins and the garage log." : "Saved to My Wins and history (no garage tool yet).");
    setStage("done");
  }

  function onStillBroken() {
    if (!tree || !step) return;
    record("still-broken");
    if (stepIndex < tree.steps.length - 1) {
      setStepIndex(stepIndex + 1);
      setSavedMsg("");
      return;
    }
    setDone({
      kind: "info",
      title: "End of this tree",
      body:
        tree.id === "wont-start"
          ? "If cheap spark and fuel checks are done and compression is still a question, use the Shop Meter for an honest shop-vs-driveway read."
          : "You've worked the cheap checks in this tree. Try a related symptom, or open the Shop Meter if you suspect a dead cylinder.",
      hint: "Shop Meter is the next honest step if you think the engine core is hurt.",
    });
    setStage("done");
  }

  function onBranch(optionId: string) {
    if (!tree || !step?.branch) return;
    const option = step.branch.options.find((o) => o.id === optionId);
    if (!option) return;
    record("branched", option.label);
    if (option.action.type === "continue") {
      if (stepIndex < tree.steps.length - 1) {
        setStepIndex(stepIndex + 1);
        return;
      }
      setDone({
        kind: "info",
        title: "End of this tree",
        body: "No further automatic steps. Open Shop Meter or pick another symptom.",
      });
      setStage("done");
      return;
    }
    setDone({
      kind: "info",
      title: option.action.title,
      body: option.action.body,
      hint: option.action.nextHint,
    });
    appendGarageNote(`${tree.shortTitle}: ${option.action.title}`);
    setStage("done");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black">Diagnose</h2>
          <p className="text-sm text-neutral-400">Cheapest, fastest driveway checks first.</p>
        </div>
        {stage !== "tool" && (
          <button
            type="button"
            onClick={() => {
              if (stage === "done" || stage === "step") {
                setStage("tree");
                setTree(null);
                setStepIndex(0);
                setDone(null);
              } else if (stage === "tree") {
                setStage("tool");
                setToolType(null);
              }
            }}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-orange-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        )}
      </div>

      {stage === "tool" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-300">1. What are you working on?</p>
          <div className="grid grid-cols-2 gap-2">
            {TOOL_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setToolType(t.id);
                  setStage("tree");
                  const first = tools.find((g) => g.toolType === t.id);
                  if (first) setLogToolId(first.id);
                }}
                className="min-h-16 rounded-2xl border border-white/10 bg-garage-card px-3 py-3 text-left text-base font-bold hover:border-garage-orange"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "tree" && toolType && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-300">
            2. What's it doing? ({TOOL_TYPES.find((t) => t.id === toolType)?.label})
          </p>
          <div className="space-y-2">
            {TREES.map((tr) => (
              <button
                key={tr.id}
                type="button"
                onClick={() => pickTree(tr)}
                className="flex w-full min-h-16 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-garage-card px-4 py-3 text-left hover:border-garage-orange"
              >
                <span>
                  <span className="block font-bold leading-snug">{tr.title}</span>
                  <span className="mt-1 block text-sm font-normal text-neutral-400">{tr.summary}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "step" && tree && step && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">
            Step {stepIndex + 1} of {tree.steps.length} · {tree.shortTitle}
          </p>
          <article className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-300">
              <span className="rounded-full bg-white/10 px-2 py-1">{step.costLabel}</span>
              <span className="rounded-full bg-white/10 px-2 py-1">{step.timeLabel}</span>
              <StatusBadge kind={step.badge} compact />
            </div>
            <h3 className="text-xl font-black leading-snug">{step.title}</h3>
            <p className="text-[15px] leading-relaxed text-neutral-200">{step.body}</p>
            {step.letterCheck && <SafetyNote tone="info">{STAMPED_LETTER_NOTE}</SafetyNote>}
            {step.safety && <SafetyNote>{step.safety}</SafetyNote>}
            <PartLinkList ids={step.parts} />
          </article>

          {tools.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-neutral-300">Save results to</span>
              <select
                value={currentTool()?.id ?? ""}
                onChange={(e) => setLogToolId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/15 bg-[#121212] px-3 text-sm"
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

          {step.branch ? (
            <div className="space-y-2">
              <p className="font-semibold">{step.branch.prompt}</p>
              {step.branch.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onBranch(opt.id)}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center text-sm font-bold"
                >
                  {opt.label}
                </button>
              ))}
              <FixedItButton
                source="diagnose"
                tools={tools}
                tool={currentTool()}
                toolType={toolType ?? currentTool()?.toolType}
                symptom={tree.title}
                fix={step.title}
                onSaved={onFixedWin}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <FixedItButton
                source="diagnose"
                tools={tools}
                tool={currentTool()}
                toolType={toolType ?? currentTool()?.toolType}
                symptom={tree.title}
                fix={step.title}
                onSaved={onFixedWin}
              />
              <button
                type="button"
                onClick={onStillBroken}
                className="flex min-h-12 items-center justify-center rounded-xl bg-garage-orange px-4 py-3 text-sm font-black text-black"
              >
                STILL BROKEN → Next cheapest check
              </button>
            </div>
          )}
          {savedMsg && <p className="text-sm text-diy">{savedMsg}</p>}
        </div>
      )}

      {stage === "done" && done && tree && (
        <div className="space-y-3">
          <article
            className={`space-y-2 rounded-2xl border p-4 ${
              done.kind === "fixed"
                ? "border-diy/40 bg-diy/10"
                : "border-white/10 bg-garage-card"
            }`}
          >
            <h3 className="text-xl font-black leading-snug">{done.title}</h3>
            <p className="text-[15px] leading-relaxed text-neutral-200">{done.body}</p>
            {done.hint && <p className="text-sm text-neutral-400">{done.hint}</p>}
            {done.kind === "fixed" && step && (
              <ShareFixButton
                label="Share this win"
                input={{
                  toolType: lastWin?.toolType ?? toolType ?? currentTool()?.toolType,
                  brandModel: lastWin
                    ? [lastWin.make, lastWin.model].filter(Boolean).join(" ")
                    : anonymousBrandModel(currentTool()),
                  symptom: lastWin?.symptom ?? tree.title,
                  fix: lastWin?.fix ?? step.title,
                  worked: "yes",
                }}
              />
            )}
          </article>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                setStage("tree");
                setTree(null);
                setStepIndex(0);
                setDone(null);
              }}
              className="min-h-12 rounded-xl border border-white/20 px-4 font-bold"
            >
              Pick another symptom
            </button>
            <button
              type="button"
              onClick={() => setTab("shop")}
              className="min-h-12 rounded-xl bg-garage-orange px-4 font-black text-black"
            >
              Open Shop Meter
            </button>
            <button type="button" onClick={reset} className="min-h-12 text-sm font-semibold text-neutral-400">
              Start over
            </button>
          </div>
        </div>
      )}

      <Disclaimer compact />
    </div>
  );
}
