/**
 * SmokingRoom — 흡연실 씬
 *
 * 탕비실이 따뜻한 베이지라면 여기는 차갑고 좁다. 형광등이 깜빡이고,
 * 창문엔 방범창이 있고, 재떨이엔 남이 놓고 간 꽁초가 이미 쌓여 있다.
 * 그 대비가 이 공간이 "다른 곳"이라는 신호가 된다.
 */
import { useSmokingRoom } from "@/context/SmokingRoomContext";
import NpcDialogue from "./NpcDialogue";
import { useClock } from "@/hooks/useClock";

const WALL = "hsl(155 7% 21%)";
const WALL_DARK = "hsl(155 8% 15%)";
const FLOOR = "hsl(150 6% 12%)";
const TILE_LINE = "hsl(155 6% 25%)";
const INK = "hsl(150 10% 8%)";

/**
 * 벽 낙서 — 이스터에그 발견을 유도하는 유일한 장치.
 *
 * reveal 은 이 낙서가 보이기 시작하는 연속 개비 수.
 * 0 짜리는 들어오자마자 보인다. 아무 힌트도 없으면 아무도 4개비를 안 피운다.
 */
const GRAFFITI = [
  // 문(왼쪽 3~26%)과 창문(오른쪽 63~93%, 위쪽)을 피해 가운데 벽에 적는다
  { text: "여기서 계속 피우면 누가 온다", x: 31, y: 44, rot: -2, size: 11, reveal: 0 },
  { text: "ㄴ 진짜임 ㅇㅇ", x: 40, y: 51, rot: 2, size: 9, reveal: 0 },
  { text: "나도 봤음", x: 34, y: 58, rot: -1, size: 9, reveal: 2 },
  { text: "퇴사 D-32", x: 66, y: 52, rot: 4, size: 10, reveal: 2 },
  { text: "월요일 싫어", x: 30, y: 66, rot: -2, size: 9, reveal: 2 },
  { text: "이번엔 진짜 끊는다", x: 58, y: 63, rot: 1, size: 9, reveal: 2 },
];

/** 바닥이 차지하는 높이(%). 대화가 시작되면 바닥선이 올라와 인물이 패널 위에 선다 */
const FLOOR_H_IDLE = 22;
const FLOOR_H_TALK = 54;

interface SmokingRoomProps {
  onExit: () => void;
}

export default function SmokingRoom({ onExit }: SmokingRoomProps) {
  const {
    phase, chain, progress, butts, graffitiVisible, footstepsHeard,
    cigsLeft, packEmpty, light, leave,
  } = useSmokingRoom();

  const smoking = phase === "smoking";
  const talking = phase === "talking" || phase === "arriving";
  // 낙서는 단계적으로 드러난다. 재방문자는 처음부터 전부 보인다.
  const graffitiLevel = graffitiVisible ? Math.max(chain, 2) : chain;
  // 바닥선 — 대화 중엔 올라와서 인물이 패널 위에 서게 된다
  const floorH = talking ? FLOOR_H_TALK : FLOOR_H_IDLE;
  const standOn = `${floorH - 4}%`;

  const handleExit = () => {
    leave(); // 기억 저장 트리거
    onExit();
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "hidden",
      background: "hsl(150 8% 6%)",
      fontFamily: "'DotGothic16', monospace",
      display: "flex", justifyContent: "center",
    }}>
      {/* 흡연실은 좁다 — 탕비실(1100)보다 훨씬 좁은 프레임으로 답답함을 만든다 */}
      <div style={{
        position: "relative", overflow: "hidden",
        width: "100%", maxWidth: 620,
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 0 4px hsl(150 10% 8%), 10px 0 26px rgba(0,0,0,0.6), -10px 0 26px rgba(0,0,0,0.6)",
      }}>
        <RoomBackdrop floorH={floorH} />

        {/* ── 벽 낙서 ── */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
          {GRAFFITI.filter((g) => graffitiLevel >= g.reveal).map((g, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${g.x}%`, top: `${g.y}%`,
              transform: `rotate(${g.rot}deg)`,
              fontSize: g.size,
              // 처음 보이는 두 줄이 이 게임의 유일한 발견 단서다 — 읽히게 만든다
              color: g.reveal === 0 ? "hsl(150 12% 58%)" : "hsl(150 9% 45%)",
              textShadow: `0 1px 0 ${INK}`,
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
              opacity: g.reveal === 0 ? 0.95 : 0.8,
            }}>
              {g.text}
            </div>
          ))}
        </div>

        {/* ── 재떨이 ── */}
        <div style={{
          position: "absolute", right: "6%", bottom: standOn, zIndex: 3,
          transition: "bottom 0.5s ease-out",
        }}>
          <Ashtray butts={butts} />
        </div>

        {/* ── NPC ── */}
        {talking && (
          <div className="npc-enter" style={{
            position: "absolute", left: "16%", bottom: standOn, zIndex: 4,
            transformOrigin: "bottom center",
            scale: "1.25",
          }}>
            <NpcFigure />
          </div>
        )}

        {/* ── 발자국 힌트 ── */}
        {footstepsHeard && !talking && (
          <div
            key={chain}
            className="hint-fade"
            style={{
              position: "absolute", left: "50%", top: "26%",
              transform: "translateX(-50%)",
              fontSize: 10, color: "hsl(45 25% 68%)",
              textShadow: `0 0 10px ${INK}, 0 0 4px ${INK}`,
              zIndex: 5, whiteSpace: "nowrap", pointerEvents: "none",
            }}
          >
            복도에서 발자국 소리가 들린다…
          </div>
        )}

        {/* ── 나가기 ── */}
        <button
          onClick={handleExit}
          style={{
            position: "absolute", left: 8, top: 8, zIndex: 8,
            padding: "6px 10px",
            background: "hsl(155 8% 26%)",
            color: "hsl(150 10% 76%)",
            border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 rgba(0,0,0,0.5)`,
            fontFamily: "'DotGothic16', monospace",
            fontSize: 9, cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ← 탕비실로
        </button>

        {/* ── 하단 담배 바 ── */}
        <div style={{ marginTop: "auto", position: "relative", zIndex: 6 }}>
          <CigaretteBar
            smoking={smoking}
            progress={progress}
            chain={chain}
            cigsLeft={cigsLeft}
            packEmpty={packEmpty}
            disabled={phase !== "idle"}
            onLight={light}
          />
        </div>

        {/* ── 대화 패널 ── */}
        {phase === "talking" && <NpcDialogue heightPct={FLOOR_H_TALK} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   배경 — 벽 / 창문 / 형광등 / 바닥
   ═══════════════════════════════════════════════════════════ */
function RoomBackdrop({ floorH }: { floorH: number }) {
  const now = useClock();
  const hour = now.getHours();
  const night = hour < 6 || hour >= 19;
  const wallBottom = `${floorH}%`;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
      {/* 벽 */}
      <div style={{
        position: "absolute", inset: 0, bottom: wallBottom,
        background: `linear-gradient(to bottom, ${WALL_DARK}, ${WALL})`,
        transition: "bottom 0.5s ease-out",
      }} />

      {/* 타일 줄눈 */}
      <div style={{
        position: "absolute", inset: 0, bottom: wallBottom,
        backgroundImage:
          `linear-gradient(to right, ${TILE_LINE} 1px, transparent 1px),` +
          `linear-gradient(to bottom, ${TILE_LINE} 1px, transparent 1px)`,
        backgroundSize: "44px 44px",
        opacity: 0.28,
        transition: "bottom 0.5s ease-out",
      }} />

      {/* 바닥 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: wallBottom,
        background: FLOOR,
        borderTop: `4px solid ${INK}`,
        transition: "height 0.5s ease-out",
      }} />

      {/* 형광등 */}
      <div className="tube-flicker" style={{
        position: "absolute", left: "50%", top: "5%",
        transform: "translateX(-50%)",
        width: "46%", maxWidth: 250,
      }}>
        {/* 등갓 */}
        <div style={{
          height: 7, marginBottom: 1,
          background: "hsl(155 8% 30%)",
          border: `3px solid ${INK}`,
        }} />
        <div style={{
          height: 10,
          background: "hsl(60 32% 90%)",
          border: `3px solid ${INK}`,
          boxShadow: "0 0 34px 14px hsl(60 45% 82% / 0.28)",
        }} />
      </div>

      {/* 환기구 */}
      <div style={{
        position: "absolute", left: "8%", top: "9%",
        width: 46, height: 30,
        background: "hsl(155 8% 24%)",
        border: `3px solid ${INK}`,
        display: "flex", flexDirection: "column",
        justifyContent: "space-evenly", padding: "3px 4px",
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 2, background: INK, opacity: 0.75 }} />
        ))}
      </div>

      {/* 안내문 — 흡연실인데도 붙어 있는 그 종이 */}
      <div style={{
        position: "absolute", left: "36%", top: "13%",
        padding: "5px 7px",
        background: "hsl(45 12% 76%)",
        border: `2px solid ${INK}`,
        transform: "rotate(-2deg)",
        fontSize: 7, lineHeight: 1.5,
        color: "hsl(150 10% 22%)",
        textAlign: "center",
        opacity: 0.72,
      }}>
        흡연 후<br />반드시 문을<br />닫아주십시오
      </div>

      {/* 창문 (방범창) */}
      <div style={{
        position: "absolute", right: "7%", top: "17%",
        width: "30%", maxWidth: 168, aspectRatio: "5 / 4",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: night
            ? "linear-gradient(to bottom, hsl(225 30% 12%), hsl(225 24% 20%))"
            : "linear-gradient(to bottom, hsl(205 30% 62%), hsl(205 22% 74%))",
          border: `4px solid ${INK}`,
        }} />
        {/* 밤이면 건너편 건물 불빛 */}
        {night && [18, 38, 55, 72].map((x, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${x}%`, top: `${28 + (i % 3) * 16}%`,
            width: 5, height: 6,
            background: i % 2 ? "hsl(45 70% 62%)" : "hsl(45 60% 48%)",
            opacity: 0.85,
          }} />
        ))}
        {/* 창살 */}
        <div style={{
          position: "absolute", inset: 4,
          backgroundImage:
            `linear-gradient(to right, ${INK} 3px, transparent 3px),` +
            `linear-gradient(to bottom, ${INK} 3px, transparent 3px)`,
          backgroundSize: "25% 33.33%",
          opacity: 0.9,
        }} />
      </div>

      {/* 문 (왼쪽) — 바닥에 딱 붙는다. NPC 는 여기로 들어온다 */}
      <div style={{
        position: "absolute", left: "3%", bottom: wallBottom,
        width: "23%", maxWidth: 132, height: "50%",
        background: "hsl(155 9% 20%)",
        border: `4px solid ${INK}`,
        boxShadow: "inset 0 0 0 4px hsl(155 9% 27%)",
        transition: "bottom 0.5s ease-out",
      }}>
        {/* 문틈으로 새어드는 복도 빛 */}
        <div style={{
          position: "absolute", right: -3, top: "6%", bottom: "6%",
          width: 3, background: "hsl(45 30% 62%)", opacity: 0.35,
        }} />
        {/* 손잡이 */}
        <div style={{
          position: "absolute", right: 9, top: "52%",
          width: 9, height: 9, borderRadius: "50%",
          background: "hsl(45 20% 62%)", border: `2px solid ${INK}`,
        }} />
      </div>

      {/* 전체 비네트 — 구석이 어둡다 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 32%, transparent 26%, rgba(0,0,0,0.72) 100%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   재떨이 — 이미 남의 꽁초가 몇 개 있다
   ═══════════════════════════════════════════════════════════ */
function Ashtray({ butts }: { butts: number }) {
  // 남이 놓고 간 꽁초 3개 + 내가 피운 것
  const mine = Math.min(butts, 8);

  return (
    <svg width="122" height="106" viewBox="0 0 86 74" style={{ imageRendering: "pixelated", display: "block" }}>
      {/* 스탠드 받침 + 기둥 */}
      <ellipse cx="43" cy="70" rx="20" ry="5" fill="hsl(155 8% 18%)" stroke={INK} strokeWidth="3" />
      <rect x="38" y="30" width="10" height="40" fill="hsl(155 8% 22%)" stroke={INK} strokeWidth="3" />
      {/* 재떨이 그릇 */}
      <ellipse cx="43" cy="30" rx="34" ry="11" fill="hsl(155 9% 30%)" stroke={INK} strokeWidth="3" />
      <ellipse cx="43" cy="28" rx="28" ry="8" fill="hsl(150 8% 17%)" />

      {/* 남이 놓고 간 꽁초 */}
      {[
        { x: 30, y: 27, r: -18 },
        { x: 46, y: 29, r: 12 },
        { x: 54, y: 25, r: -6 },
      ].map((b, i) => <Butt key={`o${i}`} {...b} />)}

      {/* 내 꽁초 */}
      {Array.from({ length: mine }).map((_, i) => (
        <Butt
          key={`m${i}`}
          x={24 + ((i * 7) % 38)}
          y={24 + ((i * 5) % 8)}
          r={-24 + ((i * 37) % 48)}
        />
      ))}

      {/* 재 */}
      {mine > 2 && <ellipse cx="43" cy="30" rx={7 + mine} ry="3" fill="hsl(45 6% 55%)" opacity="0.32" />}
    </svg>
  );
}

function Butt({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="0" y="0" width="11" height="4" fill="hsl(45 15% 84%)" stroke={INK} strokeWidth="1" />
      <rect x="8" y="0" width="4" height="4" fill="hsl(35 45% 55%)" stroke={INK} strokeWidth="1" />
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════
   NPC — 실루엣에 가까운 픽셀 인물
   ═══════════════════════════════════════════════════════════ */
function NpcFigure() {
  return (
    <svg width="62" height="120" viewBox="0 0 62 120" style={{ imageRendering: "pixelated", display: "block" }}>
      {/* 다리 */}
      <rect x="18" y="82" width="11" height="36" fill="hsl(215 12% 22%)" stroke={INK} strokeWidth="2.5" />
      <rect x="33" y="82" width="11" height="36" fill="hsl(215 12% 20%)" stroke={INK} strokeWidth="2.5" />
      {/* 몸통 — 반쯤 걷어붙인 셔츠 */}
      <rect x="13" y="40" width="36" height="44" rx="2" fill="hsl(210 10% 46%)" stroke={INK} strokeWidth="3" />
      <rect x="29" y="40" width="4" height="44" fill="hsl(210 10% 36%)" />
      {/* 팔 — 오른팔은 담배를 들고 있다 */}
      <rect x="3" y="46" width="10" height="30" rx="2" fill="hsl(210 10% 42%)" stroke={INK} strokeWidth="2.5" />
      <rect x="49" y="42" width="10" height="24" rx="2" fill="hsl(210 10% 42%)" stroke={INK} strokeWidth="2.5" />
      {/* 담배 든 손 */}
      <rect x="50" y="34" width="8" height="8" fill="hsl(28 30% 68%)" stroke={INK} strokeWidth="2" />
      <rect x="57" y="30" width="7" height="3" fill="hsl(45 15% 88%)" stroke={INK} strokeWidth="1" />
      <circle className="smoke-puff" cx="63" cy="29" r="2.4" fill="hsl(0 0% 82%)" opacity="0.5" />
      {/* 목 / 머리 */}
      <rect x="26" y="33" width="10" height="8" fill="hsl(28 28% 62%)" stroke={INK} strokeWidth="2" />
      <rect x="17" y="8" width="28" height="28" rx="3" fill="hsl(28 30% 68%)" stroke={INK} strokeWidth="3" />
      {/* 머리카락 — 희끗희끗 */}
      <rect x="17" y="8" width="28" height="9" rx="3" fill="hsl(210 6% 32%)" stroke={INK} strokeWidth="2.5" />
      <rect x="20" y="10" width="4" height="3" fill="hsl(210 5% 60%)" />
      <rect x="36" y="11" width="5" height="3" fill="hsl(210 5% 58%)" />
      {/* 눈 — 반쯤 감겨 있다 */}
      <rect x="23" y="22" width="6" height="2.5" fill={INK} />
      <rect x="34" y="22" width="6" height="2.5" fill={INK} />
      {/* 입 */}
      <rect x="28" y="29" width="7" height="2" fill="hsl(20 20% 38%)" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   하단 담배 바
   ═══════════════════════════════════════════════════════════ */
function CigaretteBar({
  smoking, progress, chain, cigsLeft, packEmpty, disabled, onLight,
}: {
  smoking: boolean;
  progress: number;
  chain: number;
  cigsLeft: number;
  packEmpty: boolean;
  disabled: boolean;
  onLight: () => void;
}) {
  // 타들어간 만큼 짧아진다
  const fullLen = 96;
  const burnt = fullLen * progress;
  const left = fullLen - burnt;

  return (
    <div style={{
      background: "hsl(150 8% 9%)",
      borderTop: `4px solid ${INK}`,
      padding: "10px 12px 12px",
      display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap", justifyContent: "center",
    }}>
      {/* 담배 그래픽 */}
      <div style={{ position: "relative", width: fullLen + 24, height: 34, flexShrink: 0 }}>
        {smoking ? (
          <>
            {/* 필터 + 남은 몸통 */}
            <div style={{
              position: "absolute", left: 0, top: 14,
              width: 22, height: 8,
              background: "hsl(35 45% 52%)", border: `2px solid ${INK}`,
            }} />
            <div style={{
              position: "absolute", left: 22, top: 14,
              width: Math.max(2, left), height: 8,
              background: "hsl(45 15% 90%)", border: `2px solid ${INK}`,
              borderLeft: "none",
              transition: "width 0.1s linear",
            }} />
            {/* 불씨 */}
            <div className="tube-flicker" style={{
              position: "absolute", left: 22 + Math.max(2, left), top: 13,
              width: 7, height: 10,
              background: "hsl(18 95% 55%)",
              boxShadow: "0 0 12px 4px hsl(20 100% 50% / 0.55)",
              animation: "ember 4s ease-in-out infinite",
              transition: "left 0.1s linear",
            }} />
            {/* 연기 — 가장자리를 흐리게 해서 덩어리로 안 보이게 */}
            {[0, 1, 2].map((i) => (
              <div key={i} className="smoke-puff" style={{
                position: "absolute",
                left: 22 + Math.max(2, left) - 11,
                top: 0,
                width: 30, height: 30,
                background: "radial-gradient(circle, hsl(0 0% 84% / 0.34) 0%, hsl(0 0% 84% / 0.10) 42%, transparent 68%)",
                animationDelay: `${i * 1.1}s`,
                pointerEvents: "none",
              }} />
            ))}
          </>
        ) : (
          <div style={{
            position: "absolute", left: 0, top: 14,
            width: fullLen + 22, height: 8,
            opacity: packEmpty ? 0.22 : 0.5,
          }}>
            <div style={{ position: "absolute", left: 0, width: 22, height: 8, background: "hsl(35 30% 40%)", border: `2px solid ${INK}` }} />
            <div style={{ position: "absolute", left: 22, width: fullLen, height: 8, background: "hsl(45 8% 62%)", border: `2px solid ${INK}`, borderLeft: "none" }} />
          </div>
        )}
      </div>

      {/* 버튼 + 상태 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <button
          onClick={onLight}
          disabled={disabled || packEmpty}
          style={{
            padding: "8px 16px",
            background: disabled || packEmpty ? "hsl(155 6% 20%)" : "hsl(18 55% 34%)",
            color: disabled || packEmpty ? "hsl(150 6% 44%)" : "hsl(35 70% 84%)",
            border: `3px solid ${INK}`,
            boxShadow: disabled || packEmpty ? "none" : "3px 3px 0 rgba(0,0,0,0.55)",
            fontFamily: "'DotGothic16', monospace",
            fontSize: 10, letterSpacing: "0.03em",
            cursor: disabled || packEmpty ? "default" : "pointer",
            minHeight: 34,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {packEmpty ? "담배 없음" : smoking ? "…피우는 중" : "🚬 불 붙이기"}
        </button>

        <div style={{ fontSize: 8, color: "hsl(150 7% 46%)", letterSpacing: "0.04em" }}>
          {packEmpty
            ? "내일 다시 사와야 한다"
            : `남은 담배 ${cigsLeft}개비${chain > 0 ? ` · 연속 ${chain}` : ""}`}
        </div>
      </div>
    </div>
  );
}
