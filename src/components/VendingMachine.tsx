/**
 * VendingMachine — 자판기
 *
 * 유리창 안에 음료가 진열된 픽셀 자판기.
 * 동전 넣기 → 진열대 버튼이 켜짐 → 선택 → 음료가 떨어져 배출구로.
 * idle → ready(8s) → 선택 → dispensing(1.8s) → idle
 */
import { useState } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";
import { buyCigarettes, loadPack, canBuyCigarettes, BUY_PACK_SIZE } from "@/lib/npcMemory";

const VEND_ITEMS = [
  { id: "drink",  emoji: "🥤", label: "음료",     message: "자판기 음료 뽑음 🥤" },
  { id: "candy",  emoji: "🍬", label: "사탕",     message: "사탕 쏙 집어감 🍬" },
  { id: "juice",  emoji: "🍹", label: "생과일주스", message: "생과일주스 꺼내감 🍹" },
];
type VendState = "idle" | "ready" | "dispensing";

// viewBox 기준 좌표 (오버레이 버튼 위치 계산용)
const VB_W = 126;
const VB_H = 172;
const ITEM_XS = [24, 47, 70]; // 1열 아이템 중심 x

export default function VendingMachine({ compact }: { compact: boolean }) {
  const { sendMessage, myCup, pickUp } = useBreakRoom();
  const locked = !myCup;
  const [state, setState] = useState<VendState>("idle");
  const [dropping, setDropping] = useState<{ emoji: string; x: number } | null>(null);
  const [soldOut, setSoldOut] = useState(!canBuyCigarettes(loadPack()));

  const insertCoin = () => {
    if (locked || state !== "idle") return;
    setState("ready");
    sound.play("coin");
    setTimeout(() => setState((s) => s === "ready" ? "idle" : s), 8000);
  };

  const vend = (item: typeof VEND_ITEMS[0], idx: number) => {
    if (state !== "ready" || locked) return;
    setState("dispensing");
    setDropping({ emoji: item.emoji, x: ITEM_XS[idx] });
    sendMessage(item.message);
    // 뽑은 건 손에 들린다 — 흡연실 아저씨한테 건넬 수 있다
    pickUp({ id: item.id, emoji: item.emoji, label: item.label });
    sound.play("drop");
    setTimeout(() => { setState("idle"); setDropping(null); }, 1800);
  };

  /** 담배 한 갑 — 흡연실에서 쓸 개비를 보충한다 */
  const buySmokes = () => {
    if (locked || state !== "idle" || soldOut) return;
    const next = buyCigarettes();
    if (!next) { setSoldOut(true); return; }
    setSoldOut(!canBuyCigarettes(next));
    setState("dispensing");
    setDropping({ emoji: "🚬", x: ITEM_XS[1] });
    sendMessage(`담배 한 갑 뽑음 🚬`);
    sound.play("drop");
    setTimeout(() => { setState("idle"); setDropping(null); }, 1800);
  };

  const isReady = state === "ready";
  const W = compact ? 118 : 126;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: W, lineHeight: 0 }}>
        <VendingSvg w={W} state={state} />

        {/* 아이템 선택 오버레이 버튼 (유리창 1열 위치) */}
        {VEND_ITEMS.map((item, i) => (
          <button
            key={item.id}
            onClick={() => vend(item, i)}
            disabled={!isReady}
            title={isReady ? item.label : locked ? "커피 먼저!" : "동전을 먼저 넣어주세요"}
            style={{
              position: "absolute",
              left: `${((ITEM_XS[i] - 11) / VB_W) * 100}%`,
              top: `${(40 / VB_H) * 100}%`,
              width: `${(22 / VB_W) * 100}%`,
              height: `${(26 / VB_H) * 100}%`,
              background: "transparent",
              border: isReady ? "2px solid rgba(120,255,180,0.55)" : "none",
              cursor: isReady ? "pointer" : "default",
              touchAction: "manipulation",
              padding: 0,
            }}
          />
        ))}

        {/* 떨어지는 음료 */}
        {dropping && (
          <div style={{
            position: "absolute",
            left: `${(dropping.x / VB_W) * 100}%`,
            top: `${(46 / VB_H) * 100}%`,
            transform: "translateX(-50%)",
            fontSize: compact ? 13 : 16,
            animation: "vendDrop 1.6s ease-in forwards",
            pointerEvents: "none",
            zIndex: 3,
            lineHeight: 1,
          }}>
            {dropping.emoji}
          </div>
        )}
      </div>

      {/* 동전 버튼 */}
      <button onClick={insertCoin} disabled={locked || state !== "idle"}
        style={{
          display: "block", width: W,
          fontFamily: "'DotGothic16', monospace", fontSize: compact ? 10 : 9,
          background: locked ? "#1a2838" : isReady ? "#1a4a38" : "#1e3850",
          color: locked ? "#3a4a5a" : isReady ? "#44dd88" : "#66aacc",
          border: `2px solid ${isReady ? "#2a6a48" : "#2a4a6a"}`,
          padding: compact ? "6px 2px" : "5px 0",
          cursor: locked || state !== "idle" ? "not-allowed" : "pointer",
          touchAction: "manipulation",
        }}>
        {locked ? "☕ 커피 먼저" : isReady ? "✓ 동전 투입됨" : "🪙 동전 넣기"}
      </button>

      {/* 담배 — 흡연실과 물리는 유일한 품목 */}
      <button onClick={buySmokes} disabled={locked || state !== "idle" || soldOut}
        title={soldOut ? "오늘은 다 나갔습니다" : `${BUY_PACK_SIZE}개비 — 흡연실에서 쓸 수 있어요`}
        style={{
          display: "block", width: W, marginTop: -2,
          fontFamily: "'DotGothic16', monospace", fontSize: compact ? 9 : 8.5,
          background: locked || soldOut ? "#1a2838" : "#3a2a20",
          color: locked || soldOut ? "#3a4a5a" : "#d8a878",
          border: `2px solid ${locked || soldOut ? "#2a4a6a" : "#5a3a24"}`,
          padding: compact ? "6px 2px" : "5px 0",
          cursor: locked || state !== "idle" || soldOut ? "not-allowed" : "pointer",
          touchAction: "manipulation",
        }}>
        {soldOut ? "🚬 오늘 품절" : `🚬 담배 (${BUY_PACK_SIZE}개비)`}
      </button>

      {/* 경고 문구 — 실제 담뱃갑처럼 */}
      {!compact && (
        <div style={{
          width: W, textAlign: "center",
          fontFamily: "'DotGothic16', monospace", fontSize: 6.5,
          color: "hsl(30 12% 48%)", lineHeight: 1.4, marginTop: 1,
        }}>
          흡연은 질병의 원인
        </div>
      )}
    </div>
  );
}

/* ─── 자판기 SVG ─────────────────────────────────────────── */
function VendingSvg({ w, state }: { w: number; state: VendState }) {
  const isReady = state === "ready";
  return (
    <svg width={w} height={Math.round(w * VB_H / VB_W)} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ imageRendering: "pixelated", display: "block" }}>
      {/* 받침 */}
      <rect x="6" y="164" width="114" height="6" fill="#0c1828" />
      {/* 본체 */}
      <rect x="2" y="2" width="122" height="164" rx="3" fill="#24466a" stroke="#0e1c30" strokeWidth="3" />
      {/* 상단 간판 */}
      <rect x="8" y="8" width="110" height="15" rx="1" fill="#142c46" stroke="#0e1c30" strokeWidth="1.5" />
      <text x="63" y="19.5" textAnchor="middle" fontSize="10" fill={isReady ? "#8affc0" : "#7ab8e8"} fontFamily="'DotGothic16', monospace">
        ─ 시원한 음료 ─
      </text>

      {/* 유리창 */}
      <rect x="8" y="27" width="74" height="100" fill="#0c1420" stroke="#081018" strokeWidth="2" />
      {isReady && <rect x="8" y="27" width="74" height="100" fill="#aaffcc" opacity="0.06" />}

      {/* 1열 (진짜 아이템) */}
      <rect x="10" y="64" width="70" height="3" fill="#1c3450" />
      {VEND_ITEMS.map((item, i) => (
        <g key={item.id} opacity={state === "dispensing" ? 0.45 : 1}>
          <text x={ITEM_XS[i]} y="60" textAnchor="middle" fontSize="13">{item.emoji}</text>
          <rect x={ITEM_XS[i] - 9} y="67" width="18" height="7" rx="1" fill="#1c3450" />
          <text x={ITEM_XS[i]} y="72.5" textAnchor="middle" fontSize="4.5" fill={isReady ? "#8affc0" : "#6a90b8"} fontFamily="monospace">500</text>
        </g>
      ))}

      {/* 2열 (장식) */}
      <rect x="10" y="102" width="70" height="3" fill="#1c3450" />
      {VEND_ITEMS.map((item, i) => (
        <g key={item.id} opacity="0.45">
          <text x={ITEM_XS[i]} y="98" textAnchor="middle" fontSize="13">{item.emoji}</text>
          <rect x={ITEM_XS[i] - 9} y="105" width="18" height="7" rx="1" fill="#182e48" />
        </g>
      ))}

      {/* 유리 반사 */}
      <polygon points="12,29 30,29 16,125 12,125" fill="#ffffff" opacity="0.05" />

      {/* 우측 패널 */}
      <rect x="86" y="27" width="32" height="100" fill="#1a3454" stroke="#0e1c30" strokeWidth="2" />
      {/* 동전 투입구 */}
      <rect x="96" y="34" width="12" height="16" rx="1" fill="#0e2038" stroke="#0a1830" strokeWidth="1.5" />
      <rect x="100.5" y="37" width="3" height="10" fill="#040a14" />
      {/* 미니 표시창 */}
      <rect x="92" y="58" width="20" height="10" rx="1" fill="#081008" stroke="#0a1830" strokeWidth="1.5" />
      <text x="102" y="65.5" textAnchor="middle" fontSize="5" fill={isReady ? "#44dd88" : "#2a6a4a"} fontFamily="'DotGothic16', monospace">
        {state === "dispensing" ? "···" : isReady ? "선택" : "동전"}
      </text>
      {/* 반환 레버 */}
      <circle cx="102" cy="80" r="4.5" fill="#0e2038" stroke="#0a1830" strokeWidth="1.5" />
      <rect x="101" y="76" width="2" height="5" fill="#4a7096" />
      <text x="102" y="120" textAnchor="middle" fontSize="5" fill="#3a5a80" fontFamily="monospace">24H</text>

      {/* 배출구 */}
      <rect x="8" y="133" width="74" height="24" rx="2" fill="#0a1626" stroke="#060c16" strokeWidth="2" />
      <rect x="14" y="138" width="62" height="14" rx="1" fill="#060e1a" />
      <text x="45" y="147.5" textAnchor="middle" fontSize="5.5" fill="#4a7096" fontFamily="monospace">PUSH</text>
    </svg>
  );
}
