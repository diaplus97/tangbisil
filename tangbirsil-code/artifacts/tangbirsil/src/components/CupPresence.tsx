import { type ActiveCup, type CoffeeType } from "@/context/BreakRoomContext";

type CupPresenceProps = {
  cup: ActiveCup;
  showSteam?: boolean;
  isArmed?: boolean;
  isJiggling?: boolean;
  isHit?: boolean;
  canAttack?: boolean;
  onClick?: () => void;
};

/** 카운터 위에 놓이는 한 개의 컵 */
export default function CupPresence({
  cup, showSteam,
  isArmed = false, isJiggling = false, isHit = false,
  canAttack = false, onClick,
}: CupPresenceProps) {
  // 애니메이션 클래스 우선순위: hit > armed > jiggle
  let animClass = "";
  if (isHit)       animClass = "cup-hit";
  else if (isArmed) animClass = "cup-armed";
  else if (isJiggling) animClass = "cup-jiggle";

  const cursor = onClick
    ? canAttack ? "crosshair" : "pointer"
    : "default";

  const title = isArmed
    ? "공격할 컵을 탭하세요 ⚔️"
    : cup.isMe
    ? "탭: 무장 / 재탭: 해제"
    : canAttack
    ? "이 컵을 공격! 💥"
    : "탭해서 흔들기";

  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        userSelect: "none",
        cursor,
        touchAction: "manipulation",
        position: "relative",
      }}
    >
      {/* 무장 시 "공격 대상 선택" 안내 */}
      {isArmed && (
        <div style={{
          position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'DotGothic16', monospace", fontSize: 8,
          color: "#f39c12", whiteSpace: "nowrap",
          background: "rgba(0,0,0,0.55)", padding: "1px 4px",
          pointerEvents: "none", zIndex: 5,
        }}>
          대상선택!
        </div>
      )}

      {/* 컵 SVG + 애니메이션 */}
      <div style={{ position: "relative" }} className={animClass}>
        {showSteam && <SteamEffect />}
        {/* 무장 상태 검 아이콘 */}
        {isArmed && (
          <div style={{
            position: "absolute", top: -14, left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11, zIndex: 2, pointerEvents: "none",
          }}>
            ⚔️
          </div>
        )}
        <CupSvg color={cup.color} coffeeType={cup.coffeeType} isMe={cup.isMe} isArmed={isArmed} />
      </div>

      {/* 닉네임 태그 */}
      <div style={{
        fontFamily: "'DotGothic16', monospace",
        fontSize: 9,
        color: cup.isMe ? cup.color : "hsl(30 25% 35%)",
        background: cup.isMe ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)",
        border: `2px solid ${isArmed ? "#f39c12" : canAttack ? "#e74c3c" : cup.isMe ? cup.color : "hsl(30 25% 55%)"}`,
        padding: "1px 5px",
        maxWidth: 80,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "border-color 0.2s",
      }}>
        {cup.nickname.replace("Anonymous", "A")}
      </div>
    </div>
  );
}

/** 픽셀 아트 스타일 컵 */
function CupSvg({ color, coffeeType, isMe, isArmed }: {
  color: string; coffeeType: CoffeeType | null; isMe?: boolean; isArmed?: boolean;
}) {
  const drinkColor =
    coffeeType === "americano" ? "#2a0e00" :
    coffeeType === "latte"     ? "#c4956a" : "#8B6340";
  const hasDrink = coffeeType !== null;

  return (
    <svg width="38" height="42" viewBox="0 0 38 42" style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {/* 무장 시 황금 테두리 */}
      {isArmed && (
        <rect x="3" y="7" width="30" height="30" rx="3"
          fill="none" stroke="#f1c40f" strokeWidth="2" opacity="0.7" />
      )}

      {/* 손잡이 */}
      <rect x="30" y="12" width="6" height="14" rx="2" fill={color} stroke="hsl(30 25% 20%)" strokeWidth="2" />
      <rect x="30" y="14" width="4" height="10" fill="none" stroke="hsl(30 25% 20%)" strokeWidth="1" />

      {/* 컵 몸통 */}
      <rect x="4" y="8" width="28" height="28" rx="2" fill={color} stroke="hsl(30 25% 20%)" strokeWidth="2" />

      {/* 컵 안쪽 음료 */}
      {hasDrink  && <rect x="7" y="14" width="22" height="18" rx="1" fill={drinkColor} />}
      {!hasDrink && <rect x="7" y="14" width="22" height="18" rx="1" fill="rgba(0,0,0,0.1)" />}

      {/* 내 컵 강조 (작은 별) */}
      {isMe && (
        <text x="19" y="12" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.85)">★</text>
      )}

      {/* 컵 받침 */}
      <rect x="2" y="36" width="32" height="4" rx="1" fill="hsl(30 25% 20%)" />

      {/* 아메리카노 / 믹스 / 라떼 텍스트 */}
      {coffeeType && (
        <text x="19" y="26" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="monospace">
          {coffeeType === "americano" ? "아아" : coffeeType === "latte" ? "라떼" : "믹스"}
        </text>
      )}
    </svg>
  );
}

/** 김이 나는 애니메이션 */
function SteamEffect() {
  return (
    <div style={{ position: "absolute", top: -18, left: 6, display: "flex", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`steam${i > 0 ? `-${i + 1}` : ""}`}
          style={{ width: 4, height: 12, background: "rgba(200,200,200,0.6)", borderRadius: 3 }}
        />
      ))}
    </div>
  );
}
