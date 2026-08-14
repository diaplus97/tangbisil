/**
 * SmokingDoor — 탕비실 벽에 난 흡연실 문
 *
 * 하단 구석의 작은 버튼이었을 땐 아무도 못 찾았다.
 * 방 안에 실제 문으로 세우고, 문틈으로 연기가 새어나오게 했다 —
 * 뭐가 있는지 말로 설명하지 않아도 알게 된다.
 */
import { sound } from "@/lib/sound";
import { markFound } from "@/lib/discovery";

const INK = "hsl(30 25% 16%)";

interface SmokingDoorProps {
  compact: boolean;
  onEnter: () => void;
  /** 밴드 레이아웃 안에서는 흐름에 맡긴다 (absolute 로 띄우지 않는다) */
  inline?: boolean;
  /** 문 너비 직접 지정 — 바닥단 높이를 문에 맞출 때 쓴다 */
  width?: number;
}

export default function SmokingDoor({ compact, onEnter, inline, width }: SmokingDoorProps) {
  const W = width ?? (compact ? 78 : 112);
  // 폰에서는 원래 비율(1:1.91)로 두면 문이 뭉툭하고 낮아서 '문'으로 안 읽힌다.
  // 좁고 높게 세운다 — 실제 문도 그렇다.
  const H = compact ? W * 2.35 : (W * 176) / 92;

  const handle = () => {
    markFound("smoking");
    sound.play("door");
    onEnter();
  };

  return (
    <button
      onClick={handle}
      title="복도 끝 흡연실"
      aria-label="흡연실로 이동"
      style={{
        ...(inline
          ? { position: "relative" }
          : { position: "absolute", right: compact ? 2 : 12, bottom: 0 }),
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        lineHeight: 0,
        zIndex: 3,
      }}
    >
      {/* 문틈에서 새어나오는 연기 — 여기 뭐가 있는지 알려주는 유일한 단서 */}
      <div style={{ position: "relative", width: W, height: compact ? 14 : 22 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="smoke-puff"
            style={{
              position: "absolute",
              left: `${16 + i * 26}%`,
              bottom: 0,
              width: compact ? 14 : 20,
              height: compact ? 14 : 20,
              background:
                "radial-gradient(circle, hsl(30 8% 58% / 0.44) 0%, hsl(30 8% 58% / 0.14) 44%, transparent 70%)",
              animationDelay: `${i * 1.15}s`,
              pointerEvents: "none",
            }}
          />
        ))}
      </div>

      <svg
        width={W}
        height={H}
        viewBox="0 0 92 176"
        style={{ imageRendering: "pixelated", display: "block", filter: "drop-shadow(-3px 0 0 rgba(0,0,0,0.16))" }}
      >
        {/* 문틀 */}
        <rect x="2" y="2" width="88" height="174" fill="hsl(28 32% 48%)" stroke={INK} strokeWidth="4" />
        {/* 문짝 */}
        <rect x="9" y="9" width="74" height="167" fill="hsl(28 27% 37%)" stroke={INK} strokeWidth="3" />
        {/* 패널 음각 */}
        <rect x="18" y="60" width="56" height="42" fill="none" stroke="hsl(28 22% 27%)" strokeWidth="3" />
        <rect x="18" y="110" width="56" height="52" fill="none" stroke="hsl(28 22% 27%)" strokeWidth="3" />

        {/* 문패 — "흡연실" */}
        <rect x="14" y="20" width="64" height="30" rx="2" fill="hsl(38 34% 86%)" stroke={INK} strokeWidth="3" />
        <text
          x="46" y="41"
          textAnchor="middle"
          fontFamily="'DotGothic16', monospace"
          fontSize="16"
          fill="hsl(30 30% 22%)"
        >
          흡연실
        </text>

        {/* 손잡이 */}
        <circle cx="71" cy="106" r="6" fill="hsl(45 40% 68%)" stroke={INK} strokeWidth="2.5" />
        <circle cx="71" cy="106" r="2" fill="hsl(45 25% 46%)" />

        {/* 문 아래 틈 — 복도 불빛이 새어든다 */}
        <rect x="12" y="169" width="68" height="4" fill="hsl(45 50% 74%)" opacity="0.6" />
      </svg>
    </button>
  );
}
