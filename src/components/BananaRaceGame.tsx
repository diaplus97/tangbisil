/**
 * BananaRaceGame — 탕비실 복도 레이싱
 *
 * 사과깎기는 "누르고 있기"(정밀 유지), 오렌지는 "긋기"(반사신경).
 * 세 번째가 또 같은 근육을 쓰면 재탕이라, 이쪽은 "계속 피하기" 로 잡았다.
 *
 * 카트는 내 컵이다. 방에서 내 정체성이 컵이니까 그대로 몰고 나간다 —
 * 닉네임 색까지 그대로 따라온다.
 *
 * 밟으면 죽는 게 아니라 미끄러진다. 그게 마리오카트의 그 느낌이고,
 * 회복 가능해야 한 판이 길어진다. 세 번 미끄러지면 끝.
 *
 * ⚠️ 이 오버레이는 반드시 createPortal 로 document.body 에 붙여야 한다
 * (OrangeNinjaGame 주석 참고 — 방이 scale 돼서 fixed 가 갇힌다).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const INK = "hsl(30 25% 16%)";
const BEST_KEY = "tangbirsil_race_best";

/* ── 놀이판 ────────────────────────────────────────────────── */
const VB_W = 300;
const VB_H = 420;
/** 컵이 서 있는 높이 (아래에서부터) */
const CUP_Y = VB_H - 58;
const CUP_R = 17;

/* ── 난이도 ────────────────────────────────────────────────
 * scripts/tune-race.mjs 로 굴려서 맞췄다. 두 번 갈아엎었다:
 *
 * 1) 껍질을 흩뿌렸더니 복도가 넓어 늘 빈 곳이 있었다 — 아무리 빨라도
 *    안 어려웠다 (평균 1200m). 그래서 4칸 중 몇 칸을 막는 "줄" 로 바꿨다.
 * 2) 속도를 계속 올리면 어느 순간 물리적으로 못 피하게 되는데, 그러면
 *    실력과 무관하게 다 같은 데서 죽는다. 상한을 낮춰 항상 풀 수 있게
 *    두고, 실수로만 죽게 했다 — 엔드리스 러너는 그래야 한다.
 *
 * 지금 값: 실수 잦은 사람 기준 중앙값 200m / 한 판 15초. 잘하면 상한 없음. */
const SPEED_START = 165;   // px/s
const SPEED_MAX = 400;     // 이 위로 올리면 완벽하게 해도 못 피한다
const SPEED_RAMP = 10;     // 초당 증가

/** 줄 간격(초) — 이게 좁아지는 게 난이도의 절반 */
const ROW_START = 0.86;
const ROW_MIN = 0.38;
const ROW_RAMP = 0.024;

/** 4칸 중 2칸 / 3칸을 막기 시작하는 시각(초). 3칸이 최대 — 길은 늘 있어야 한다 */
const BLOCK2_AT = 8;
const BLOCK3_AT = 20;
const LANES = 4;

/** 미끄러지는 시간 — 이 동안은 조작이 안 먹고 옆으로 밀린다 */
const SLIP_SEC = 0.85;
const SLIP_PUSH = 118;     // px/s 옆으로 밀리는 속도
const LIVES = 3;
/** 미끄러진 직후 잠깐은 무적 — 같은 껍질에 두 번 걸리지 않게 */
const MERCY_SEC = 1.1;

/** 각설탕 — 먹으면 보너스. 껍질만 있으면 화면이 심심하다 */
const SUGAR_P = 0.16;

const CUP_SPEED = 260;     // 손가락을 따라가는 최고 속도 (px/s)
const LANE_PAD = 26;       // 복도 벽에서 이만큼 안쪽까지만
const PX_PER_M = 20;       // 이만큼 지나면 1m

/** 이 거리를 넘으면 껍질까지 다 치운 걸로 친다 (시뮬 중앙값 200m 위) */
const CLEAN_AT = 220;

const MAX_OBJ = 24;

type ObjKind = "peel" | "sugar";
type Obj = { id: number; kind: ObjKind; x: number; y: number; spin: number; hit: boolean };

type Phase = "ready" | "play" | "over";

/** 기록에 따라 손에 남는 것 — 못 치웠으면 껍질이 내 손에 남는다 */
function resultItem(meters: number) {
  return meters >= CLEAN_AT
    ? null                                                       // 깔끔하게 처리함
    : { id: "banana-peel", emoji: "🍌", label: "바나나 껍질" };
}

export default function BananaRaceGame({ onClose }: { onClose: () => void }) {
  const { pickUp, sendMessage, myCup, nickname } = useBreakRoom();
  const cupColor = myCup?.color ?? "#c0392b";
  const shortNick = (myCup?.nickname ?? nickname).replace("Anonymous", "A");

  const [phase, setPhase] = useState<Phase>("ready");
  const [meters, setMeters] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [sugar, setSugar] = useState(0);
  const [slipping, setSlipping] = useState(false);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { return 0; }
  });

  // 렌더용 상태 (그리기 전용 — 로직은 전부 ref 에서 돈다)
  const [objs, setObjs] = useState<Obj[]>([]);
  const [cupX, setCupX] = useState(VB_W / 2);
  const [tilt, setTilt] = useState(0);

  const phaseRef = useRef<Phase>("ready");
  const rafRef = useRef<number | null>(null);
  const objsRef = useRef<Obj[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const gRef = useRef({
    t: 0, dist: 0, speed: SPEED_START, spawnAt: 0.5,
    x: VB_W / 2, targetX: VB_W / 2, vx: 0,
    lives: LIVES, sugar: 0, slipUntil: 0, slipDir: 1, mercyUntil: 0,
    lastLane: -1,
  });

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const finish = useCallback(() => {
    stop();
    const g = gRef.current;
    phaseRef.current = "over";
    setPhase("over");
    sound.play("boom");

    const m = Math.floor(g.dist);
    const total = m + g.sugar * 12;
    if (total > best) {
      setBest(total);
      try { localStorage.setItem(BEST_KEY, String(total)); } catch { /* ignore */ }
    }
    const item = resultItem(total);
    if (item) pickUp(item);
    sendMessage(
      item ? `복도에서 바나나 밟고 미끄러짐 🍌 ${total}m`
           : `복도 ${total}m 완주 🏁 껍질도 다 치웠다`,
    );
  }, [best, pickUp, sendMessage, stop]);

  /* ── 조작 — 손가락이 컵을 가리지 않게 판 어디를 끌어도 따라온다 ── */
  const aim = useCallback((clientX: number) => {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * VB_W;
    gRef.current.targetX = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD, x));
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== "play") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    aim(e.clientX);
  }, [aim]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== "play") return;
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    aim(e.clientX);
  }, [aim]);

  /* ── 루프 ─────────────────────────────────────────────── */
  const start = useCallback(() => {
    objsRef.current = [];
    idRef.current = 0;
    gRef.current = {
      t: 0, dist: 0, speed: SPEED_START, spawnAt: 0.6,
      x: VB_W / 2, targetX: VB_W / 2, vx: 0,
      lives: LIVES, sugar: 0, slipUntil: 0, slipDir: 1, mercyUntil: 0,
      lastLane: -1,
    };
    setMeters(0); setLives(LIVES); setSugar(0); setSlipping(false);
    setObjs([]); setCupX(VB_W / 2); setTilt(0);
    phaseRef.current = "play";
    setPhase("play");
    sound.play("brew");

    let last = performance.now();
    const loop = (now: number) => {
      // 탭 전환 후 복귀 시 한 프레임에 몰아서 진행되는 걸 막는다
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const g = gRef.current;
      g.t += dt;
      g.speed = Math.min(SPEED_MAX, SPEED_START + g.t * SPEED_RAMP);
      g.dist += (g.speed * dt) / PX_PER_M;

      /* 컵 이동 */
      const slip = g.t < g.slipUntil;
      if (slip) {
        // 미끄러지는 동안엔 조작이 안 먹고 옆으로 밀린다
        g.x += g.slipDir * SLIP_PUSH * dt;
        g.x = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD, g.x));
        if (g.x <= LANE_PAD || g.x >= VB_W - LANE_PAD) g.slipDir *= -1;
      } else {
        const d = g.targetX - g.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), CUP_SPEED * dt);
        g.x += step;
        g.vx = step / Math.max(dt, 0.001);
      }

      /* 장애물 — 줄 단위로 깐다.
         흩뿌리면 복도가 넓어서 늘 빈 곳이 있고, 그러면 아무리 빨라도
         안 어렵다 (시뮬에서 평균 1200m 나왔다). 4칸 중 몇 칸을 막느냐가
         난이도고, 3칸이 최대 — 길이 아예 없으면 게임이 아니다. */
      g.spawnAt -= dt;
      if (g.spawnAt <= 0 && objsRef.current.length < MAX_OBJ) {
        g.spawnAt = Math.max(ROW_MIN, ROW_START - g.t * ROW_RAMP);
        const block = g.t >= BLOCK3_AT ? 3 : g.t >= BLOCK2_AT ? 2 : 1;
        const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        const laneW = (VB_W - LANE_PAD * 2) / LANES;
        const at = (i: number) => LANE_PAD + laneW * lanes[i] + laneW / 2;
        for (let i = 0; i < block; i++) {
          objsRef.current.push({
            id: idRef.current++, kind: "peel",
            x: at(i), y: -30, spin: Math.random() * 360, hit: false,
          });
        }
        // 남은 칸 하나에 각설탕 — 빈 곳으로 유도하는 미끼도 된다
        if (Math.random() < SUGAR_P && block < LANES) {
          objsRef.current.push({
            id: idRef.current++, kind: "sugar",
            x: at(block), y: -30, spin: 0, hit: false,
          });
        }
      }

      /* 장애물 이동 + 충돌 */
      const mercy = g.t < g.mercyUntil;
      for (const o of objsRef.current) {
        o.y += g.speed * dt;
        if (o.hit) continue;
        const dx = o.x - g.x;
        const dy = o.y - CUP_Y;
        if (Math.abs(dx) < CUP_R + 11 && Math.abs(dy) < CUP_R + 8) {
          if (o.kind === "sugar") {
            o.hit = true;
            g.sugar += 1;
            setSugar(g.sugar);
            sound.play("blip");
          } else if (!mercy && !slip) {
            o.hit = true;
            g.lives -= 1;
            setLives(g.lives);
            g.slipUntil = g.t + SLIP_SEC;
            g.mercyUntil = g.t + SLIP_SEC + MERCY_SEC;
            g.slipDir = g.x < VB_W / 2 ? 1 : -1;
            setSlipping(true);
            sound.play("splat");
            if (g.lives <= 0) { finish(); return; }
          }
        }
      }
      if (!slip && slipping) setSlipping(false);
      objsRef.current = objsRef.current.filter((o) => o.y < VB_H + 40);

      /* 그리기 */
      setObjs([...objsRef.current]);
      setCupX(g.x);
      setMeters(Math.floor(g.dist));
      setTilt(slip ? (g.t * 900) % 360 : Math.max(-16, Math.min(16, -g.vx * 0.055)));

      if (phaseRef.current === "play") rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [finish, slipping]);

  const total = meters + sugar * 12;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 95,
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
          <span style={{ fontSize: 13, color: "hsl(30 30% 22%)" }}>🏁 복도 레이싱</span>
          <span style={{ fontSize: 10, color: "hsl(0 55% 40%)" }}>
            {"♥".repeat(Math.max(0, lives))}
            <span style={{ opacity: 0.25 }}>{"♥".repeat(LIVES - Math.max(0, lives))}</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "hsl(30 25% 30%)" }}>{total}m</span>
          <span style={{ fontSize: 9, color: "hsl(30 20% 48%)" }}>최고 {best}</span>
          {phase !== "play" && (
            <button onClick={onClose} aria-label="닫기" style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "hsl(30 20% 40%)", padding: "0 2px", lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* 복도 */}
        <div
          ref={boardRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          style={{
            position: "relative",
            touchAction: "none",
            WebkitTapHighlightColor: "transparent",
            cursor: phase === "play" ? "none" : "default",
            lineHeight: 0,
          }}
        >
          <Corridor
            objs={objs} cupX={cupX} tilt={tilt}
            cupColor={cupColor} nick={shortNick}
            dist={meters} slipping={slipping}
          />

          {phase !== "play" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
              background: "rgba(28,20,12,0.72)", padding: 16, textAlign: "center",
            }}>
              {phase === "ready" ? (
                <>
                  <div style={{ fontSize: 15, color: "hsl(45 80% 82%)" }}>복도에 껍질이 깔렸다</div>
                  <div style={{ fontSize: 11, color: "hsl(38 30% 78%)", lineHeight: 1.8 }}>
                    화면을 <b>좌우로 끌어</b> 컵을 몹니다<br />
                    🍌 밟으면 미끄러져요 (3번이면 끝)<br />
                    🍬 각설탕은 12m 보너스
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 17, color: "hsl(45 80% 82%)" }}>{total}m</div>
                  <div style={{ fontSize: 11, color: "hsl(38 30% 78%)", lineHeight: 1.8 }}>
                    {total >= CLEAN_AT
                      ? "복도를 다 지났다 — 껍질도 치웠어요 🏁"
                      : "바나나 껍질이 손에 남았어요 🍌"}
                    {total > 0 && total >= best && <><br />최고 기록!</>}
                  </div>
                </>
              )}
              <button
                onClick={start}
                style={{
                  marginTop: 2, padding: "11px 20px",
                  fontFamily: "'DotGothic16', monospace", fontSize: 14,
                  background: "hsl(45 80% 55%)", color: "hsl(30 40% 18%)",
                  border: `3px solid ${INK}`, boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
                  cursor: "pointer", touchAction: "manipulation",
                }}
              >
                {phase === "ready" ? "출발" : "다시"}
              </button>
              {phase === "over" && (
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px 16px",
                    fontFamily: "'DotGothic16', monospace", fontSize: 12,
                    background: "hsl(30 14% 74%)", color: "hsl(30 25% 24%)",
                    border: `3px solid ${INK}`, cursor: "pointer", touchAction: "manipulation",
                  }}
                >
                  나가기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 복도 그림 ──────────────────────────────────────────── */

function Corridor({ objs, cupX, tilt, cupColor, nick, dist, slipping }: {
  objs: Obj[]; cupX: number; tilt: number;
  cupColor: string; nick: string; dist: number; slipping: boolean;
}) {
  // 바닥 타일이 흘러가야 달리는 느낌이 난다
  const scroll = (dist * PX_PER_M) % 40;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
    >
      {/* 바닥 */}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="hsl(35 22% 72%)" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={i * 40 - 40 + scroll} width={VB_W} height="2" fill="hsl(35 18% 62%)" />
      ))}
      {/* 벽 */}
      <rect x="0" y="0" width={LANE_PAD - 8} height={VB_H} fill="hsl(30 24% 48%)" />
      <rect x={VB_W - LANE_PAD + 8} y="0" width={LANE_PAD - 8} height={VB_H} fill="hsl(30 24% 48%)" />
      <rect x={LANE_PAD - 8} y="0" width="3" height={VB_H} fill="hsl(30 28% 32%)" />
      <rect x={VB_W - LANE_PAD + 5} y="0" width="3" height={VB_H} fill="hsl(30 28% 32%)" />

      {/* 장애물 */}
      {objs.map((o) => (
        o.hit ? null : o.kind === "sugar" ? (
          <g key={o.id} transform={`translate(${o.x} ${o.y})`}>
            <rect x="-8" y="-6" width="16" height="12" rx="2"
              fill="hsl(45 30% 96%)" stroke={INK} strokeWidth="2" />
            <rect x="-4" y="-3" width="8" height="2" fill="hsl(45 20% 82%)" />
          </g>
        ) : (
          <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.spin})`}>
            {/* 바나나 껍질 — 세 갈래로 벌어진 모양 */}
            <path d="M-11,3 Q-3,-9 9,-4 Q2,4 -11,3 Z" fill="hsl(48 85% 62%)" stroke={INK} strokeWidth="2" />
            <path d="M-9,4 Q0,10 11,3 Q1,3 -9,4 Z" fill="hsl(46 70% 52%)" stroke={INK} strokeWidth="2" />
            <path d="M-12,1 Q-6,-2 -2,1" fill="none" stroke="hsl(40 40% 38%)" strokeWidth="1.6" />
          </g>
        )
      ))}

      {/* 내 컵 — 방에서 쓰는 그 컵이 그대로 카트가 된다 */}
      <g transform={`translate(${cupX} ${CUP_Y}) rotate(${tilt})`}>
        {slipping && (
          <circle cx="0" cy="0" r="24" fill="none" stroke="hsl(45 90% 62%)" strokeWidth="3" opacity="0.75">
            <animate attributeName="r" values="20;27;20" dur="0.4s" repeatCount="indefinite" />
          </circle>
        )}
        <rect x="-14" y="-15" width="28" height="30" rx="2" fill={cupColor} stroke={INK} strokeWidth="3" />
        <rect x="-14" y="-15" width="28" height="7" fill="rgba(255,255,255,0.32)" />
        {/* 손잡이 */}
        <path d="M14,-6 q9,0 9,8 q0,8 -9,8" fill="none" stroke={INK} strokeWidth="3" />
        <text x="0" y="6" textAnchor="middle" fontSize="9"
          fontFamily="'DotGothic16', monospace" fill="hsl(38 60% 96%)">
          {nick.slice(0, 4)}
        </text>
      </g>

      {/* 거리 */}
      <text x={VB_W - 12} y="20" textAnchor="end" fontSize="13"
        fontFamily="'DotGothic16', monospace" fill="hsl(30 25% 38%)">
        {dist}m
      </text>
    </svg>
  );
}
