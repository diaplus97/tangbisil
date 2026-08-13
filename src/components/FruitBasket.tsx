/**
 * FruitBasket — 탕비실 과일 바구니
 *
 * 디저트 선반이 "당 떨어질 때"라면 여기는 그 반대편이다.
 * 집으면 손에 들리고, 흡연실 아저씨한테 가져다줄 수 있다.
 * (아저씨한테 과일을 주면 반응이 제일 좋다 — 나이 든 사람이라)
 */
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import OrangeNinjaGame from "./OrangeNinjaGame";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const INK = "hsl(30 25% 18%)";

const FRUITS = [
  { id: "apple",  emoji: "🍎", label: "사과",   message: "사과 하나 집어감 🍎" },
  { id: "orange", emoji: "🍊", label: "오렌지", message: "오렌지 하나 집어감 🍊" },
  { id: "banana", emoji: "🍌", label: "바나나", message: "바나나 하나 챙김 🍌" },
];

/** 연속으로 집는 걸 막는 쿨다운 */
const COOLDOWN_MS = 8000;

export default function FruitBasket({ compact }: { compact: boolean }) {
  const { sendMessage, myCup, pickUp } = useBreakRoom();
  const locked = !myCup;

  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [popped, setPopped] = useState<string | null>(null);
  const [slicing, setSlicing] = useState(false);

  const cooling = Date.now() < cooldownEnd;

  const grab = useCallback((fruit: typeof FRUITS[0]) => {
    if (locked || Date.now() < cooldownEnd) return;
    sendMessage(fruit.message);
    pickUp({ id: fruit.id, emoji: fruit.emoji, label: fruit.label });
    sound.play("crunch");
    setPopped(fruit.emoji);
    setTimeout(() => setPopped(null), 1200);
    setCooldownEnd(Date.now() + COOLDOWN_MS);
    // 오렌지는 집는 걸로 끝나지 않는다 — 썰러 간다
    if (fruit.id === "orange") setSlicing(true);
  }, [locked, cooldownEnd, sendMessage, pickUp]);

  const W = compact ? 66 : 108;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ position: "relative", width: W, lineHeight: 0 }}>
        <BasketSvg w={W} dimmed={locked || cooling} />

        {/* 과일별 클릭 영역 — 바구니 위에 얹힌 위치에 맞춘다 */}
        {FRUITS.map((f, i) => (
          <button
            key={f.id}
            onClick={() => grab(f)}
            disabled={locked || cooling}
            title={locked ? "커피를 먼저 내려주세요" : cooling ? "방금 집었어요" : f.id === "orange" ? "오렌지 썰기 🔪" : f.label}
            aria-label={f.label}
            style={{
              position: "absolute",
              left: `${8 + i * 29}%`,
              top: "4%",
              width: "27%",
              height: "42%",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: locked || cooling ? "not-allowed" : "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          />
        ))}

        {/* 집으면 하나 톡 튀어나온다 */}
        {popped && (
          <div style={{
            position: "absolute", left: "50%", top: "10%",
            transform: "translateX(-50%)",
            fontSize: compact ? 14 : 18,
            animation: "snackPop 1.2s ease-out forwards",
            pointerEvents: "none", zIndex: 3, lineHeight: 1,
          }}>
            {popped}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: "'DotGothic16', monospace",
        fontSize: compact ? 7 : 8,
        color: locked || cooling ? "hsl(30 12% 55%)" : "hsl(30 25% 38%)",
        whiteSpace: "nowrap",
      }}>
        {/* 잠겼다고 이름까지 지우면 이게 뭔지 알 수가 없다 */}
        {locked ? "🔒 과일 바구니" : cooling ? "방금 집었어요" : "과일 바구니"}
      </div>

      {/* 반드시 portal — 폰에서 이 컴포넌트는 transform: scale() 안에 있고,
          transform 조상은 position:fixed 의 기준이 되어 오버레이를 방 안에 가둔다.
          (데스크탑은 transform 밖이라 이 버그가 안 보인다) */}
      {slicing && createPortal(
        <OrangeNinjaGame onClose={() => setSlicing(false)} />,
        document.body,
      )}
    </div>
  );
}

/* ─── 바구니 SVG ─────────────────────────────────────────── */
function BasketSvg({ w, dimmed }: { w: number; dimmed: boolean }) {
  const VB_W = 108;
  const VB_H = 84;
  return (
    <svg
      width={w} height={Math.round((w * VB_H) / VB_W)}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ imageRendering: "pixelated", display: "block", opacity: dimmed ? 0.62 : 1, transition: "opacity 0.2s" }}
    >
      {/* 과일 — 바구니 뒤에서 얼굴을 내민다 */}
      {/* 사과 */}
      <circle cx="26" cy="30" r="13" fill="#c9342b" stroke={INK} strokeWidth="3" />
      <ellipse cx="21" cy="25" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.4)" />
      <rect x="25" y="15" width="3" height="6" fill="#5a3a1a" stroke={INK} strokeWidth="1.5" />
      <path d="M28,18 Q35,13 34,20 Q30,22 28,18 Z" fill="#3e7a34" stroke={INK} strokeWidth="1.5" />

      {/* 귤 */}
      <circle cx="55" cy="33" r="12" fill="#e8880f" stroke={INK} strokeWidth="3" />
      <ellipse cx="51" cy="28" rx="3" ry="2" fill="rgba(255,255,255,0.35)" />
      <path d="M52,22 Q55,19 58,22" stroke="#3e7a34" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* 바나나 */}
      <path d="M74,22 Q92,24 94,40 Q88,34 82,32 Q76,29 74,22 Z"
        fill="#e8c22e" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="72" y="19" width="5" height="5" fill="#7a5a1a" stroke={INK} strokeWidth="1.5" />

      {/* 바구니 — 앞쪽이라 과일을 가린다 */}
      <path d="M8,40 L100,40 L92,78 L16,78 Z"
        fill="#b0803e" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {/* 엮은 결 */}
      {[48, 57, 66].map((y, i) => (
        <rect key={y} x={11 + i * 2} y={y} width={86 - i * 4} height="3" fill="#96682e" opacity="0.85" />
      ))}
      {[26, 44, 62, 80].map((x) => (
        <rect key={x} x={x} y="42" width="3" height="34" fill="#96682e" opacity="0.6" />
      ))}
      {/* 테두리 */}
      <rect x="6" y="36" width="96" height="8" rx="2" fill="#c69350" stroke={INK} strokeWidth="3" />
    </svg>
  );
}
