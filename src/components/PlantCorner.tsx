import { useState } from "react";
import { useBreakRoom, type PlantState, WATER_PER_STAGE, MAX_PLANT_STAGE } from "@/context/BreakRoomContext";

/** 화분 — 클릭하면 물주기, 상태에 따라 모양이 바뀜.
 *  물을 5번 줄 때마다 한 단계씩 위로 뻗는다 (잭과 콩나무).
 *  다 자라면(20번) 꼭대기에 황금알이 맺힌다 — 따서 들고 다닐 수 있다. */
export default function PlantCorner({ compact = false }: { compact?: boolean }) {
  const { plantState, canWater, waterPlant, plantStage, waterCount, eggReady, pickEgg } = useBreakRoom();
  const [dripping, setDripping] = useState(false);
  const toNext = WATER_PER_STAGE - (waterCount % WATER_PER_STAGE);
  const grown = plantStage >= MAX_PLANT_STAGE;

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
      title={
        !canWater ? "방금 물 줬어요~"
        : grown ? "다 자랐어요 🌳"
        : `화분에 물 주기 — ${toNext}번 더 주면 자라요`
      }
    >
      <div style={{ position: "relative" }}>
        {/* 물방울 애니메이션 */}
        {dripping && (
          <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
            <div className="drip" style={{ fontSize: 14 }}>💧</div>
          </div>
        )}
        <PlantSvg state={plantState} stage={plantStage} eggReady={eggReady} />

        {/* 꼭대기의 황금알 — 20번 물 준 사람만 딸 수 있다.
            물주기 영역과 겹치면 안 되니 따로 버튼으로 띄운다 */}
        {eggReady && (
          <button
            onClick={(e) => { e.stopPropagation(); pickEgg(); }}
            title="콩나무 꼭대기의 황금알 따기 🥚"
            aria-label="황금알 따기"
            style={{
              position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)",
              width: 46, height: 46, padding: 0,
              background: "none", border: "none", cursor: "pointer",
              touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
              zIndex: 3,
            }}
          />
        )}
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

/** 단계별로 줄기가 이만큼 더 뻗는다 (viewBox 단위) */
const STAGE_RISE = [0, 34, 74, 122, 178];

function PlantSvg({ state, stage, eggReady }: { state: PlantState; stage: number; eggReady: boolean }) {
  const leafColors = {
    dry: ["#8B7355", "#7a6445"],
    okay: ["#5a8c3a", "#4a7c2a"],
    happy: ["#6aac4a", "#5a9c3a"],
  };
  const [c1, c2] = leafColors[state];
  const droop = state === "dry";

  const rise = STAGE_RISE[Math.min(stage, STAGE_RISE.length - 1)];
  const VB_H = 62 + rise;
  // 자란 만큼 위쪽으로 viewBox 를 늘린다 — 화분은 늘 바닥에 붙어 있게
  const vbTop = -rise;

  return (
    <svg
      width="50" height={62 + rise}
      viewBox={`0 ${vbTop} 50 ${VB_H}`}
      style={{ imageRendering: "pixelated", display: "block", transition: "height 0.5s ease-out" }}
    >
      {/* ── 자란 줄기 — 지그재그로 타고 올라간다 ── */}
      {rise > 0 && (
        <>
          <path
            d={`M24.5,20 ${Array.from({ length: Math.ceil(rise / 22) }, (_, i) => {
              const y0 = 20 - i * 22;
              const dir = i % 2 === 0 ? 1 : -1;
              return `Q${24.5 + dir * 9},${y0 - 11} 24.5,${y0 - 22}`;
            }).join(" ")}`}
            fill="none" stroke="#4a7c2a" strokeWidth="5" strokeLinecap="round"
          />
          {/* 덩굴 잎 */}
          {Array.from({ length: Math.ceil(rise / 22) }, (_, i) => {
            const y = 9 - i * 22;
            const dir = i % 2 === 0 ? 1 : -1;
            return (
              <ellipse key={i} cx={24.5 + dir * 11} cy={y} rx="8" ry="5"
                fill={i % 2 === 0 ? c1 : c2}
                transform={`rotate(${dir * 22} ${24.5 + dir * 11} ${y})`} />
            );
          })}
          {/* 꼭대기 — 다 자라면 천장을 뚫는다 */}
          {stage >= MAX_PLANT_STAGE ? (
            <text x="25" y={26 - rise} textAnchor="middle" fontSize="16">🌳</text>
          ) : (
            <text x="25" y={24 - rise} textAnchor="middle" fontSize="11">🌱</text>
          )}

          {/* 황금알 — 다 자란 콩나무에만, 그것도 한참에 하나씩 맺힌다.
              반짝여야 눈에 띈다. 안 그러면 꼭대기까지 아무도 안 본다 */}
          {eggReady && (
            <g>
              <circle cx="25" cy={9 - rise} r="9" fill="hsl(45 92% 62%)" opacity="0.3">
                <animate attributeName="r" values="8;12;8" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.34;0.08;0.34" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {/* 이모지만 두면 잎사귀에 묻혀 꽃봉오리처럼 보인다 — 알 모양을 직접 그린다 */}
              <ellipse cx="25" cy={9 - rise} rx="7" ry="9" fill="hsl(45 85% 62%)" stroke="hsl(35 55% 28%)" strokeWidth="2" />
              <ellipse cx="22.5" cy={5.5 - rise} rx="2.2" ry="3" fill="hsl(48 95% 84%)" opacity="0.85" />
            </g>
          )}
        </>
      )}

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
