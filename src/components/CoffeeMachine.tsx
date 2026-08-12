import { useState } from "react";
import { useBreakRoom, type CoffeeType } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const BREW_COLORS: Record<CoffeeType, string> = {
  americano: "#1a0800",
  mix:       "#4a2000",
  latte:     "#7a5030",
};

const BREW_BTN: Record<CoffeeType, { label: string; bg: string; text: string }> = {
  americano: { label: "아메리카노", bg: "#1e3f62", text: "#9dccf5" },
  mix:       { label: "믹스커피",   bg: "#6b3310", text: "#f5c889" },
  latte:     { label: "라떼",       bg: "#2a4a38", text: "#a0e0b0" },
};

const BREWED_LABEL: Record<CoffeeType, string> = {
  americano: "아메리카노 ✓",
  mix: "믹스커피 ✓",
  latte: "라떼 ✓",
};

interface CoffeeMachineProps {
  /** compact 모드: 모바일에서 더 작은 크기로 렌더 */
  compact?: boolean;
}

/** 커피 스테이션 — 방의 핵심 오브젝트 */
export default function CoffeeMachine({ compact = false }: CoffeeMachineProps) {
  const { brew, myCup } = useBreakRoom();
  const [brewing, setBrewing] = useState<CoffeeType | null>(null);

  const handleBrew = (type: CoffeeType) => {
    if (brewing || myCup) return;
    setBrewing(type);
    sound.play("brew");
    setTimeout(() => {
      brew(type);
      setBrewing(null);
      sound.play("clink");
    }, 2000);
  };

  const btnFs = compact ? 8 : 9;
  const btnPad = compact ? "5px 7px" : "6px 10px";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 2 }}>
      {/* 기계 본체 */}
      <div style={{ position: "relative" }}>
        {brewing && <CoffeeDrip type={brewing} compact={compact} />}
        <MachineSvg brewing={brewing} done={!!myCup} compact={compact} />
      </div>

      {/* 버튼 영역 — z-index: 10 으로 반드시 최상위 */}
      <div style={{
        display: "flex", gap: compact ? 4 : 5,
        flexWrap: "wrap", justifyContent: "center",
        position: "relative", zIndex: 10,
      }}>
        {myCup ? (
          <div style={{
            fontFamily: "'DotGothic16', monospace", fontSize: btnFs,
            color: "hsl(30 25% 30%)",
            background: "hsl(38 55% 90%)",
            border: "3px solid hsl(30 25% 42%)",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
            padding: btnPad,
          }}>
            {BREWED_LABEL[myCup.coffeeType ?? "americano"]}
          </div>
        ) : brewing ? (
          <div style={{
            fontFamily: "'DotGothic16', monospace", fontSize: btnFs,
            color: "hsl(30 30% 35%)",
            background: "hsl(38 45% 88%)",
            border: "3px solid hsl(30 25% 42%)",
            padding: btnPad,
            animation: "brewPulse 0.7s ease-in-out infinite alternate",
          }}>
            {BREW_BTN[brewing].label} 추출 중... ☕
          </div>
        ) : (
          <>
            {(["americano","mix","latte"] as CoffeeType[]).map((type) => {
              const { label, bg, text } = BREW_BTN[type];
              return (
                <button key={type} onClick={() => handleBrew(type)} style={{
                  padding: btnPad,
                  background: bg,
                  color: text,
                  border: "3px solid hsl(30 25% 14%)",
                  boxShadow: "3px 3px 0 rgba(0,0,0,0.45)",
                  fontFamily: "'DotGothic16', monospace",
                  fontSize: btnFs, letterSpacing: "0.02em",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  minHeight: compact ? 32 : 28,
                  minWidth: compact ? 0 : 0,
                }}>
                  {label}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/** 커피 드립 오버레이 */
function CoffeeDrip({ type, compact }: { type: CoffeeType; compact: boolean }) {
  const color = BREW_COLORS[type];
  const w = compact ? 160 * 0.7 : 160;
  return (
    <div style={{
      position: "absolute",
      top: compact ? "64%" : "64%",
      left: "50%",
      transform: "translateX(-55%)",
      display: "flex",
      gap: compact ? 14 : 22,
      pointerEvents: "none",
      zIndex: 3,
      width: w,
    }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 5,
          height: 20,
          background: `linear-gradient(to bottom, ${color}, ${color}88)`,
          borderRadius: "0 0 4px 4px",
          animation: `brewDrip 0.75s ease-in-out ${i * 0.22}s infinite`,
          animationFillMode: "both",
        }} />
      ))}
    </div>
  );
}

/** 머신 SVG */
function MachineSvg({ brewing, done, compact }: { brewing: CoffeeType | null; done: boolean; compact: boolean }) {
  const lightColor = brewing ? "#ffcc44" : done ? "#44aaff" : "#444";
  const type = brewing;
  const W = compact ? 112 : 160;
  const H = compact ? 123 : 176;

  return (
    <svg
      width={W} height={H}
      viewBox="0 0 160 176"
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {/* ── 본체 ── */}
      <rect x="10" y="8" width="140" height="162" rx="4" fill="#4a3828" stroke="#1e0e04" strokeWidth="4" />

      {/* ── 상단 패널 ── */}
      <rect x="16" y="14" width="128" height="80" rx="2" fill="#8B6855" stroke="#1e0e04" strokeWidth="2" />

      {/* 디스플레이 */}
      <rect x="20" y="18" width="58" height="50" rx="2" fill="#12121e" stroke="#1e0e04" strokeWidth="2" />
      {brewing ? (
        <>
          <text x="49" y="40" textAnchor="middle" fontSize="22" fill="#ffcc44">☕</text>
          <text x="49" y="55" textAnchor="middle" fontSize="9" fill="#ffbb22" fontFamily="monospace">추출중</text>
        </>
      ) : done ? (
        <>
          <text x="49" y="40" textAnchor="middle" fontSize="22" fill="#44aaff">✓</text>
          <text x="49" y="55" textAnchor="middle" fontSize="8" fill="#2288ff" fontFamily="monospace">완료</text>
        </>
      ) : (
        <>
          <text x="49" y="42" textAnchor="middle" fontSize="28" fill="#333">☕</text>
          <text x="49" y="57" textAnchor="middle" fontSize="7" fill="#555" fontFamily="monospace">SELECT</text>
        </>
      )}

      {/* 머신 버튼 라벨 */}
      <rect x="86" y="18" width="52" height="14" rx="2" fill={type === "americano" ? "#3a6090" : "#1e3f62"} stroke="#1e0e04" strokeWidth="1.5" />
      {!compact && <text x="112" y="28" textAnchor="middle" fontSize="7" fill="#9dccf5" fontFamily="monospace">아메리카노</text>}

      <rect x="86" y="36" width="52" height="14" rx="2" fill={type === "mix" ? "#8a4820" : "#6b3310"} stroke="#1e0e04" strokeWidth="1.5" />
      {!compact && <text x="112" y="46" textAnchor="middle" fontSize="7" fill="#f5c889" fontFamily="monospace">믹스커피</text>}

      <rect x="86" y="54" width="52" height="14" rx="2" fill={type === "latte" ? "#3a6048" : "#2a4a38"} stroke="#1e0e04" strokeWidth="1.5" />
      {!compact && <text x="112" y="64" textAnchor="middle" fontSize="7" fill="#a0e0b0" fontFamily="monospace">라떼</text>}

      {/* 상태 표시등 */}
      <circle cx="148" cy="22" r="7" fill={lightColor} stroke="#1e0e04" strokeWidth="1.5" />
      {brewing && <circle cx="148" cy="22" r="5" fill={lightColor} opacity="0.6">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="0.7s" repeatCount="indefinite" />
      </circle>}

      {/* ── 구분 띠 ── */}
      <rect x="16" y="96" width="128" height="8" fill="#2e1e0e" />

      {/* ── 추출 영역 ── */}
      <rect x="16" y="104" width="128" height="54" rx="2" fill="#7a6050" stroke="#1e0e04" strokeWidth="2" />
      <rect x="28" y="110" width="104" height="38" rx="2" fill={brewing ? "#2a0800" : "#14060000"} stroke="#1e0e04" strokeWidth="1.5" />
      {brewing && <rect x="28" y="110" width="104" height="38" rx="2" fill="#1a0500" opacity="0.8" />}

      {/* 추출 구멍 3개 */}
      {[38, 68, 98].map((x, i) => (
        <rect key={i} x={x} y="116" width="20" height="26" rx="2"
          fill={brewing ? "#3a0a00" : "#0a0400"} stroke="#1e0e04" strokeWidth="1" />
      ))}

      {/* ── 컵 받침 ── */}
      <rect x="20" y="160" width="120" height="8" rx="2" fill="#2e1e0e" stroke="#1e0e04" strokeWidth="1.5" />
      <rect x="30" y="162" width="100" height="2" fill="#3e2e1e" />

    </svg>
  );
}
