import { useState } from "react";
import { useBreakRoom, type PlantState } from "@/context/BreakRoomContext";

/** 화분 — 클릭하면 물주기, 상태에 따라 모양이 바뀜 */
export default function PlantCorner({ compact = false }: { compact?: boolean }) {
  const { plantState, canWater, waterPlant } = useBreakRoom();
  const [dripping, setDripping] = useState(false);

  const handleWater = () => {
    if (!canWater) return;
    setDripping(true);
    waterPlant();
    setTimeout(() => setDripping(false), 1200);
  };

  // 모바일: 좁은 컬럼에 맞는 짧은 라벨
  const stateLabelDesktop: Record<PlantState, string> = {
    dry: "목마른 중... 🥀",
    okay: "괜찮아요 🌱",
    happy: "기뻐요! 🌿",
  };
  const stateLabelMobile: Record<PlantState, string> = {
    dry: "목마름 🥀",
    okay: "괜찮아 🌱",
    happy: "기뻐요 🌿",
  };
  const stateLabel = compact ? stateLabelMobile : stateLabelDesktop;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: canWater ? "pointer" : "default" }}
      onClick={handleWater}
      title={canWater ? "화분에 물 주기" : "방금 물 줬어요~"}
    >
      <div style={{ position: "relative" }}>
        {/* 물방울 애니메이션 */}
        {dripping && (
          <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)" }}>
            <div className="drip" style={{ fontSize: 14 }}>💧</div>
          </div>
        )}
        <PlantSvg state={plantState} />
      </div>

      <div style={{
        fontFamily: "'DotGothic16', monospace", fontSize: 8,
        color: plantState === "happy" ? "#27ae60" : plantState === "okay" ? "#7f8c8d" : "#c0392b",
        background: "rgba(255,255,255,0.5)",
        border: "2px solid hsl(30 25% 55%)",
        padding: "1px 5px", textAlign: "center",
        // 모바일: 짧은 라벨이라도 넘치면 말줄임표
        whiteSpace: compact ? "normal" : "nowrap",
        maxWidth: compact ? "100%" : undefined,
        wordBreak: "keep-all",
      }}>
        {stateLabel[plantState]}
      </div>

      {!canWater && !compact && (
        <div style={{ fontFamily: "'DotGothic16', monospace", fontSize: 7, color: "hsl(30 20% 55%)" }}>
          잠시 후 다시...
        </div>
      )}
    </div>
  );
}

function PlantSvg({ state }: { state: PlantState }) {
  const leafColors = {
    dry: ["#8B7355", "#7a6445"],
    okay: ["#5a8c3a", "#4a7c2a"],
    happy: ["#6aac4a", "#5a9c3a"],
  };
  const [c1, c2] = leafColors[state];
  const droop = state === "dry";

  return (
    <svg width="50" height="62" viewBox="0 0 50 62" style={{ imageRendering: "pixelated", display: "block" }}>
      {/* 잎 */}
      {droop ? (
        <>
          <ellipse cx="16" cy="22" rx="10" ry="6" fill={c1} transform="rotate(20 16 22)" />
          <ellipse cx="34" cy="20" rx="9" ry="5" fill={c2} transform="rotate(-20 34 20)" />
          <ellipse cx="25" cy="17" rx="7" ry="5" fill={c1} />
        </>
      ) : (
        <>
          <ellipse cx="14" cy="16" rx="11" ry="7" fill={c1} />
          <ellipse cx="30" cy="11" rx="10" ry="6" fill={c2} />
          <ellipse cx="24" cy="8" rx="8" ry="6" fill={c1} />
          {state === "happy" && (
            <>
              <ellipse cx="10" cy="10" rx="5" ry="4" fill={c2} />
              <ellipse cx="38" cy="14" rx="5" ry="4" fill={c2} />
            </>
          )}
        </>
      )}
      {/* 줄기 */}
      <rect x="22" y={droop ? 22 : 18} width="5" height="14" fill="#4a6a2a" />
      {/* 화분 몸통 */}
      <rect x="10" y="32" width="30" height="20" rx="2" fill="#c07848" stroke="#2a1a0a" strokeWidth="2" />
      {/* 화분 테두리 */}
      <rect x="8" y="30" width="34" height="6" rx="1" fill="#d08858" stroke="#2a1a0a" strokeWidth="2" />
      {/* 흙 */}
      <rect x="12" y="32" width="26" height="5" fill="#5a3a1a" />
    </svg>
  );
}
