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

const BREW_ORDER = ["americano", "mix", "latte"] as const;

/* ── 기계 도면 (viewBox 좌표) ──────────────────────────────
 * 버튼을 기계 안에 넣으려면 패널이 커야 한다. 폰에서 실제 44px 높이를
 * 만들려면 55 단위가 필요하다 (렌더 배율 0.875 × 화면 맞춤 0.907). */
const VB_W = 160;
const VB_H = 310;
const BTN_X = 20;
const BTN_W = 120;
const BTN_H = 55;
const BTN_Y0 = 52;
const BTN_STEP = 59;

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

  // 기계 크기 — viewBox 160x310 을 이 폭에 맞춰 렌더한다.
  // 폰에서 버튼 하나가 실제 44px 높이가 나오려면 이만큼은 커야 한다.
  const W = compact ? 140 : 126;
  const H = (W * VB_H) / VB_W;

  const locked = !!myCup || !!brewing;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2 }}>
      <div style={{ position: "relative", width: W, height: H }}>
        {brewing && <CoffeeDrip type={brewing} compact={compact} />}
        <MachineSvg brewing={brewing} done={!!myCup} W={W} H={H} />

        {/* 버튼은 기계 패널 위에 겹쳐 놓는다.
            예전엔 기계 아래 따로 떠 있어서 기계와 상관없는 UI 처럼 보였고,
            폰에서는 두 줄로 접히며 55x29px 밖에 안 됐다. */}
        {BREW_ORDER.map((type, i) => {
          const { label, bg, text } = BREW_BTN[type];
          const on = brewing === type;
          const chosen = myCup?.coffeeType === type;
          return (
            <button
              key={type}
              onClick={() => handleBrew(type)}
              disabled={locked}
              title={locked ? undefined : `${label} 내리기`}
              style={{
                position: "absolute",
                left: `${(BTN_X / VB_W) * 100}%`,
                width: `${(BTN_W / VB_W) * 100}%`,
                top: `${((BTN_Y0 + i * BTN_STEP) / VB_H) * 100}%`,
                height: `${(BTN_H / VB_H) * 100}%`,
                background: on || chosen ? light(bg) : bg,
                color: text,
                border: "2px solid hsl(30 25% 10%)",
                boxShadow: locked ? "inset 0 2px 0 rgba(0,0,0,0.3)" : "0 3px 0 rgba(0,0,0,0.45)",
                fontFamily: "'DotGothic16', monospace",
                fontSize: compact ? 13 : 11,
                letterSpacing: "0.02em",
                cursor: locked ? "default" : "pointer",
                opacity: locked && !on && !chosen ? 0.5 : 1,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: 0,
                transition: "opacity 0.2s, background 0.2s",
              }}
            >
              {label}
              {chosen && <span aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 눌린 버튼은 한 톤 밝게 — 어느 걸 골랐는지 기계만 봐도 알게 */
function light(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const up = (v: number) => Math.min(255, Math.round(v * 1.55));
  return `rgb(${up((n >> 16) & 255)},${up((n >> 8) & 255)},${up(n & 255)})`;
}

/** 커피 드립 오버레이 */
function CoffeeDrip({ type, compact }: { type: CoffeeType; compact: boolean }) {
  const color = BREW_COLORS[type];
  const w = compact ? 100 : 82;
  return (
    <div style={{
      position: "absolute",
      // 추출 구멍이 viewBox 310 중 251 지점에 있다 — 기계가 커졌으니 같이 내려온다
      top: "81%",
      left: "50%",
      transform: "translateX(-52%)",
      display: "flex",
      justifyContent: "space-around",
      pointerEvents: "none",
      zIndex: 3,
      width: w,
    }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 5,
          height: 16,
          background: `linear-gradient(to bottom, ${color}, ${color}88)`,
          borderRadius: "0 0 4px 4px",
          animation: `brewDrip 0.75s ease-in-out ${i * 0.22}s infinite`,
          animationFillMode: "both",
        }} />
      ))}
    </div>
  );
}

/** 머신 SVG — 버튼 자리는 비워 두고 HTML 버튼이 그 위에 올라간다 */
function MachineSvg({ brewing, done, W, H }: {
  brewing: CoffeeType | null; done: boolean; W: number; H: number;
}) {
  const lightColor = brewing ? "#ffcc44" : done ? "#44aaff" : "#444";

  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {/* ── 본체 ── */}
      <rect x="10" y="8" width="140" height="296" rx="4" fill="#4a3828" stroke="#1e0e04" strokeWidth="4" />

      {/* ── 조작 패널 — 디스플레이 한 줄 + 버튼 세 칸 ── */}
      <rect x="16" y="14" width="128" height="214" rx="2" fill="#8B6855" stroke="#1e0e04" strokeWidth="2" />

      {/* 디스플레이 (가로 한 줄) */}
      <rect x="20" y="18" width="120" height="28" rx="2" fill="#12121e" stroke="#1e0e04" strokeWidth="2" />
      {brewing ? (
        <>
          <text x="30" y="38" fontSize="17" fill="#ffcc44">☕</text>
          <text x="52" y="37" fontSize="13" fill="#ffbb22" fontFamily="monospace">추출중...</text>
        </>
      ) : done ? (
        <>
          <text x="30" y="38" fontSize="17" fill="#44aaff">✓</text>
          <text x="52" y="37" fontSize="13" fill="#2288ff" fontFamily="monospace">완료</text>
        </>
      ) : (
        <>
          <text x="30" y="38" fontSize="17" fill="#666">☕</text>
          <text x="52" y="37" fontSize="12" fill="#777" fontFamily="monospace">SELECT</text>
        </>
      )}

      {/* 버튼이 앉을 홈 — 눌러야 할 곳처럼 보이게 파 놓는다 */}
      {[0, 1, 2].map((i) => (
        <rect key={i}
          x={BTN_X - 3} y={BTN_Y0 + i * BTN_STEP - 3}
          width={BTN_W + 6} height={BTN_H + 6}
          rx="3" fill="#6f5142" stroke="#1e0e04" strokeWidth="2" />
      ))}

      {/* 상태 표시등 */}
      <circle cx="148" cy="22" r="7" fill={lightColor} stroke="#1e0e04" strokeWidth="1.5" />
      {brewing && <circle cx="148" cy="22" r="5" fill={lightColor} opacity="0.6">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="0.7s" repeatCount="indefinite" />
      </circle>}

      {/* ── 구분 띠 ── */}
      <rect x="16" y="232" width="128" height="6" fill="#2e1e0e" />

      {/* ── 추출 영역 ── */}
      <rect x="16" y="242" width="128" height="48" rx="2" fill="#7a6050" stroke="#1e0e04" strokeWidth="2" />
      <rect x="28" y="247" width="104" height="34" rx="2" fill={brewing ? "#2a0800" : "#14060000"} stroke="#1e0e04" strokeWidth="1.5" />
      {brewing && <rect x="28" y="247" width="104" height="34" rx="2" fill="#1a0500" opacity="0.8" />}

      {/* 추출 구멍 3개 */}
      {[38, 68, 98].map((x, i) => (
        <rect key={i} x={x} y="251" width="20" height="22" rx="2"
          fill={brewing ? "#3a0a00" : "#0a0400"} stroke="#1e0e04" strokeWidth="1" />
      ))}

      {/* 추출 중인 컵 — 커피가 차오른다 */}
      {brewing && (
        <g>
          <rect x="70" y="290" width="20" height="0" fill={BREW_COLORS[brewing]}>
            <animate attributeName="y" from="290" to="281" dur="1.7s" begin="0.2s" fill="freeze" />
            <animate attributeName="height" from="0" to="9" dur="1.7s" begin="0.2s" fill="freeze" />
          </rect>
          <polygon points="66,278 94,278 91,293 69,293"
            fill="rgba(245,239,230,0.34)" stroke="#1e0e04" strokeWidth="2" />
          <rect x="66" y="276" width="28" height="3" fill="#f5efe6" stroke="#1e0e04" strokeWidth="1.5" />
        </g>
      )}

      {/* ── 컵 받침 ── */}
      <rect x="20" y="292" width="120" height="8" rx="2" fill="#2e1e0e" stroke="#1e0e04" strokeWidth="1.5" />
    </svg>
  );
}
