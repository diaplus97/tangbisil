/**
 * MicrowaveStation — 전자레인지 + 냉동고
 *
 * 데스크탑: 만두를 드래그해서 레인지에 드롭 / 모바일: 만두 탭 → 레인지 탭
 * 창 너머로 턴테이블 위 만두가 돌아가고, 타이머가 줄어들고,
 * 완료되면 문이 벌컥 열리며 김이 난다.
 */
import { useState, useCallback, useRef } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

type MwState = "idle" | "heating" | "done";
const HEAT_MS = 8000;

export default function MicrowaveStation({ compact }: { compact: boolean }) {
  const { sendMessage, myCup } = useBreakRoom();
  const locked = !myCup;

  const [mwState, setMwState]   = useState<MwState>("idle");
  const [heatPct, setHeatPct]   = useState(0);
  const [selected, setSelected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [popAnim, setPopAnim]   = useState(false);
  const rafRef = useRef<number | null>(null);

  const startHeating = useCallback(() => {
    if (locked || mwState !== "idle") return;
    setSelected(false);
    setPopAnim(true);
    setTimeout(() => setPopAnim(false), 600);
    setMwState("heating");
    setHeatPct(0);
    sound.play("hum");
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / HEAT_MS) * 100);
      setHeatPct(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setMwState("done");
        sound.play("ding");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [locked, mwState]);

  const takeOut = useCallback(() => {
    if (mwState !== "done") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    sendMessage("냉동만두 꺼냄 🥟 후후~ 식혀야지");
    sound.play("pop");
    setMwState("idle");
    setHeatPct(0);
  }, [mwState, sendMessage]);

  const handleMicrowaveClick = () => {
    if (mwState === "done") { takeOut(); return; }
    if (mwState === "idle" && selected) { startHeating(); return; }
  };

  const mwTitle =
    locked ? "커피를 먼저 내려주세요"
    : mwState === "done" ? "문이 열렸어요 — 꺼내기!"
    : mwState === "heating" ? "가열 중..."
    : selected ? "탭해서 투입!"
    : "만두를 드래그해서 넣어주세요";

  const scale = compact ? 0.68 : 1;

  return (
    <div style={{
      position: "absolute", top: compact ? 6 : 10, left: compact ? 4 : 8,
      zIndex: 3,
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: compact ? 3 : 7 }}>
      {/* 냉동고 + 만두 */}
      <button
        draggable={!locked && mwState === "idle"}
        onDragStart={(e) => {
          if (locked || mwState !== "idle") { e.preventDefault(); return; }
          e.dataTransfer.setData("text/plain", "mandu");
        }}
        onClick={() => {
          if (locked || mwState !== "idle") return;
          setSelected((s) => !s);
        }}
        disabled={locked || mwState !== "idle"}
        title={locked ? "커피를 먼저 내려주세요" : mwState !== "idle" ? "가열 중..." : compact ? "만두 탭 → 레인지 탭" : "만두를 레인지로 드래그"}
        style={{
          background: "none", border: "none", padding: 0,
          cursor: locked || mwState !== "idle" ? "not-allowed" : "grab",
          filter: selected ? "drop-shadow(0 0 6px rgba(255,200,40,0.85))" : "none",
          opacity: locked ? 0.55 : 1,
          touchAction: "manipulation",
          transition: "filter 0.15s",
          lineHeight: 0,
        }}
      >
        <FreezerSvg
          w={Math.round(38 * scale)}
          manduVisible={mwState === "idle"}
          popAnim={popAnim}
          selected={selected}
        />
      </button>

      {/* 이동 화살표 */}
      <span style={{
        fontSize: compact ? 8 : 10, color: "hsl(30 25% 50%)", marginBottom: compact ? 8 : 12,
        opacity: selected || mwState !== "idle" ? 1 : 0.3, transition: "opacity 0.2s",
      }}>→</span>

      {/* 전자레인지 본체 */}
      <div
        onDragOver={(e) => { if (mwState === "idle" && !locked) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.getData("text/plain") === "mandu") startHeating();
        }}
        onClick={handleMicrowaveClick}
        title={mwTitle}
        style={{
          position: "relative",
          cursor: mwState === "done" || (mwState === "idle" && selected) ? "pointer" : dragOver ? "copy" : "default",
          filter: dragOver ? "drop-shadow(0 0 6px rgba(120,220,120,0.8))"
            : selected && mwState === "idle" ? "drop-shadow(0 0 5px rgba(255,200,40,0.55))" : "none",
          transition: "filter 0.15s",
          lineHeight: 0,
        }}
      >
        {/* 완료 시 김 */}
        {mwState === "done" && (
          <div style={{
            position: "absolute", top: -14, left: "28%",
            display: "flex", gap: 5, pointerEvents: "none", zIndex: 2,
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`steam${i > 0 ? `-${i + 1}` : ""}`}
                style={{ width: 3, height: 10, background: "rgba(230,230,230,0.75)", borderRadius: 2 }} />
            ))}
          </div>
        )}
        <MicrowaveSvg
          w={Math.round(136 * scale)}
          state={mwState}
          heatPct={heatPct}
        />
      </div>
      </div>

      {/* 선반 — 벽에 떠 있지 않게 받쳐준다 */}
      <div style={{
        height: compact ? 5 : 8,
        background: "hsl(28 32% 54%)",
        borderTop: `${compact ? 2 : 3}px solid hsl(30 25% 18%)`,
        borderBottom: `${compact ? 2 : 3}px solid hsl(30 25% 18%)`,
        marginTop: -1,
      }} />
      {/* 선반 받침 브래킷 */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: compact ? "0 6px" : "0 12px" }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            width: compact ? 3 : 5,
            height: compact ? 5 : 9,
            background: "hsl(30 22% 34%)",
            borderLeft: "2px solid hsl(30 25% 18%)",
            borderRight: "2px solid hsl(30 25% 18%)",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ─── 냉동고 SVG ─────────────────────────────────────────── */
function FreezerSvg({ w, manduVisible, popAnim, selected }: {
  w: number; manduVisible: boolean; popAnim: boolean; selected: boolean;
}) {
  return (
    <svg width={w} height={Math.round(w * 46 / 38)} viewBox="0 0 38 46" style={{ imageRendering: "pixelated", display: "block", overflow: "visible" }}>
      {/* 본체 */}
      <rect x="2" y="2" width="34" height="42" rx="2" fill="#e8f0f6" stroke="#22303a" strokeWidth="2.5" />
      {/* 상단 냉동칸 밴드 */}
      <rect x="2" y="2" width="34" height="11" rx="2" fill="#4a7ab8" stroke="#22303a" strokeWidth="2.5" />
      <text x="19" y="11" textAnchor="middle" fontSize="7" fill="#dceafc">❄</text>
      {/* 문 손잡이 */}
      <rect x="29" y="17" width="3" height="10" rx="1" fill="#8aa0b0" />
      {/* 성에 */}
      <rect x="6" y="17" width="5" height="2" fill="#c8dcec" />
      <rect x="8" y="34" width="6" height="2" fill="#c8dcec" />
      {/* 만두 (문 앞에 슬쩍) */}
      {manduVisible && (
        <text x="17" y="33" textAnchor="middle" fontSize="13"
          style={{
            transformOrigin: "17px 30px",
            transform: popAnim ? "translateX(12px) scale(0.4)" : selected ? "scale(1.12)" : "none",
            opacity: popAnim ? 0 : 1,
            transition: popAnim ? "all 0.5s ease-in" : "transform 0.15s",
          }}>🥟</text>
      )}
      {/* 라벨 */}
      <text x="19" y="42" textAnchor="middle" fontSize="4.5" fill="#5a7080" fontFamily="'DotGothic16', monospace">냉동만두</text>
    </svg>
  );
}

/* ─── 전자레인지 SVG ─────────────────────────────────────── */
function MicrowaveSvg({ w, state, heatPct }: { w: number; state: MwState; heatPct: number }) {
  const remainSec = Math.max(0, Math.ceil(8 - (heatPct / 100) * 8));
  const display =
    state === "heating" ? `0:0${remainSec}` :
    state === "done" ? "땡!" : "--:--";

  return (
    <svg width={w} height={Math.round(w * 68 / 136)} viewBox="0 0 136 68" style={{ imageRendering: "pixelated", display: "block", overflow: "visible" }}>
      {/* 발 */}
      <rect x="10" y="64" width="12" height="3" fill="#2a1a0a" />
      <rect x="114" y="64" width="12" height="3" fill="#2a1a0a" />
      {/* 본체 */}
      <rect x="2" y="2" width="132" height="62" rx="4" fill="#d5cec2" stroke="#2a1a0a" strokeWidth="3" />

      {/* 내부 캐비티 (문 뒤) — 가열 중엔 조명이 켜진다 */}
      <rect x="8" y="10" width="84" height="46" fill={state === "heating" ? "#59401e" : "#181310"} />
      {/* 가열 조명 */}
      {state === "heating" && (
        <rect x="8" y="10" width="84" height="46" fill="#ffb830">
          <animate attributeName="opacity" values="0.30;0.55;0.30" dur="1s" repeatCount="indefinite" />
        </rect>
      )}
      {/* 턴테이블 */}
      <ellipse cx="50" cy="49" rx="28" ry="5" fill="#3a332c" stroke="#241c14" strokeWidth="1.5" />
      {/* 만두 */}
      {(state === "heating" || state === "done") && (
        <g>
          {state === "heating" && (
            <animateTransform attributeName="transform" type="rotate"
              values="-5 50 46; 5 50 46; -5 50 46" dur="1.1s" repeatCount="indefinite" />
          )}
          <text x="50" y="47" textAnchor="middle" fontSize="15">🥟</text>
        </g>
      )}

      {/* 문 — 완료 시 힌지 기준으로 벌컥 */}
      <g style={{
        transform: state === "done" ? "rotate(-58deg)" : "none",
        transformOrigin: "9px 33px",
        transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}>
        {/* 문 프레임 — 창 부분이 뚫려 있어 내부가 실제로 비쳐 보인다 */}
        <rect x="8" y="10" width="6" height="46" fill="#494952" />
        <rect x="78" y="10" width="14" height="46" fill="#494952" />
        <rect x="8" y="10" width="84" height="5" fill="#494952" />
        <rect x="8" y="51" width="84" height="5" fill="#494952" />
        <rect x="8" y="10" width="84" height="46" fill="none" stroke="#241c14" strokeWidth="2.5" />
        {/* 창 유리 틴트 (가열 중엔 거의 투명) */}
        <rect x="14" y="15" width="64" height="36" rx="2"
          fill={state === "heating" ? "rgba(20,12,4,0.15)" : "rgba(8,8,14,0.45)"}
          stroke="#241c14" strokeWidth="2" />
        {/* 창 메쉬 */}
        {[20, 30, 40, 50, 60, 70].map((x) => (
          <rect key={x} x={x} y="18" width="1.5" height="30" fill="rgba(255,255,255,0.05)" />
        ))}
        {/* 손잡이 */}
        <rect x="84" y="16" width="5" height="34" rx="1" fill="#241c14" />
      </g>

      {/* 컨트롤 패널 */}
      <rect x="96" y="8" width="34" height="52" rx="2" fill="#b8b0a2" stroke="#2a1a0a" strokeWidth="2" />
      {/* 디스플레이 */}
      <rect x="100" y="12" width="26" height="13" rx="1" fill="#081008" stroke="#241c14" strokeWidth="1.5" />
      <text x="113" y="21.5" textAnchor="middle" fontSize="7.5" fill={state === "done" ? "#ffcc44" : "#44ff88"} fontFamily="monospace">
        {display}
        {state === "done" && <animate attributeName="opacity" values="1;0.25;1" dur="0.7s" repeatCount="indefinite" />}
      </text>
      {/* 버튼들 */}
      {[[100, 30], [114, 30], [100, 39], [114, 39]].map(([bx, by], i) => (
        <rect key={i} x={bx} y={by} width="12" height="6" rx="1" fill="#948c7c" stroke="#6a6254" strokeWidth="1" />
      ))}
      {/* 시작 버튼 */}
      <rect x="100" y="49" width="26" height="7" rx="1" fill={state === "heating" ? "#e07040" : "#c05030"} stroke="#7a2a10" strokeWidth="1" />
      <text x="113" y="54.5" textAnchor="middle" fontSize="4.5" fill="#ffe0d0" fontFamily="'DotGothic16', monospace">시작</text>
    </svg>
  );
}
