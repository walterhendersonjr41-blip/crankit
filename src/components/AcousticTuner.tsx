import { useEffect, useRef, useState } from "react";
import { FixedItButton } from "./FixedItButton";
import { SafetyNote } from "./SafetyNote";
import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import {
  ELECTRONIC_CARB_NOTE,
  LIMITER_H_NOTE,
  NEED_MAX_BANNER,
  RANGE_NOTE,
  RpmSmoother,
  canUseGeneralWot,
  estimateFiring,
  hasElectronicCarb,
  hasWotAnchor,
  median,
  parseMaxRpm,
  rpmToHz,
  tuneVerdict,
  type EngineCycle,
  type TuneMode,
  type TuneVerdict,
} from "../lib/rpmMath";
import { findModelSpec, officialMaxRpm, type ModelSpec } from "../data/modelSpecs";
import { useAppState } from "../state";
import {
  AUTO_DETECT_SECONDS,
  classifyEngine,
  formatConfidence,
  type EngineGuess,
} from "../lib/engineDetect";
import { readingLooksWrong } from "../lib/engineSanity";
import {
  analyzeMisses,
  firingHzForRpm,
  formatMissRate,
  syntheticMissWave,
  type MissReport,
  type SimMissPattern,
} from "../lib/missDetect";
import {
  getCustomSetup,
  saveHealthCheck,
  scoringSpec,
  usesOwnBaseline,
  recordMismatchConfirm,
  markToolCustom,
  useHealthRecord,
  formatHealthScore,
} from "../lib/toolHealth";
import { EngineShortlist, ModelSpecPicker } from "./ModelSpecPicker";

const LISTEN_LABEL = "🎙️ Listen to My Engine (Live RPM & Tune Check)";
const FFT_SIZE = 8192;
const GAUGE_MIN = 0;
const GAUGE_MAX = 15000;

type ListenError = "denied" | "unsupported" | "failed" | null;
type CapturePhase = "idle" | "countdown" | "capturing" | "result";

function toneClass(tone: TuneVerdict["tone"]): string {
  if (tone === "green") return "border-diy/50 bg-diy/15 text-green-100";
  if (tone === "borderline") return "border-lime-400/40 bg-lime-950/50 text-lime-100";
  if (tone === "yellow") return "border-yellow-400/50 bg-yellow-950/50 text-yellow-100";
  if (tone === "info") return "border-white/25 bg-black/40 text-neutral-100";
  return "border-shop/60 bg-red-950/50 text-red-100";
}

export function AcousticTuner({ autoOpen = false }: { autoOpen?: boolean }) {
  const { tools, carbFocus, clearCarbFocus } = useAppState();
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    source?: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    stream?: MediaStream;
    simOsc?: OscillatorNode;
    simGain?: GainNode;
    filter?: BiquadFilterNode;
    proc?: ScriptProcessorNode;
    mute?: GainNode;
    raf?: number;
  } | null>(null);
  const audioRing = useRef<Float32Array[]>([]);
  const collectingRef = useRef(false);
  const rpmTrail = useRef<number[]>([]);
  const smootherRef = useRef(new RpmSmoother());
  const captureBuf = useRef<number[]>([]);
  const simulateRef = useRef(false);
  const cycleRef = useRef<EngineCycle>("2-stroke");

  const [toolId, setToolId] = useState(tools[0]?.id ?? "");
  const selected = tools.find((t) => t.id === toolId) ?? tools[0];
  const healthRec = useHealthRecord(selected?.id);
  const matchedSpec = findModelSpec(selected?.name, selected?.brandModel, selected?.brand);
  const [maxRpmText, setMaxRpmText] = useState(selected?.maxRpm ? String(selected.maxRpm) : "");
  const [mode, setMode] = useState<TuneMode>("idle");
  const [cycle, setCycle] = useState<EngineCycle>("2-stroke");
  const [listening, setListening] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [playTone, setPlayTone] = useState(false);
  const [simRpm, setSimRpm] = useState(2800);
  const [liveRpm, setLiveRpm] = useState<number | null>(null);
  const [clear, setClear] = useState(false);
  const [error, setError] = useState<ListenError>(null);
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [heldRpm, setHeldRpm] = useState<number | null>(null);
  const [pickedSpec, setPickedSpec] = useState<ModelSpec | undefined>(undefined);
  const [guess, setGuess] = useState<EngineGuess | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [mismatchOk, setMismatchOk] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [miss, setMiss] = useState<MissReport | null>(null);
  const [simMiss, setSimMiss] = useState<SimMissPattern | "healthy">("healthy");
  const [sessionIdle, setSessionIdle] = useState<number | undefined>();
  const [sessionIdleStab, setSessionIdleStab] = useState<number | undefined>();
  const [sessionWot, setSessionWot] = useState<number | undefined>();
  const [sessionRevUp, setSessionRevUp] = useState<number | undefined>();
  const [healthNote, setHealthNote] = useState("");
  const [installedTyped, setInstalledTyped] = useState("");

  const custom = healthRec?.custom ?? (selected ? getCustomSetup(selected.id) : undefined);
  const machineSpec = pickedSpec ?? matchedSpec;
  const judgeSpec = scoringSpec(machineSpec, custom) ?? (usesOwnBaseline(custom) ? undefined : machineSpec);
  const ownBaseline = usesOwnBaseline(custom);
  const maxRpm = parseMaxRpm(maxRpmText || (custom?.maxRpm != null ? String(custom.maxRpm) : ""), cycle);
  const displayRpm = simulate ? simRpm : phase === "result" && heldRpm != null ? heldRpm : liveRpm;
  const showVerdict = displayRpm != null && (simulate || clear || phase === "result");
  const tuneCtx = { toolType: selected?.toolType, cycle };
  const sanity =
    showVerdict && displayRpm != null && judgeSpec && !ownBaseline && !mismatchOk
      ? readingLooksWrong(displayRpm, mode, { spec: judgeSpec, cycle, modelName: judgeSpec.name })
      : { mismatch: false as const };
  const blockVerdict = Boolean(sanity.mismatch);
  const verdict =
    showVerdict && displayRpm != null && !blockVerdict
      ? tuneVerdict(displayRpm, mode, maxRpm, judgeSpec, tuneCtx)
      : null;
  const needMaxBanner =
    cycle === "2-stroke" &&
    mode === "full-throttle" &&
    !hasWotAnchor(maxRpm, ownBaseline ? undefined : judgeSpec, cycle) &&
    !canUseGeneralWot(tuneCtx);
  const electronic = hasElectronicCarb(selected) || Boolean(judgeSpec?.noMixtureScrews);
  const highlighted = autoOpen || carbFocus === "tuner";

  useEffect(() => {
    simulateRef.current = simulate;
  }, [simulate]);

  useEffect(() => {
    cycleRef.current = cycle;
  }, [cycle]);

  useEffect(() => {
    const spec = scoringSpec(pickedSpec ?? matchedSpec, selected ? getCustomSetup(selected.id) : undefined);
    if (spec?.engineCycle === "4-stroke") setCycle("4-stroke");
    else if (spec?.engineCycle === "2-stroke") setCycle("2-stroke");
    setMismatchOk(false);
  }, [selected?.id, matchedSpec?.id, pickedSpec?.id]);

  useEffect(() => {
    const fromTool = selected?.maxRpm;
    const fromSpec = officialMaxRpm(matchedSpec);
    const next = fromTool ?? fromSpec;
    if (next == null) return;
    setMaxRpmText((prev) => (prev.trim() ? prev : String(next)));
  }, [selected?.id, selected?.maxRpm, matchedSpec]);

  useEffect(() => {
    if (carbFocus === "tuner") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      clearCarbFocus();
    }
  }, [carbFocus, highlighted, clearCarbFocus]);

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    const bag = audioRef.current;
    if (bag?.raf) cancelAnimationFrame(bag.raf);
    try {
      bag?.simOsc?.stop();
    } catch {
      // already stopped
    }
    bag?.simOsc?.disconnect();
    bag?.simGain?.disconnect();
    bag?.filter?.disconnect();
    try { bag?.proc?.disconnect(); } catch { /* ignore */ }
    try { bag?.mute?.disconnect(); } catch { /* ignore */ }
    bag?.source?.disconnect();
    bag?.analyser.disconnect();
    bag?.stream?.getTracks().forEach((t) => t.stop());
    if (bag?.ctx && bag.ctx.state !== "closed") void bag.ctx.close();
    audioRef.current = null;
    setListening(false);
  }

  async function startMic() {
    setError(null);
    setSimulate(false);
    setHeldRpm(null);
    setPhase("idle");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return;
    }
    stopAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);
      audioRing.current = [];
      rpmTrail.current = [];
      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        audioRing.current.push(new Float32Array(input));
        let total = audioRing.current.reduce((s, a) => s + a.length, 0);
        while (total > ctx.sampleRate * 6 && audioRing.current.length > 1) {
          total -= audioRing.current[0].length;
          audioRing.current.shift();
        }
      };
      audioRef.current = { ctx, source, analyser, stream, proc, mute };
      smootherRef.current.reset();
      setListening(true);
      setClear(false);
      setLiveRpm(null);
      tick();
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
      setError(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "failed");
    }
  }

  function tick() {
    const bag = audioRef.current;
    if (!bag?.analyser) return;
    const { analyser, ctx } = bag;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Float32Array(analyser.frequencyBinCount);
    const loop = () => {
      if (!audioRef.current) return;
      analyser.getFloatTimeDomainData(time);
      analyser.getFloatFrequencyData(freq);
      // Convert dB to a linear-ish magnitude for peak picking.
      const linear = new Float32Array(freq.length);
      for (let i = 0; i < freq.length; i++) linear[i] = Math.pow(10, freq[i] / 20);
      drawWave(time);

      if (audioRef.current && !simulateRef.current) {
        const est = estimateFiring(
          time,
          ctx.sampleRate,
          { magnitudes: linear, fftSize: analyser.fftSize },
          cycleRef.current,
        );
        if (est && est.confidence > 0) {
          const smooth = smootherRef.current.push(est.rpm);
          setLiveRpm(smooth);
          setClear(true);
          rpmTrail.current.push(smooth);
          if (rpmTrail.current.length > 40) rpmTrail.current.shift();
          if (phaseRef.current === "capturing") captureBuf.current.push(est.rpm);
        } else {
          setClear(false);
        }
      }
      bag.raf = requestAnimationFrame(loop);
    };
    bag.raf = requestAnimationFrame(loop);
  }

  const phaseRef = useRef<CapturePhase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  function drawWave(samples: ArrayLike<number>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 96;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b0b0b";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,107,0,0.25)";
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
    if (samples.length < 2) return;
    g.strokeStyle = "#FF6B00";
    g.lineWidth = 2;
    g.beginPath();
    const step = Math.max(1, Math.floor(samples.length / w));
    for (let x = 0, i = 0; x < w; x++, i += step) {
      const v = samples[Math.min(i, samples.length - 1)];
      const y = h / 2 - v * (h * 0.42);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  useEffect(() => {
    if (!simulate) return;
    drawSimWave(simRpm);
  }, [simulate, simRpm, playTone]);

  function drawSimWave(rpm: number) {
    const hz = rpmToHz(rpm, cycleRef.current);
    const n = 1024;
    const buf = new Float32Array(n);
    const sr = 44100;
    for (let i = 0; i < n; i++) buf[i] = 0.7 * Math.sin((2 * Math.PI * hz * i) / sr);
    drawWave(buf);
  }

  function startSimulate() {
    stopAll();
    setError(null);
    setSimulate(true);
    setListening(false);
    setClear(true);
    setPhase("idle");
    setHeldRpm(null);
    setLiveRpm(simRpm);
    drawSimWave(simRpm);
    if (playTone) startSimTone(simRpm);
  }

  function startSimTone(rpm: number) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = rpmToHz(rpm, cycleRef.current);
      filter.type = "lowpass";
      filter.frequency.value = Math.min(2000, rpmToHz(rpm, cycleRef.current) * 8);
      gain.gain.value = 0.04;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioRef.current = { ctx, analyser: ctx.createAnalyser(), simOsc: osc, simGain: gain, filter };
    } catch {
      // Demo tone is optional.
    }
  }

  useEffect(() => {
    if (!simulate) return;
    const bag = audioRef.current;
    if (playTone && !bag?.simOsc) startSimTone(simRpm);
    if (!playTone && bag?.simOsc) {
      try {
        bag.simOsc.stop();
      } catch {
        // already stopped
      }
      bag.simOsc.disconnect();
      bag.simGain?.disconnect();
      if (bag.ctx.state !== "closed") void bag.ctx.close();
      audioRef.current = null;
    }
    if (bag?.simOsc) bag.simOsc.frequency.value = rpmToHz(simRpm, cycleRef.current);
    setLiveRpm(simRpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTone, simRpm, simulate]);

  async function runFullThrottleCapture() {
    if (simulate) {
      setHeldRpm(simRpm);
      setPhase("result");
      return;
    }
    if (!listening) await startMic();
    captureBuf.current = [];
    smootherRef.current.reset();
    setHeldRpm(null);
    setPhase("countdown");
    for (const n of [3, 2, 1]) {
      setCountdown(n);
      await wait(700);
      if (!audioRef.current && !simulate) {
        setPhase("idle");
        return;
      }
    }
    setCountdown(0);
    setPhase("capturing");
    await wait(2000);
    const samples = captureBuf.current;
    setPhase("result");
    if (samples.length === 0) {
      setHeldRpm(null);
      setClear(false);
      return;
    }
    setHeldRpm(median(samples));
    setClear(true);
    const mid = median(samples);
    setSessionWot(mid);
    if (sessionIdle != null && mid > sessionIdle) {
      setSessionRevUp(2000);
    }
    const wave = concatRing();
    const sr = audioRef.current?.ctx.sampleRate ?? 44100;
    if (wave.length > sr * 0.4) {
      const report = analyzeMisses(wave, sr, { cycle: cycleRef.current, mode: "full-throttle" });
      setMiss(report);
    }
  }

  function concatRing(): Float32Array {
    const parts = audioRing.current;
    const n = parts.reduce((s, a) => s + a.length, 0);
    const out = new Float32Array(n);
    let o = 0;
    for (const part of parts) {
      out.set(part, o);
      o += part.length;
    }
    return out;
  }

  function applyPickedSpec(spec: ModelSpec | undefined) {
    setPickedSpec(spec);
    if (!spec) return;
    setCycle(spec.engineCycle === "4-stroke" ? "4-stroke" : "2-stroke");
    const official = officialMaxRpm(spec);
    if (official) setMaxRpmText(String(official));
    setMismatchOk(false);
  }

  async function runAutoDetect() {
    setGuess(null);
    setDetecting(true);
    if (simulate) {
      const sr = 44100;
      const rpm = simRpm;
      const wave = syntheticMissWave(simMiss, firingHzForRpm(rpm, cycleRef.current), sr, AUTO_DETECT_SECONDS);
      const g = classifyEngine(wave, sr, Array.from({ length: 10 }, () => rpm));
      setGuess(g);
      setMiss(analyzeMisses(wave, sr, { cycle: g.cycle ?? cycleRef.current, mode }));
      setDetecting(false);
      return;
    }
    if (!listening) await startMic();
    audioRing.current = [];
    rpmTrail.current = [];
    collectingRef.current = true;
    await wait(AUTO_DETECT_SECONDS * 1000);
    collectingRef.current = false;
    setDetecting(false);
    const bag = audioRef.current;
    if (!bag) return;
    const wave = concatRing();
    const g = classifyEngine(wave, bag.ctx.sampleRate, rpmTrail.current.slice());
    setGuess(g);
    if (wave.length > 1000) {
      setMiss(analyzeMisses(wave, bag.ctx.sampleRate, { cycle: g.cycle ?? cycleRef.current, mode }));
    }
  }

  function applySimMiss(pattern: SimMissPattern | "healthy") {
    setSimMiss(pattern);
    const rpm = simRpm;
    const sr = 44100;
    const wave = syntheticMissWave(pattern, firingHzForRpm(rpm, cycleRef.current), sr, 1.2);
    setMiss(analyzeMisses(wave, sr, { cycle: cycleRef.current, mode, engineHot: pattern === "hot-coil" }));
  }

  function recordCurrentIdle() {
    if (displayRpm == null) return;
    setSessionIdle(displayRpm);
    if (rpmTrail.current.length >= 4) {
      const vals = rpmTrail.current.slice(-12);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const cv = mean ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) / mean : 0;
      setSessionIdleStab(cv);
    }
    const wave = concatRing();
    const sr = audioRef.current?.ctx.sampleRate ?? 44100;
    if (wave.length > sr * 0.4) {
      setMiss(analyzeMisses(wave, sr, { cycle: cycleRef.current, mode: "idle" }));
    }
  }

  function onYesItsRight() {
    if (selected) {
      const next = recordMismatchConfirm(selected.id);
      if (next.confirmCount >= 2) setShowSwap(true);
    }
    setMismatchOk(true);
  }

  function saveCheck() {
    if (!selected) {
      setHealthNote("Pick a garage tool first.");
      return;
    }
    if (blockVerdict) {
      setHealthNote("Confirm the engine before saving a health check.");
      return;
    }
    const saved = saveHealthCheck({
      toolId: selected.id,
      idleRpm: sessionIdle,
      idleStability: sessionIdleStab,
      wotRpm: sessionWot ?? (mode === "full-throttle" ? displayRpm ?? undefined : undefined),
      missRate: miss?.missRate,
      missPattern: miss?.pattern,
      revUpMs: sessionRevUp,
      spec: judgeSpec,
      confirmedMismatch: mismatchOk,
    });
    setHealthNote(saved ? (saved.isBaseline ? "Baseline health check saved on this device." : `Health check saved · ${formatHealthScore(saved.score)}.`) : "Health check was not saved.");
  }

  const rpmLabel = displayRpm != null && (simulate || clear || phase === "result") ? Math.round(displayRpm) : null;

  return (
    <section
      ref={rootRef}
      id="acoustic-tuner"
      className={`space-y-3 rounded-2xl border p-4 ${
        highlighted ? "border-garage-orange bg-garage-card" : "border-white/10 bg-garage-card"
      }`}
    >
      <div>
        <h3 className="text-lg font-black leading-snug">Acoustic RPM &amp; Carb Sound Tuner</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-300">
          Listens on this device only. Audio is analyzed in the browser and is never recorded, saved, or uploaded.
        </p>
        {judgeSpec && (
          <p className="mt-2 rounded-xl border border-diy/40 bg-diy/10 px-3 py-2 text-sm leading-relaxed text-green-100">
            Using specs for {judgeSpec.name} from the official manual.
            {judgeSpec.idleRpm != null && ` Idle ${judgeSpec.idleRpm.toLocaleString()} RPM.`}
            {judgeSpec.idleRpmMin != null &&
              judgeSpec.idleRpmMax != null &&
              ` Idle ${judgeSpec.idleRpmMin.toLocaleString()}–${judgeSpec.idleRpmMax.toLocaleString()} RPM.`}
            {judgeSpec.maxRpm != null && ` Max / WOT ${judgeSpec.maxRpm.toLocaleString()} RPM.`}
            {judgeSpec.maxRpmMin != null &&
              judgeSpec.maxRpmMax != null &&
              ` WOT ${judgeSpec.maxRpmMin.toLocaleString()}–${judgeSpec.maxRpmMax.toLocaleString()} RPM.`}
            {judgeSpec.note ? ` ${judgeSpec.note}` : ""}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void startMic()}
        className="flex min-h-14 w-full items-center justify-center rounded-xl bg-garage-orange px-4 text-center text-sm font-black leading-snug text-black"
      >
        {LISTEN_LABEL}
      </button>
      <button
        type="button"
        onClick={() => void runAutoDetect()}
        disabled={detecting}
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-garage-orange px-4 text-center text-sm font-black text-orange-200 disabled:opacity-50"
      >
        {detecting ? "Listening ~5 seconds…" : "Auto-detect engine"}
      </button>
      {guess && (
        <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-3">
          <p className="text-sm font-black leading-snug">{guess.summary}</p>
          {!guess.lowConfidence && (
            <p className="text-xs text-neutral-400">{formatConfidence(guess.confidence)}</p>
          )}
          {!guess.lowConfidence && (
            <EngineShortlist specs={guess.matches} onPick={(spec) => applyPickedSpec(spec)} />
          )}
          {guess.lowConfidence && (
            <p className="text-xs text-neutral-400">Pick from the official list below rather than guessing.</p>
          )}
        </div>
      )}

      {error === "denied" && (
        <p className="text-sm text-yellow-100">
          Microphone was blocked. You can allow it in the browser settings, or use Test Without Mic below.
        </p>
      )}
      {error === "unsupported" && (
        <p className="text-sm text-yellow-100">
          This browser can’t use the microphone. Open this page over HTTPS in a current mobile browser, or use Test
          Without Mic.
        </p>
      )}
      {error === "failed" && (
        <p className="text-sm text-yellow-100">Couldn’t start the microphone. Try again, or use Test Without Mic.</p>
      )}

      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={simulate}
          onChange={(e) => {
            if (e.target.checked) startSimulate();
            else {
              setSimulate(false);
              stopAll();
              setLiveRpm(null);
              setClear(false);
              setPhase("idle");
            }
          }}
        />
        Test Without Mic (Simulate Engine Sound)
      </label>

      {simulate && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <label className="block text-sm font-semibold">
            Simulated RPM: {simRpm.toLocaleString()}
            <input
              type="range"
              min={1500}
              max={15000}
              step={50}
              value={simRpm}
              onChange={(e) => setSimRpm(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {(cycle === "4-stroke" ? [1400, 1800, 2800, 3200, 3600, 4000] : [2200, 2800, 3400, 10000, 12000, 13500]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSimRpm(n)}
                className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold"
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-neutral-300">
            <input type="checkbox" checked={playTone} onChange={(e) => setPlayTone(e.target.checked)} />
            Play a synthesized engine tone
          </label>
          <p className="text-xs font-bold text-neutral-300">Demo miss patterns</p>
          <div className="flex flex-wrap gap-2">
            {(["healthy", "regular-skip", "surge", "rich-burble", "bog", "hot-coil"] as const).map((pat) => (
              <button
                key={pat}
                type="button"
                onClick={() => applySimMiss(pat)}
                className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${
                  simMiss === pat ? "border-garage-orange bg-garage-orange text-black" : "border-white/20"
                }`}
              >
                {pat === "regular-skip" ? "Regular skips" : pat === "rich-burble" ? "Rich burble" : pat === "hot-coil" ? "Hot coil" : pat[0].toUpperCase() + pat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {tools.length > 0 && (
        <label className="block text-sm font-semibold text-neutral-300">
          Garage tool
          <select
            value={selected?.id ?? ""}
            onChange={(e) => {
              setToolId(e.target.value);
              const next = tools.find((t) => t.id === e.target.value);
              const spec = findModelSpec(next?.name, next?.brandModel, next?.brand);
              setMaxRpmText(next?.maxRpm ? String(next.maxRpm) : officialMaxRpm(spec) ? String(officialMaxRpm(spec)) : "");
            }}
            className="input mt-1"
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
      <ModelSpecPicker
        label="Or pick the official engine (one tap, nothing is assigned until you pick)"
        value={pickedSpec?.id ?? judgeSpec?.id ?? matchedSpec?.id}
        onPick={(spec) => applyPickedSpec(spec)}
      />

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Engine type">
        <button
          type="button"
          role="radio"
          aria-checked={cycle === "2-stroke"}
          onClick={() => setCycle("2-stroke")}
          className={`min-h-12 rounded-xl border px-3 text-sm font-black ${
            cycle === "2-stroke" ? "border-garage-orange bg-garage-orange text-black" : "border-white/15 bg-white/5"
          }`}
        >
          2-stroke
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cycle === "4-stroke"}
          onClick={() => setCycle("4-stroke")}
          className={`min-h-12 rounded-xl border px-3 text-sm font-black ${
            cycle === "4-stroke" ? "border-garage-orange bg-garage-orange text-black" : "border-white/15 bg-white/5"
          }`}
        >
          4-stroke
        </button>
      </div>
      <p className="text-xs leading-relaxed text-neutral-400">
        {cycle === "4-stroke"
          ? "4-stroke mode is for mowers, generators, and pressure washers. RPM = firing Hz × 120. No H-screw mixture advice — we only compare RPM to a governed speed you enter from the manual."
          : "2-stroke mode is for chainsaws, trimmers, and blowers. RPM = firing Hz × 60."}
      </p>

      <label className="block text-sm font-semibold text-neutral-300">
        {cycle === "4-stroke"
          ? "Governed / max RPM from the manual (optional)"
          : "My tool’s max RPM (from the manual, optional)"}
        <input
          type="number"
          inputMode="numeric"
          min={cycle === "4-stroke" ? 1000 : 3000}
          max={20000}
          placeholder="Only if your manual lists it"
          value={maxRpmText}
          onChange={(e) => setMaxRpmText(e.target.value)}
          className="input mt-1"
        />
      </label>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Tuner mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "idle"}
          onClick={() => {
            setMode("idle");
            setPhase("idle");
            setHeldRpm(null);
          }}
          className={`min-h-12 rounded-xl border px-3 text-sm font-black ${
            mode === "idle" ? "border-garage-orange bg-garage-orange text-black" : "border-white/15 bg-white/5"
          }`}
        >
          At Idle
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "full-throttle"}
          onClick={() => {
            setMode("full-throttle");
            setPhase("idle");
            setHeldRpm(null);
          }}
          className={`min-h-12 rounded-xl border px-3 text-sm font-black ${
            mode === "full-throttle" ? "border-garage-orange bg-garage-orange text-black" : "border-white/15 bg-white/5"
          }`}
        >
          Full Throttle Test
        </button>
      </div>

      {needMaxBanner && (
        <p className="rounded-xl border border-yellow-400/40 bg-yellow-950/40 px-3 py-2 text-sm leading-relaxed text-yellow-100">
          {NEED_MAX_BANNER}
        </p>
      )}

      {(listening || simulate) && (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            className="h-24 w-full rounded-xl border border-white/10 bg-black"
            aria-label="Live engine waveform"
          />
          <RpmGauge rpm={rpmLabel} verdict={verdict} />
          <p className="text-center text-3xl font-black tabular-nums" aria-live="polite">
            {rpmLabel != null ? `${rpmLabel.toLocaleString()} RPM` : listening && !clear ? "Listening…" : "—"}
          </p>
          {listening && !simulate && !clear && phase !== "capturing" && phase !== "countdown" && (
            <p className="text-center text-sm font-semibold text-neutral-400">No clear engine sound</p>
          )}
          {mode === "full-throttle" && (
            <div className="space-y-2">
              {phase === "countdown" && (
                <p className="text-center text-lg font-black">Hold wide-open throttle… {countdown}</p>
              )}
              {phase === "capturing" && (
                <p className="text-center text-lg font-black">Listening 2 seconds…</p>
              )}
              <button
                type="button"
                onClick={() => void runFullThrottleCapture()}
                disabled={phase === "countdown" || phase === "capturing"}
                className="min-h-12 w-full rounded-xl border border-garage-orange px-3 text-sm font-black text-orange-200 disabled:opacity-50"
              >
                {phase === "result" ? "Run 2-second test again" : "Start 2-second full-throttle test"}
              </button>
            </div>
          )}
          {listening && !simulate && (
            <button type="button" onClick={stopAll} className="min-h-11 w-full text-sm font-bold text-neutral-400">
              Stop listening
            </button>
          )}
          {mode === "idle" && displayRpm != null && (clear || simulate) && (
            <button
              type="button"
              onClick={recordCurrentIdle}
              className="min-h-11 w-full rounded-xl border border-white/20 text-sm font-bold"
            >
              Use this idle for a Health check
            </button>
          )}
        </div>
      )}

      {blockVerdict && sanity.mismatch && (
        <div className="space-y-2 rounded-2xl border border-yellow-400/50 bg-yellow-950/40 p-4" role="status">
          <p className="text-lg font-black leading-snug">{sanity.message}</p>
          <p className="text-sm leading-relaxed">
            This reading is too far off the official spec (or sounds like a different engine cycle) to score or give a scary verdict yet.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => { setShowSwap(true); setPickedSpec(undefined); }} className="min-h-11 rounded-xl border border-white/20 text-xs font-bold">
              Change engine
            </button>
            <button
              type="button"
              onClick={() => {
                setHeldRpm(null);
                setPhase("idle");
                setMismatchOk(false);
                if (!simulate) void startMic();
              }}
              className="min-h-11 rounded-xl border border-white/20 text-xs font-bold"
            >
              Retest
            </button>
            <button type="button" onClick={onYesItsRight} className="min-h-11 rounded-xl border border-white/20 text-xs font-bold">
              Yes, it&apos;s right
            </button>
          </div>
        </div>
      )}

      {verdict && (
        <div className={`space-y-2 rounded-2xl border p-4 ${toneClass(verdict.tone)}`} role="status">
          <p className="text-lg font-black leading-snug">{verdict.title}</p>
          <p className="text-sm leading-relaxed">{verdict.body}</p>
        </div>
      )}

      {electronic && cycle === "2-stroke" && (
        <SafetyNote>{judgeSpec?.noMixtureScrewsNote || ELECTRONIC_CARB_NOTE}</SafetyNote>
      )}
      {cycle === "2-stroke" ? (
        <>
          <SafetyNote tone="info">{RANGE_NOTE}</SafetyNote>
          <SafetyNote tone="info">{LIMITER_H_NOTE}</SafetyNote>
          <SafetyNote tone="info">{STAMPED_LETTER_NOTE}</SafetyNote>
        </>
      ) : (
        <SafetyNote tone="info">
          4-stroke RPM is firing Hz × 120. Compare it to the governed speed in your manual. This mode does not give
          H-screw mixture advice, and no audio is recorded or uploaded.
        </SafetyNote>
      )}
      {miss && (
        <div className="space-y-2 rounded-2xl border border-white/15 bg-black/30 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">Miss Detector</p>
          <p className="text-lg font-black leading-snug">
            {formatMissRate(miss.missRate)} miss rate · {miss.patternLabel}
          </p>
          <p className="text-sm leading-relaxed">{miss.likelyCause}</p>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-black">Health check</p>
        <p className="text-xs leading-relaxed text-neutral-400">
          Saves idle RPM and stability, WOT, miss rate, and rev-up time on this device only, for the selected garage tool. The first check is the baseline.
        </p>
        <button type="button" onClick={saveCheck} className="min-h-12 w-full rounded-xl bg-garage-orange text-sm font-black text-black">
          Save health check
        </button>
        {healthNote && <p className="text-xs text-neutral-300">{healthNote}</p>}
      </div>

      {selected && !showSwap && (custom?.confirmCount ?? 0) < 2 && !custom?.enabled && (
        <button type="button" onClick={() => setShowSwap(true)} className="min-h-11 w-full text-xs font-bold text-orange-200">
          Mark as Custom / engine swap
        </button>
      )}

      {(showSwap || custom?.enabled || (selected && (custom?.confirmCount ?? 0) >= 2)) && (
        <div className="space-y-2 rounded-2xl border border-white/15 bg-black/30 p-4">
          <p className="text-sm font-black">Which engine is actually in it?</p>
          <p className="text-xs leading-relaxed text-neutral-400">
            If the installed engine is on the official list and is not modified, we judge it against that engine’s stock specs. Own-baseline scoring is used only when the engine is unknown or you mark it Modified.
          </p>
          <ModelSpecPicker
            label="Installed engine"
            value={custom?.installedSpecId}
            onPick={(spec) => {
              if (!selected) return;
              markToolCustom(selected.id, {
                installedEngine: spec?.name ?? installedTyped,
                installedSpecId: spec?.id,
                modified: custom?.modified,
                maxRpm: spec ? officialMaxRpm(spec) : custom?.maxRpm,
              });
              applyPickedSpec(spec);
            }}
          />
          <label className="block text-xs font-semibold text-neutral-300">
            Or type the engine
            <input
              className="input mt-1"
              value={installedTyped}
              onChange={(e) => setInstalledTyped(e.target.value)}
              onBlur={() => {
                if (!selected || !installedTyped.trim()) return;
                markToolCustom(selected.id, { installedEngine: installedTyped.trim(), modified: custom?.modified, maxRpm: custom?.maxRpm });
              }}
            />
          </label>
          {selected && (
            <label className="flex min-h-11 items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={Boolean(custom?.modified)}
                onChange={(e) =>
                  markToolCustom(selected.id, {
                    installedEngine: custom?.installedEngine ?? installedTyped,
                    installedSpecId: custom?.installedSpecId,
                    modified: e.target.checked,
                    maxRpm: custom?.maxRpm,
                  })
                }
              />
              Modified (cam, carb, porting, etc.)
            </label>
          )}
          <button
            type="button"
            className="min-h-11 text-xs font-bold text-orange-200"
            onClick={() => {
              if (!selected) return;
              markToolCustom(selected.id, {
                installedEngine: custom?.installedEngine ?? installedTyped,
                installedSpecId: custom?.installedSpecId,
                modified: custom?.modified,
                maxRpm: custom?.maxRpm,
              });
              setShowSwap(true);
            }}
          >
            Mark as Custom / engine swap
          </button>
        </div>
      )}

      <FixedItButton
        source="tuner"
        tools={tools}
        tool={selected}
        toolType={selected?.toolType}
        symptom="Carb / RPM tune"
        fix=""
      />
    </section>
  );
}

function RpmGauge({ rpm, verdict }: { rpm: number | null; verdict: TuneVerdict | null }) {
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, rpm ?? 0));
  const t = clamped / GAUGE_MAX;
  const angle = Math.PI * (1 - t);
  const cx = 160;
  const cy = 120;
  const r = 96;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const color =
    verdict?.tone === "red"
      ? "#EF4444"
      : verdict?.tone === "yellow"
        ? "#FBBF24"
        : verdict?.tone === "borderline"
          ? "#A3E635"
          : verdict?.tone === "green"
            ? "#22C55E"
            : verdict?.tone === "info"
              ? "#A3A3A3"
              : "#FF6B00";
  return (
    <svg viewBox="0 0 320 150" className="mx-auto w-full max-w-sm" role="img" aria-label="RPM gauge">
      <path d="M24 120 A136 136 0 0 1 296 120" fill="none" stroke="#222" strokeWidth="18" strokeLinecap="round" />
      <path d="M24 120 A136 136 0 0 1 296 120" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.85" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="8" fill={color} />
      <text x="24" y="142" fill="#888" fontSize="11">
        0
      </text>
      <text x="270" y="142" fill="#888" fontSize="11">
        15k
      </text>
    </svg>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

