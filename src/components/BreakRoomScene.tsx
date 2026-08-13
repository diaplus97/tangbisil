/**
 * BreakRoomScene — 온라인 탕비실 방 씬
 *
 * 데스크탑 + 모바일 모두 동일한 3열 공간감 유지.
 * 모바일에서는 컬럼 폭을 줄이고 컴팩트 컴포넌트로 대체.
 * 오브젝트(전자레인지/자판기/디저트 선반)는 각자 픽셀 SVG 컴포넌트.
 */
import { useState, useRef, useLayoutEffect } from "react";
import CoffeeMachine from "./CoffeeMachine";
import SharedCounter from "./SharedCounter";
import WindowWeather from "./WindowWeather";
import StatusClock from "./StatusClock";
import PlantCorner from "./PlantCorner";
import MicrowaveStation from "./MicrowaveStation";
import DessertShelf from "./DessertShelf";
import VendingMachine from "./VendingMachine";
import SmokingDoor from "./SmokingDoor";
import FruitBasket from "./FruitBasket";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoomEvent } from "@/hooks/useRoomEvent";

export default function BreakRoomScene({ onEnterSmoking }: { onEnterSmoking: () => void }) {
  const isMobile = useIsMobile();
  const { myCup, explosionAt } = useBreakRoom();
  const [shaking, setShaking] = useState(false);
  const [flash, setFlash] = useState(false);

  // 폭발하면 방이 번쩍하고 흔들린다.
  // useRoomEvent — 흡연실에 갔다 오면 explosionAt 은 그대로 남아 있는데
  // 씬은 새로 마운트되니까, 그냥 useEffect 로 두면 돌아올 때마다 다시 흔들린다.
  useRoomEvent(explosionAt, () => {
    setShaking(true);
    setFlash(true);
    const f = setTimeout(() => setFlash(false), 900);
    const s = setTimeout(() => setShaking(false), 1200);
    return () => { clearTimeout(f); clearTimeout(s); };
  });

  return (
    <div className={shaking ? "room-shake" : undefined} style={{
      flex: 1, minHeight: 0,
      background: "hsl(38 25% 80%)",
      display: "flex", flexDirection: "column",
      alignItems: "stretch",
      overflow: "hidden",
      position: "relative",
    }}>
      <RoomLayout compact={isMobile} showHint={!myCup} onEnterSmoking={onEnterSmoking} />

      {/* 폭발 섬광 — 방 전체를 덮는다 */}
      {flash && (
        <div className="blast-flash" style={{
          position: "absolute", inset: 0,
          zIndex: 40, pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RoomLayout — 3열 방 구조 (데스크탑 / 모바일 공통)
   ═══════════════════════════════════════════════════════════════ */
function RoomLayout({ compact, showHint, onEnterSmoking }: {
  compact: boolean; showHint: boolean; onEnterSmoking: () => void;
}) {
  // 모바일: vw 기반 + 최솟값 보장 → 어떤 폰 너비에서도 content 보호
  const leftW  = compact ? "clamp(72px, 18vw, 90px)"  : "clamp(110px, 17%, 190px)";
  const rightW = compact ? "clamp(92px, 27vw, 112px)" : "clamp(105px, 16%, 182px)";

  return (
    <div style={{
      flex: 1, minHeight: 0,
      maxWidth: compact ? "100%" : 1100, width: "100%",
      margin: "0 auto",
      display: "flex", flexDirection: "column",
      position: "relative",
      boxShadow: compact ? "none" : "0 0 0 3px hsl(30 25% 20%), 5px 0 0 rgba(0,0,0,0.18), -5px 0 0 rgba(0,0,0,0.18)",
    }}>
      {/* 벽 배경 */}
      <WallBackground compact={compact} />

      {/* 방 본체 — 폰은 2단 벽, 데스크탑은 3열 */}
      {compact ? (
        <WallBands showHint={showHint} onEnterSmoking={onEnterSmoking} />
      ) : (
        <div style={{
          flex: 1, minHeight: 0,
          display: "grid",
          gridTemplateColumns: `${leftW} 1fr ${rightW}`,
          position: "relative", zIndex: 1,
          overflow: "hidden",
        }}>
          <LeftZone compact={compact} />
          <CenterZone compact={compact} showHint={showHint} onEnterSmoking={onEnterSmoking} />
          <RightZone compact={compact} />
        </div>
      )}

      {/* 공유 카운터 */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <SharedCounter />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WallBands — 폰 전용 2단 벽

   3열로 욱여넣으면 각 열이 세로 공간을 따로 쓰기 때문에, 벽 한가운데가
   180px 씩 텅 비고 나머지가 위아래로 몰린다. 그래서 폰에서는 열을 버리고
   "벽에 붙는 것"과 "바닥에 서는 것" 두 단으로 나눈다.
   ═══════════════════════════════════════════════════════════════ */
/** 폰 벽을 이 크기로 한 번만 짜고, 실제 화면에 맞게 통째로 축소한다.
 *  폰마다 세로 길이가 제각각인데 붙박이들은 고정 px 이라, 이렇게 안 하면
 *  작은 폰에서 아래쪽(커피 버튼·문 아랫부분)이 카운터에 잘려 나간다. */
const DESIGN_W = 430;
const DESIGN_H = 560;

function WallBands({ showHint, onEnterSmoking }: {
  showHint: boolean; onEnterSmoking: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setFit(Math.min(1, width / DESIGN_W, height / DESIGN_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{
      flex: 1, minHeight: 0,
      display: "flex", justifyContent: "center",
      position: "relative", zIndex: 1,
      overflow: "hidden",
    }}>
    <div style={{
      width: DESIGN_W, height: DESIGN_H, flexShrink: 0,
      transform: `scale(${fit})`,
      transformOrigin: "top center",
      display: "flex", flexDirection: "column",
      justifyContent: "space-between",
      padding: "7px 7px 7px",
      boxSizing: "border-box",
    }}>
      {/* ── 선반단 — 벽에 걸린 것들 ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 4,
        flexShrink: 0,
      }}>
        <FruitBasket compact />
        <MicrowaveStation compact inline />
        <WindowWeather compact />
      </div>

      {/* ── 중간 벽 — 두 단 사이가 그냥 비면 그게 아까 그 공백이다.
             폰에는 시계가 아예 없었으니 여기에 건다 ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        flexShrink: 0,
        padding: "4px 0",
      }}>
        <StatusClock compact />
        {showHint && (
          <div style={{
            fontFamily: "'DotGothic16', monospace",
            fontSize: 12, lineHeight: 1.9,
            color: "hsl(28 58% 36%)",
            pointerEvents: "none",
          }}>
            커피를 내려<br />자리를 잡으세요
          </div>
        )}
      </div>

      {/* ── 바닥단 — 바닥에 서 있는 것들 ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 4,
        flexShrink: 0,
      }}>
        <PlantCorner compact />
        <CoffeeMachine compact />
        <SmokingDoor compact inline onEnter={onEnterSmoking} />
        {/* 간식 선반은 자판기 위 벽에 — 둘이 한 덩어리로 읽힌다 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <DessertShelf compact />
          <VendingMachine compact />
        </div>
      </div>
    </div>
    </div>
  );
}

/* ─── 벽 배경 ────────────────────────────────────────────────── */
function WallBackground({ compact }: { compact: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "hsl(38 26% 86%)", zIndex: 0 }}>
      {/* 벽 세로 줄무늬 (장식) */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${i * 7.14}%`, width: 1, background: "rgba(0,0,0,0.022)" }} />
      ))}
      {/* 상단 몰딩 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: compact ? 5 : 8, background: "hsl(30 35% 68%)", borderBottom: "2px solid hsl(30 25% 52%)" }} />
      {/* 하단 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "hsl(30 35% 62%)" }} />
      {/* 날짜 칩 (데스크탑에만) */}
      {!compact && (
        <div style={{
          position: "absolute", top: 13, right: 12,
          fontFamily: "'DotGothic16', monospace", fontSize: 8,
          color: "hsl(30 25% 40%)", background: "rgba(255,255,255,0.38)",
          border: "2px solid hsl(30 25% 56%)", padding: "2px 5px",
          zIndex: 1,
        }}>
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
        </div>
      )}
    </div>
  );
}

/* ─── 왼쪽 영역 ──────────────────────────────────────────────── */
function LeftZone({ compact }: { compact: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      // 모바일: 수평 패딩 0 → column 폭 전체를 content에 활용
      padding: compact ? "8px 0" : "12px 8px",
      gap: compact ? 6 : 10,
      borderRight: "2px solid rgba(0,0,0,0.06)",
      overflow: "hidden",
      minWidth: 0,
      boxSizing: "border-box",
    }}>
      {/* 디지털 시계 + 먼지 — 데스크탑만 */}
      {!compact && <StatusClock />}

      {/* 과일 바구니 — 시계와 화분 사이의 빈 벽 */}
      <div style={{ marginTop: compact ? 4 : 10, flexShrink: 0 }}>
        <FruitBasket compact={compact} />
      </div>

      {/* 화분 — 하단 */}
      <div style={{ marginTop: "auto", flexShrink: 0 }}>
        <PlantCorner compact={compact} />
      </div>
    </div>
  );
}

/* ─── 중앙 영역 ──────────────────────────────────────────────── */
function CenterZone({ compact, showHint, onEnterSmoking }: {
  compact: boolean; showHint: boolean; onEnterSmoking: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center",
      /* justifyContent 제거 — flex spacer로 machine을 아래에 고정 */
      padding: compact ? "6px 4px 4px" : "8px 8px 6px",
      gap: compact ? 4 : 6,
      position: "relative",
      minWidth: 0,
      overflow: "visible",
    }}>
      {/* 전자레인지 — 절대 위치, 레이아웃에 영향 없음 */}
      <MicrowaveStation compact={compact} />

      {/* 창문 — 구석에 있으면 아무도 안 본다. 벽 한가운데로 옮기고 키웠다 */}
      <div style={{
        position: "absolute",
        top: compact ? 4 : 10,
        right: compact ? 2 : 12,
        zIndex: 3,
      }}>
        <WindowWeather compact={compact} />
      </div>

      {/* 빈 벽 공간 — machine을 아래로 밀기 */}
      <div style={{ flex: 1 }} />

      {/* 안내 문구 — 자연스러운 흐름으로 machine 바로 위에 렌더링 */}
      {showHint && (
        <div style={{
          textAlign: "center",
          fontFamily: "'DotGothic16', monospace",
          lineHeight: compact ? 2.0 : 2.4,
          pointerEvents: "none",
          paddingBottom: compact ? 4 : 6,
          zIndex: 0,
        }}>
          <div style={{ fontSize: compact ? 12 : 13, color: "hsl(28 58% 36%)" }}>
            커피를 내려 자리를 잡으세요
          </div>
          {!compact && (
            <div style={{ fontSize: 10, color: "hsl(30 20% 52%)" }}>
              아메리카노 · 믹스커피 · 라떼 중 선택하세요
            </div>
          )}
        </div>
      )}

      {/* 커피 머신 — 모바일에서는 문이 라떼 버튼을 가리므로 왼쪽으로 밀어준다 */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, marginRight: compact ? 62 : 0 }}>
        <CoffeeMachine compact={compact} />
      </div>

      {/* 흡연실 문 — 벽에 세워 바닥에 붙인다 */}
      <SmokingDoor compact={compact} onEnter={onEnterSmoking} />
    </div>
  );
}

/* ─── 오른쪽 영역 ────────────────────────────────────────────── */
function RightZone({ compact }: { compact: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      // 모바일: 수평 패딩 0 → column 폭 전체를 content에 활용
      padding: compact ? "6px 0 6px" : "12px 14px 12px 8px",
      borderLeft: "2px solid rgba(0,0,0,0.06)",
      gap: compact ? 8 : 12,
      minWidth: 0,
      overflow: "hidden",
      boxSizing: "border-box",
    }}>
      <DessertShelf compact={compact} />
      <VendingMachine compact={compact} />
    </div>
  );
}
