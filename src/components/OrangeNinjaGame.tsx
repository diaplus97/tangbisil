/**
 * OrangeNinjaGame — 오렌지 자르기 (후르츠 닌자)
 *
 * 과일이 아래에서 던져지고, 손가락으로 그으면 잘린다.
 * 사과깎기가 "누르고 있기" 한 버튼이라 이쪽은 "긋기" 로 잡았다 — 조작이 안 겹친다.
 *
 * ⚠️ 이 오버레이는 반드시 createPortal 로 document.body 에 붙여야 한다.
 * 폰에서 방(BreakRoomScene)이 transform: scale(fit) 으로 축소되는데,
 * transform 이 걸린 조상은 position:fixed 의 기준이 되어버린다.
 * scale(1) 도 none 이 아니라서 모든 폰에서 재현되고, overflow:hidden 까지 겹쳐
 * 게임 화면이 방 안에 갇힌 채 잘린다. 데스크탑에서는 과일 바구니가
 * transform 밖에 있어 멀쩡하므로 — 데스크탑 테스트로는 절대 안 잡힌다.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useBreakRoom, type HeldItem } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const INK = "hsl(30 25% 16%)";
const BEST_KEY = "tangbirsil_ninja_best";

/* ── 놀이판 (SVG viewBox 단위) ─────────────────────────────── */
const VB_W = 300;
const VB_H = 400;
const GRAVITY = 900;

/* ── 난이도 ────────────────────────────────────────────────
 * 던지는 간격이 점점 짧아지고, 한 번에 여러 개가 올라온다.
 * 목숨 3개 — 과일을 놓치면 하나씩 잃는다. 폭탄은 즉시 종료. */
const SPAWN_START = 1.15;
const SPAWN_MIN = 0.46;
/** 초당 이만큼씩 간격이 줄어든다 */
const SPAWN_RAMP = 0.035;
const LIVES = 3;
/** 폭탄이 섞이기 시작하는 시각(초)과 최대 확률 */
const BOMB_FROM = 6;
const BOMB_MAX_P = 0.22;

/* ── 칼날 ──────────────────────────────────────────────────
 * 탭만으로는 안 잘린다 — 한 스트로크가 이만큼 움직여야 칼이 켜진다 */
const ARM_DIST = 15;
/** 판정 여유. 손가락이 두꺼우니 조금 후하게 */
const BLADE_PAD = 9;
/** 잔상 길이 */
const TRAIL_MAX = 12;

const MAX_OBJ = 14;
const MAX_PARTS = 44;

type Kind = "orange" | "apple" | "lemon" | "bomb";

const FRUIT: Record<Exclude<Kind, "bomb">, { fill: string; inner: string; r: number; pts: number }> = {
  orange: { fill: "#e8880f", inner: "#ffc46b", r: 25, pts: 1 },
  apple:  { fill: "#c9342b", inner: "#f6ead0", r: 23, pts: 1 },
  lemon:  { fill: "#e8c22e", inner: "#fff2b0", r: 21, pts: 2 },
};

type Obj = {
  id: number;
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vrot: number;
  dead: boolean;
};

type Part = {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  color: string;
  life: number;
  half: 0 | 1 | null; // 반쪽 조각이면 좌/우
  rot: number; vrot: number;
};

type Phase = "ready" | "play" | "over";

const RESULT_ITEM = (score: number): HeldItem =>
  score >= 25 ? { id: "orange-plate",  emoji: "🍊", label: "오렌지 접시" }
  : score >= 12 ? { id: "sliced-orange", emoji: "🍊", label: "자른 오렌지" }
  : score >= 4  ? { id: "messy-orange",  emoji: "🍊", label: "엉망으로 썬 오렌지" }
  :               { id: "orange",        emoji: "🍊", label: "오렌지" };

const RESULT_TEXT = (score: number, bombed: boolean) =>
  bombed        ? { title: "폭탄을 갈랐다 💥", sub: "…도마에 뭐가 섞여 있었던 거야" }
  : score >= 25 ? { title: "칼잡이", sub: "이 정도면 회의실에 들고 가도 된다." }
  : score >= 12 ? { title: "그럭저럭 썰었다", sub: "먹을 만하게 나왔다." }
  : score >= 4  ? { title: "엉망이다", sub: "과육이 반은 날아갔다." }
  :               { title: "손도 못 댔다", sub: "오렌지는 그대로 남았다." };

export default function OrangeNinjaGame({ onClose }: { onClose: () => void }) {
  const { pickUp, sendMessage } = useBreakRoom();

  const [phase, setPhase] = useState<Phase>("ready");
  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [combo, setCombo] = useState(0);
  const [bombed, setBombed] = useState(false);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { return 0; }
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const objsRef = useRef<Obj[]>([]);
  const partsRef = useRef<Part[]>([]);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const seqRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");

  const gameRef = useRef({
    t: 0, spawnAt: 0, score: 0, lives: LIVES, combo: 0, comboAt: 0,
  });
  // 한 스트로크 상태 — 첫 손가락만 칼로 인정한다
  const strokeRef = useRef({ id: -1, armed: false, dist: 0, lx: 0, ly: 0, hits: 0 });

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finish = useCallback((byBomb: boolean) => {
    stop();
    const g = gameRef.current;
    phaseRef.current = "over";
    setPhase("over");
    setBombed(byBomb);
    sound.play(byBomb ? "blast" : "fanfare");

    if (g.score > best) {
      setBest(g.score);
      try { localStorage.setItem(BEST_KEY, String(g.score)); } catch { /* ignore */ }
    }
    pickUp(RESULT_ITEM(g.score));
    // 메시지는 한 번만 — 내 컵의 단일 message 필드를 덮어쓰기 때문에
    // 두 번 보내면 앞의 것을 아무도 못 본다
    sendMessage(
      byBomb ? `오렌지 썰다 폭탄 갈랐다 💥 ${g.score}점`
             : `오렌지 ${g.score}조각 썰었다 🍊`,
    );
  }, [best, pickUp, sendMessage, stop]);

  /* ── 루프 ─────────────────────────────────────────────── */
  const start = useCallback(() => {
    objsRef.current = [];
    partsRef.current = [];
    trailRef.current = [];
    gameRef.current = { t: 0, spawnAt: 0.4, score: 0, lives: LIVES, combo: 0, comboAt: 0 };
    strokeRef.current = { id: -1, armed: false, dist: 0, lx: 0, ly: 0, hits: 0 };
    setScore(0); setLives(LIVES); setCombo(0); setBombed(false);
    phaseRef.current = "play";
    setPhase("play");

    let last = performance.now();
    const loop = (now: number) => {
      // 탭 전환 후 복귀 시 한 프레임에 몰아서 진행되는 걸 막는다
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      g.t += dt;

      // 스폰 — 타이머를 안 쓰고 누적 시간으로 처리한다 (정리할 타이머가 0개)
      if (g.t >= g.spawnAt) {
        const gap = Math.max(SPAWN_MIN, SPAWN_START - g.t * SPAWN_RAMP);
        g.spawnAt = g.t + gap;
        const n = g.t > 14 ? (Math.random() < 0.45 ? 2 : 1) : 1;
        for (let i = 0; i < n; i++) {
          if (objsRef.current.length >= MAX_OBJ) break;
          const bombP = g.t < BOMB_FROM ? 0 : Math.min(BOMB_MAX_P, (g.t - BOMB_FROM) * 0.02);
          const kind: Kind = Math.random() < bombP
            ? "bomb"
            : (["orange", "orange", "orange", "apple", "lemon"] as Kind[])[Math.floor(Math.random() * 5)];
          const x = 40 + Math.random() * (VB_W - 80);
          objsRef.current.push({
            id: seqRef.current++,
            kind,
            x, y: VB_H + 30,
            vx: (VB_W / 2 - x) * 0.42 + (Math.random() - 0.5) * 70,
            vy: -(555 + Math.random() * 110),
            rot: Math.random() * 360,
            vrot: (Math.random() - 0.5) * 260,
            dead: false,
          });
        }
      }

      // 물리
      for (const o of objsRef.current) {
        o.vy += GRAVITY * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.vrot * dt;
      }
      for (const p of partsRef.current) {
        p.vy += GRAVITY * 0.8 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt;
      }

      // 화면 아래로 놓친 것
      let lost = 0;
      objsRef.current = objsRef.current.filter((o) => {
        if (o.y < VB_H + 60) return true;
        if (!o.dead && o.kind !== "bomb") lost++;   // 폭탄은 놓쳐도 된다
        return false;
      });
      partsRef.current = partsRef.current.filter((p) => p.life > 0 && p.y < VB_H + 80);
      if (partsRef.current.length > MAX_PARTS) partsRef.current = partsRef.current.slice(-MAX_PARTS);

      if (lost > 0) {
        g.lives -= lost;
        g.combo = 0;
        setLives(Math.max(0, g.lives));
        setCombo(0);
        if (g.lives <= 0) { finish(false); return; }
      }

      // 콤보는 잠깐만 유지된다
      if (g.combo > 0 && g.t - g.comboAt > 1.2) { g.combo = 0; setCombo(0); }

      setTick((n) => (n + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [finish]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* ── 좌표 변환 ────────────────────────────────────────── */
  const toVb = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((clientX - r.left) / r.width) * VB_W, y: ((clientY - r.top) / r.height) * VB_H };
  };

  /** 선분(ax,ay)-(bx,by) 와 원(cx,cy,r) 이 닿는가 */
  const segHits = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) => {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t, py = ay + dy * t;
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  };

  const cut = useCallback((o: Obj) => {
    const g = gameRef.current;
    o.dead = true;

    if (o.kind === "bomb") {
      for (let i = 0; i < 16; i++) {
        partsRef.current.push({
          id: seqRef.current++, x: o.x, y: o.y,
          vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420 - 90,
          r: 3 + Math.random() * 4, color: i % 2 ? "#ffb43c" : "#8a3a1a",
          life: 0.7, half: null, rot: 0, vrot: 0,
        });
      }
      finish(true);
      return;
    }

    const f = FRUIT[o.kind];
    g.combo += 1;
    g.comboAt = g.t;
    // 연속으로 베면 점수가 붙는다
    const gain = f.pts + (g.combo >= 3 ? 1 : 0);
    g.score += gain;
    setScore(g.score);
    setCombo(g.combo);

    // 반쪽 두 개 + 과즙
    for (const side of [0, 1] as const) {
      partsRef.current.push({
        id: seqRef.current++, x: o.x, y: o.y,
        vx: o.vx * 0.4 + (side ? 150 : -150), vy: o.vy * 0.35 - 60,
        r: f.r, color: f.fill, life: 1.1, half: side,
        rot: o.rot, vrot: (side ? 1 : -1) * 200,
      });
    }
    for (let i = 0; i < 6; i++) {
      partsRef.current.push({
        id: seqRef.current++, x: o.x, y: o.y,
        vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260 - 40,
        r: 2 + Math.random() * 3, color: f.inner,
        life: 0.45, half: null, rot: 0, vrot: 0,
      });
    }
    // 프레임마다 부르면 소리가 뭉개진다 — 한 스트로크의 첫 히트만 슥, 그 뒤는 과즙
    if (strokeRef.current.hits === 0) sound.play("slice");
    else sound.play("splat");
    strokeRef.current.hits++;
  }, [finish]);

  /* ── 포인터 ───────────────────────────────────────────── */
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (phaseRef.current === "ready") { start(); }
    if (phaseRef.current !== "play") return;
    // 이미 다른 손가락이 칼을 쥐고 있으면 무시 (멀티터치로 두 궤적이 섞이는 걸 막는다)
    if (strokeRef.current.id !== -1) return;
    const p = toVb(e.clientX, e.clientY);
    if (!p) return;
    strokeRef.current = { id: e.pointerId, armed: false, dist: 0, lx: p.x, ly: p.y, hits: 0 };
    trailRef.current = [p];
  };

  const onMove = (e: React.PointerEvent) => {
    const st = strokeRef.current;
    if (phaseRef.current !== "play" || st.id !== e.pointerId) return;
    const p = toVb(e.clientX, e.clientY);
    if (!p) return;

    const dx = p.x - st.lx, dy = p.y - st.ly;
    const seg = Math.hypot(dx, dy);
    st.dist += seg;
    if (!st.armed && st.dist >= ARM_DIST) st.armed = true;

    trailRef.current.push(p);
    if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();

    if (st.armed && seg > 1) {
      for (const o of objsRef.current) {
        if (o.dead) continue;
        const r = o.kind === "bomb" ? 22 : FRUIT[o.kind].r;
        // 빠르게 낙하하는 물체가 프레임 사이로 빠져나가는 걸 보정한다
        const pad = BLADE_PAD + Math.abs(o.vy) * 0.008;
        if (segHits(st.lx, st.ly, p.x, p.y, o.x, o.y, r + pad)) cut(o);
      }
      objsRef.current = objsRef.current.filter((o) => !o.dead);
    }
    st.lx = p.x; st.ly = p.y;
  };

  const onUp = (e: React.PointerEvent) => {
    if (strokeRef.current.id !== e.pointerId) return;
    strokeRef.current.id = -1;
    strokeRef.current.armed = false;
    trailRef.current = [];
  };

  const result = RESULT_TEXT(score, bombed);
  const trail = trailRef.current;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(20,14,8,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 12,
        fontFamily: "'DotGothic16', monospace",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "play") onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 340,
        maxHeight: "100dvh", boxSizing: "border-box",
        background: "hsl(38 32% 90%)",
        border: `4px solid ${INK}`,
        boxShadow: "6px 6px 0 rgba(0,0,0,0.45)",
        padding: 10,
        userSelect: "none", WebkitUserSelect: "none",
      }}>
        {/* 머리 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "hsl(30 30% 22%)" }}>🔪 오렌지 썰기</span>
          <span style={{ fontSize: 10, color: "hsl(0 55% 40%)" }}>
            {"♥".repeat(Math.max(0, lives))}<span style={{ opacity: 0.25 }}>{"♥".repeat(LIVES - Math.max(0, lives))}</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "hsl(30 25% 30%)" }}>{score}점</span>
          <span style={{ fontSize: 9, color: "hsl(30 20% 48%)" }}>최고 {best}</span>
          {phase !== "play" && (
            <button onClick={onClose} aria-label="닫기" style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "hsl(30 20% 40%)", padding: "0 2px", lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* 놀이판 */}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          style={{
            position: "relative",
            // 더블탭 줌·스크롤이 궤적을 먹지 않게 (viewport 에서 maximum-scale 을 뺐다)
            touchAction: "none",
            WebkitTapHighlightColor: "transparent",
            cursor: "crosshair",
            lineHeight: 0,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            style={{
              display: "block",
              aspectRatio: `${VB_W} / ${VB_H}`,
              background: "linear-gradient(180deg, hsl(200 35% 82%), hsl(38 45% 88%))",
              border: `3px solid ${INK}`,
            }}
          >
            {/* 파편 */}
            {partsRef.current.map((p) => (
              p.half !== null ? (
                <g key={p.id} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`} opacity={Math.min(1, p.life)}>
                  <path
                    d={p.half === 0
                      ? `M0,${-p.r} A${p.r},${p.r} 0 0,0 0,${p.r} Z`
                      : `M0,${-p.r} A${p.r},${p.r} 0 0,1 0,${p.r} Z`}
                    fill={p.color} stroke={INK} strokeWidth="2.5"
                  />
                  <path
                    d={p.half === 0
                      ? `M0,${-p.r * 0.72} A${p.r * 0.72},${p.r * 0.72} 0 0,0 0,${p.r * 0.72} Z`
                      : `M0,${-p.r * 0.72} A${p.r * 0.72},${p.r * 0.72} 0 0,1 0,${p.r * 0.72} Z`}
                    fill="#ffd9a0"
                  />
                </g>
              ) : (
                <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity={Math.min(1, p.life * 1.6)} />
              )
            ))}

            {/* 날아다니는 것들 */}
            {objsRef.current.map((o) => (
              <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rot})`}>
                {o.kind === "bomb" ? <BombSvg /> : <FruitSvg kind={o.kind} />}
              </g>
            ))}

            {/* 칼 궤적 */}
            {trail.length > 1 && (
              <polyline
                points={trail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}

            {/* 콤보 */}
            {combo >= 3 && phase === "play" && (
              <text x={VB_W / 2} y="40" textAnchor="middle" fontSize="20"
                fill="hsl(28 80% 40%)" fontFamily="'DotGothic16', monospace">
                {combo} 연속!
              </text>
            )}
          </svg>

          {/* 시작 안내 */}
          {phase === "ready" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, background: "rgba(20,14,8,0.45)", color: "hsl(38 60% 96%)",
              fontSize: 12, textAlign: "center", lineHeight: 1.9,
            }}>
              화면을 그어서 과일을 자르세요
              <span style={{ fontSize: 9, opacity: 0.85 }}>
                놓치면 ♥ 하나. 폭탄은 자르면 끝.<br />아무 데나 그어서 시작
              </span>
            </div>
          )}
        </div>

        {/* 결과 */}
        {phase === "over" && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "hsl(30 35% 22%)" }}>{result.title}</div>
            <div style={{ fontSize: 9, color: "hsl(30 20% 45%)", marginTop: 3, lineHeight: 1.6 }}>
              {result.sub}<br />
              손에 {RESULT_ITEM(score).label}가 들렸습니다.
            </div>
            <button onClick={onClose} style={{
              width: "100%", marginTop: 8, padding: "9px 0",
              background: "hsl(25 70% 48%)", color: "hsl(38 60% 96%)",
              border: `3px solid ${INK}`, boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
              fontFamily: "'DotGothic16', monospace", fontSize: 11,
              cursor: "pointer", touchAction: "manipulation",
            }}>나가기</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 과일 / 폭탄 ────────────────────────────────────────── */
function FruitSvg({ kind }: { kind: Exclude<Kind, "bomb"> }) {
  const f = FRUIT[kind];
  return (
    <>
      <circle cx="0" cy="0" r={f.r} fill={f.fill} stroke={INK} strokeWidth="3" />
      <ellipse cx={-f.r * 0.3} cy={-f.r * 0.35} rx={f.r * 0.22} ry={f.r * 0.15} fill="rgba(255,255,255,0.4)" />
      {kind === "apple" && (
        <>
          <rect x="-1.5" y={-f.r - 6} width="3" height="7" fill="#5a3a1a" stroke={INK} strokeWidth="1.5" />
          <path d={`M2,${-f.r - 3} Q10,${-f.r - 9} 9,${-f.r + 1} Q4,${-f.r + 2} 2,${-f.r - 3} Z`}
            fill="#3e7a34" stroke={INK} strokeWidth="1.5" />
        </>
      )}
      {kind === "orange" && (
        <path d={`M-3,${-f.r - 2} Q0,${-f.r - 6} 3,${-f.r - 2}`} stroke="#3e7a34" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

/** 폭탄은 이모지로 그리면 플랫폼마다 모양이 달라 과일과 구분이 안 된다 */
function BombSvg() {
  return (
    <>
      <circle cx="0" cy="2" r="20" fill="#2a2a30" stroke={INK} strokeWidth="3" />
      <ellipse cx="-7" cy="-5" rx="5" ry="3.5" fill="rgba(255,255,255,0.22)" />
      <rect x="-4" y="-24" width="8" height="7" rx="1" fill="#4a4a52" stroke={INK} strokeWidth="2" />
      <path d="M0,-24 Q7,-32 13,-28" stroke="#a08050" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle className="blink" cx="14" cy="-28" r="4" fill="#ffb43c" />
    </>
  );
}
