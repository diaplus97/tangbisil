/**
 * ApplePeelGame — 사과 깎기
 *
 * 후르츠 닌자 대신 이걸 골랐다. 탕비실에서 실제로 일어나는 일이고,
 * "껍질 안 끊고 얼마나 길게" 라는 목표가 설명 없이도 통한다.
 *
 * 조작은 하나뿐이다 — 누르고 있으면 칼이 깊이 들어가고, 떼면 빠진다.
 * 초록 구간(적당한 깊이)은 계속 움직인다. 벗어나면 껍질이 툭 끊긴다.
 * 폰에서 한 손으로 되는 게 중요해서 버튼 하나로 끝냈다.
 *
 * 결과물은 손에 들린다 — 먹든, 옆 사람 주든, 흡연실 아저씨한테 가져가든.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useBreakRoom, type HeldItem } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const INK = "hsl(30 25% 16%)";
const BEST_KEY = "tangbirsil_peel_best";

/* ── 난이도 ──────────────────────────────────────────────────
 * 물리를 그대로 떼서 "반응속도 N ms 인 사람" 으로 시뮬레이션을 돌려 맞췄다.
 *
 * 1차: 칼 58/s, 구간 15→9, 유예 0.2s — 절벽이었다.
 *      150ms 면 대부분 완주하는데 220ms 면 100% 즉사.
 * 2차: 완만하게 폈더니 이번엔 너무 후해졌다 (220ms 에도 88% 완주).
 * 3차(지금): 시작은 너그럽고 끝이 가혹하게. 구간이 좁아지는 걸 뒤로 몰았다
 *      (BAND_CURVE) — 초반엔 넓게 유지되다가 막판에 확 조인다.
 *
 * 지금 값의 시뮬 결과 (순수 반응만 하는 모델이라 실제보단 박하게 나온다.
 *  사람은 사인파를 예측하므로 체감은 이보다 쉽다):
 *    80ms → 완주 100%              150ms → 완주 60%
 *   220ms → 완주   0% (평균 77%)   300ms → 평균 41% (즉사 22%)
 *
 * 즉 "끝까지 안 끊고 깎기"는 숙련자만. 보통은 깎은 사과는 얻되 완주는 못 한다.
 * ─────────────────────────────────────────────────────────── */

/** 칼이 들어가고 빠지는 속도 (깊이 단위/초) */
const KNIFE_RATE = 50;
/** 다 깎는 데 걸리는 시간(초) — 초록 구간을 완벽히 유지했을 때 */
const FULL_PEEL_SEC = 13;
/** 구간을 벗어나도 이만큼은 봐준다(초). 없으면 너무 매몰차다 */
const GRACE_SEC = 0.28;
/** 초록 구간 반폭 — 갈수록 좁아진다 */
const BAND_START = 18;
const BAND_END = 5;
/** 좁아지는 곡선. 1보다 크면 초반엔 넓게 버티다 막판에 급격히 조인다 */
const BAND_CURVE = 1.8;
/** 칼이 처음 닿고 이 시간 동안은 구간을 넓게 열어준다 (시작하자마자 끊기는 걸 막는다) */
const EASE_SEC = 2.6;
const EASE_BONUS = 11;

type Phase = "ready" | "peeling" | "done";

type Result = {
  progress: number;
  cm: number;
  grade: "perfect" | "good" | "rough" | "fail";
};

function grade(progress: number): Result["grade"] {
  if (progress >= 99.5) return "perfect";
  if (progress >= 60) return "good";
  if (progress >= 25) return "rough";
  return "fail";
}

const GRADE_TEXT: Record<Result["grade"], { title: string; sub: string }> = {
  perfect: { title: "한 번에 다 깎았다", sub: "껍질이 안 끊겼다. 이거 자랑해도 된다." },
  good:    { title: "잘 깎았다",         sub: "먹을 만하게 깎였다." },
  rough:   { title: "대충 깎였다",       sub: "껍질이 좀 남았지만 뭐, 먹는 데 지장은 없다." },
  fail:    { title: "망했다",            sub: "시작하자마자 끊겼다. 사과는 그대로 남았다." },
};

const RESULT_ITEM: Record<Result["grade"], HeldItem | null> = {
  perfect: { id: "peeled-apple", emoji: "🍎", label: "깎은 사과" },
  good:    { id: "peeled-apple", emoji: "🍎", label: "깎은 사과" },
  rough:   { id: "rough-apple",  emoji: "🍎", label: "대충 깎은 사과" },
  fail:    { id: "apple",        emoji: "🍎", label: "사과" },
};

export default function ApplePeelGame({ onClose }: { onClose: () => void }) {
  const { pickUp, sendMessage } = useBreakRoom();

  const [phase, setPhase] = useState<Phase>("ready");
  const [progress, setProgress] = useState(0);
  const [depth, setDepth] = useState(50);
  const [band, setBand] = useState({ lo: 35, hi: 65 });
  const [warning, setWarning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { return 0; }
  });

  const holdRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ depth: 50, progress: 0, outFor: 0, t: 0, lastPeelSound: 0, started: false, since: 0 });
  // 판마다 초록 구간이 다르게 움직이게 — 외운 대로 하면 재미없다
  const phaseRef = useRef({ a: Math.random() * 6.28, b: Math.random() * 6.28 });

  const finish = useCallback((prog: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const g = grade(prog);
    const cm = Math.round(prog * 1.1);
    setResult({ progress: prog, cm, grade: g });
    setPhase("done");

    if (g === "perfect") sound.play("fanfare");
    else sound.play("snap");

    if (cm > best) {
      setBest(cm);
      try { localStorage.setItem(BEST_KEY, String(cm)); } catch { /* ignore */ }
    }

    const item = RESULT_ITEM[g];
    if (item) pickUp(item);
    sendMessage(
      g === "perfect" ? `사과 한 번에 다 깎음 🍎✨ 껍질 ${cm}cm`
      : g === "good"  ? `사과 깎음 🍎 껍질 ${cm}cm`
      : g === "rough" ? `사과 깎다 껍질 끊김 🍎 ${cm}cm`
      : "사과 깎기 실패… 🔪",
    );
  }, [best, pickUp, sendMessage]);

  const start = useCallback(() => {
    stateRef.current = { depth: 50, progress: 0, outFor: 0, t: 0, lastPeelSound: 0, started: false, since: 0 };
    phaseRef.current = { a: Math.random() * 6.28, b: Math.random() * 6.28 };
    setProgress(0);
    setDepth(50);
    setWarning(false);
    setResult(null);
    setPhase("peeling");

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      s.t += dt;

      // 칼 깊이 — 누르면 들어가고 떼면 빠진다
      s.depth += (holdRef.current ? KNIFE_RATE : -KNIFE_RATE) * dt;
      s.depth = Math.max(0, Math.min(100, s.depth));

      // 적당한 깊이는 계속 움직인다
      const { a, b } = phaseRef.current;
      const center = Math.max(20, Math.min(80,
        50 + 22 * Math.sin(s.t * 0.95 + a) + 8 * Math.sin(s.t * 1.75 + b)));
      let half = BAND_START + (BAND_END - BAND_START) * Math.pow(s.progress / 100, BAND_CURVE);
      if (s.started && s.since < EASE_SEC) half += EASE_BONUS * (1 - s.since / EASE_SEC);
      const lo = center - half, hi = center + half;

      const inside = s.depth >= lo && s.depth <= hi;

      // 시작하자마자 초록 구간이 멀리 있으면 손쓸 새도 없이 끊긴다.
      // 칼이 처음 구간에 닿기 전까지는 아무 일도 일어나지 않는다.
      if (!s.started) {
        if (inside) { s.started = true; s.since = 0; }
      } else {
        s.since += dt;
        if (inside) {
          s.outFor = 0;
          s.progress = Math.min(100, s.progress + (100 / FULL_PEEL_SEC) * dt);
          if (s.t - s.lastPeelSound > 0.32) {
            s.lastPeelSound = s.t;
            sound.play("peel");
          }
        } else {
          s.outFor += dt;
        }
      }

      setDepth(s.depth);
      setBand({ lo, hi });
      setProgress(s.progress);
      setWarning(s.started && !inside);

      if (s.started && !inside && s.outFor >= GRACE_SEC) { finish(s.progress); return; }
      if (s.progress >= 100) { finish(100); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finish]);

  // 언마운트 정리 — 루프가 남으면 화면 밖에서 계속 돈다
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // 스페이스바로도 되게 (데스크탑)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (phase === "ready") start();
      else if (phase === "peeling") holdRef.current = true;
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") holdRef.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, start]);

  const press = () => {
    if (phase === "ready") { start(); holdRef.current = true; return; }
    if (phase === "peeling") holdRef.current = true;
  };
  const release = () => { holdRef.current = false; };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(20,14,8,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 14,
        fontFamily: "'DotGothic16', monospace",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "peeling") onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 340,
        background: "hsl(38 32% 90%)",
        border: `4px solid ${INK}`,
        boxShadow: "6px 6px 0 rgba(0,0,0,0.45)",
        padding: 12,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}>
        {/* ── 머리 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "hsl(30 30% 22%)" }}>🔪 사과 깎기</span>
          <span style={{ marginLeft: "auto", fontSize: 9, color: "hsl(30 20% 45%)" }}>
            최고 {best}cm
          </span>
          {phase !== "peeling" && (
            <button onClick={onClose} aria-label="닫기" style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "hsl(30 20% 40%)", padding: "0 2px", lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* ── 사과 ── */}
        <div style={{
          background: "hsl(38 45% 96%)",
          border: `3px solid ${INK}`,
          padding: "6px 0 2px",
          position: "relative",
        }}>
          <AppleSvg progress={progress} warning={warning && phase === "peeling"} />
          <div style={{
            position: "absolute", top: 6, left: 8,
            fontSize: 10, color: "hsl(0 55% 40%)",
          }}>
            껍질 {Math.round(progress * 1.1)}cm
          </div>
        </div>

        {/* ── 칼 깊이 게이지 ── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8, color: "hsl(30 20% 45%)", marginBottom: 3 }}>
            칼 깊이 — 초록 구간을 유지하세요
          </div>
          <div
            role="meter"
            aria-label="칼 깊이"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(depth)}
            style={{
              position: "relative", height: 26,
              background: "hsl(30 18% 78%)",
              border: `3px solid ${INK}`,
              overflow: "hidden",
            }}
          >
            {/* 적당한 깊이 */}
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${band.lo}%`, width: `${Math.max(0, band.hi - band.lo)}%`,
              background: warning && phase === "peeling" ? "hsl(45 65% 62%)" : "hsl(140 45% 58%)",
              transition: "background 0.12s",
            }} />
            {/* 칼 */}
            <div style={{
              position: "absolute", top: -2, bottom: -2,
              left: `${depth}%`, width: 5, marginLeft: -2.5,
              background: warning && phase === "peeling" ? "hsl(0 65% 45%)" : INK,
            }} />
          </div>
        </div>

        {/* ── 아래 ── */}
        {phase === "done" && result ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "hsl(30 35% 22%)" }}>
              {result.grade === "perfect" ? "✨ " : ""}{GRADE_TEXT[result.grade].title}
            </div>
            <div style={{ fontSize: 9, color: "hsl(30 20% 45%)", marginTop: 3, lineHeight: 1.6 }}>
              {GRADE_TEXT[result.grade].sub}
              {result.grade !== "fail" && <><br />손에 {RESULT_ITEM[result.grade]?.label}가 들렸습니다.</>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <Btn onClick={onClose} tone="main">나가기</Btn>
            </div>
          </div>
        ) : (
          <>
            <button
              onPointerDown={(e) => { e.preventDefault(); press(); }}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              style={{
                width: "100%", marginTop: 10,
                padding: "13px 0",
                background: phase === "peeling" ? "hsl(0 45% 42%)" : "hsl(25 70% 48%)",
                color: "hsl(38 60% 96%)",
                border: `3px solid ${INK}`,
                boxShadow: "3px 3px 0 rgba(0,0,0,0.35)",
                fontFamily: "'DotGothic16', monospace", fontSize: 12,
                cursor: "pointer",
                touchAction: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {phase === "ready"
                ? "누르고 있으면 깎입니다"
                : progress === 0 ? "칼을 초록 구간에 맞추세요" : "깎는 중… (떼면 칼이 빠진다)"}
            </button>
            <div style={{ fontSize: 8, color: "hsl(30 20% 50%)", marginTop: 5, textAlign: "center", lineHeight: 1.6 }}>
              누르면 칼이 깊이 들어가고, 떼면 빠집니다.<br />
              초록 구간을 벗어나면 껍질이 끊깁니다. (스페이스바도 됩니다)
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: "main" | "sub" }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "9px 0",
      background: tone === "main" ? "hsl(25 70% 48%)" : "hsl(30 15% 72%)",
      color: tone === "main" ? "hsl(38 60% 96%)" : "hsl(30 25% 25%)",
      border: `3px solid ${INK}`,
      boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
      fontFamily: "'DotGothic16', monospace", fontSize: 11,
      cursor: "pointer", touchAction: "manipulation",
    }}>{children}</button>
  );
}

/* ─── 사과 + 껍질 ────────────────────────────────────────── */
const CX = 108, CY = 74, R = 52;

function AppleSvg({ progress, warning }: { progress: number; warning: boolean }) {
  // 껍질이 남아 있는 각도 — 깎을수록 줄어든다
  const peeled = (progress / 100) * 360;

  // 껍질 리본 — 사과 오른쪽에 또아리를 틀며 쌓인다.
  // 반지름 증가폭을 한 바퀴당 선 굵기보다 크게 잡아야 겹쳐서 낙서처럼 안 보인다.
  const pts: string[] = [];
  const n = Math.floor((progress / 100) * 46);
  for (let i = 0; i <= n; i++) {
    const a = i * 0.42;
    const rr = 7 + i * 0.92;
    pts.push(`${(236 + rr * Math.cos(a)).toFixed(1)},${(76 + rr * Math.sin(a) * 0.66).toFixed(1)}`);
  }

  return (
    <svg viewBox="0 0 300 150" width="100%" style={{ display: "block", imageRendering: "pixelated" }}>
      {/* 과육 */}
      <circle cx={CX} cy={CY} r={R} fill="#f3e6c4" stroke={INK} strokeWidth="3" />
      {/* 남은 껍질 — 깎인 만큼 열린다 */}
      {progress < 99.5 && (
        <path
          d={annulus(CX, CY, R, R - 9, -90 + peeled, 270)}
          fill={warning ? "#e05a4a" : "#c9342b"}
          stroke={INK}
          strokeWidth="2.5"
        />
      )}
      {/* 씨방 */}
      <ellipse cx={CX} cy={CY + 4} rx="8" ry="11" fill="#e6d3a8" stroke="#c9b489" strokeWidth="1.5" />
      <circle cx={CX - 3} cy={CY + 1} r="2" fill="#5a3a1a" />
      <circle cx={CX + 3} cy={CY + 7} r="2" fill="#5a3a1a" />
      {/* 꼭지 */}
      <rect x={CX - 2} y={CY - R - 9} width="4" height="10" fill="#5a3a1a" stroke={INK} strokeWidth="1.5" />
      <path d={`M${CX + 2},${CY - R - 6} Q${CX + 14},${CY - R - 13} ${CX + 12},${CY - R - 3} Q${CX + 6},${CY - R - 2} ${CX + 2},${CY - R - 6} Z`}
        fill="#3e7a34" stroke={INK} strokeWidth="1.5" />

      {/* 칼 — 사과 오른쪽에 붙어 있다 */}
      <g transform={`translate(${CX + R - 4}, ${CY - 22}) rotate(14)`}>
        <rect x="0" y="0" width="30" height="7" fill="#d8dde2" stroke={INK} strokeWidth="2" />
        <rect x="30" y="1" width="16" height="5" rx="1" fill="#6b4a2a" stroke={INK} strokeWidth="2" />
      </g>

      {/* 껍질 리본 */}
      {n > 1 && (
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="#c9342b"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      )}
    </svg>
  );
}

/** 도넛 조각 path — 남은 껍질을 그린다 */
function annulus(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const sweep = ((a1 - a0) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  const p = (r: number, a: number) => `${(cx + r * Math.cos(rad(a))).toFixed(2)},${(cy + r * Math.sin(rad(a))).toFixed(2)}`;
  return [
    `M ${p(rOut, a0)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p(rOut, a1)}`,
    `L ${p(rIn, a1)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p(rIn, a0)}`,
    "Z",
  ].join(" ");
}
