import { useEffect, useState } from "react";
import { type ActiveCup } from "@/context/BreakRoomContext";

const BUBBLE_LIFETIME_MS = 6000;
const BUBBLE_MAX_W = 180;
const BUBBLE_HALF_W = BUBBLE_MAX_W / 2;
const BUBBLE_EST_H = 56;   // 추정 말풍선 높이 (패딩 + 텍스트 2줄 + 꼬리)
const LEVEL_GAP    = 10;   // 레벨 간격

type CupWithPos = ActiveCup & { centerX: number };

/**
 * 겹치지 않게 말풍선 Y 레벨을 배정하는 그리디 알고리즘.
 * X 좌표 순으로 정렬 후, 각 레벨의 우측 끝을 추적해 빈 레벨에 배치.
 */
function assignLevels(cups: CupWithPos[], cw: number): Map<string, number> {
  const active = cups.filter(
    (c) => c.message && c.messageAt && Date.now() - c.messageAt <= BUBBLE_LIFETIME_MS
  );
  const sorted = [...active].sort((a, b) => a.centerX - b.centerX);

  const levelRight: number[] = [];   // 각 레벨의 우측 경계 X
  const result = new Map<string, number>();

  for (const cup of sorted) {
    const clampedX = Math.max(BUBBLE_HALF_W, Math.min(cup.centerX, (cw || 9999) - BUBBLE_HALF_W));
    const leftEdge  = clampedX - BUBBLE_HALF_W - 8;  // 약간의 여유
    const rightEdge = clampedX + BUBBLE_HALF_W + 8;

    // 이 버블을 놓을 수 있는 가장 낮은 레벨 탐색
    let level = 0;
    while (level < levelRight.length && levelRight[level] > leftEdge) {
      level++;
    }
    levelRight[level] = rightEdge;
    result.set(cup.id, level);
  }

  return result;
}

/** 컵 배열과 각 컵의 X 중심 위치를 받아, 컵 위에 말풍선을 띄움 */
export default function FloatingMessageLayer({
  cupsWithPos,
  containerWidth,
}: {
  cupsWithPos: CupWithPos[];
  containerWidth: number;
}) {
  const levels = assignLevels(cupsWithPos, containerWidth);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {cupsWithPos.map((cup) => {
        if (!cup.message || !cup.messageAt) return null;
        const age = Date.now() - cup.messageAt;
        if (age > BUBBLE_LIFETIME_MS) return null;
        const level = levels.get(cup.id) ?? 0;
        return (
          <MessageBubble
            key={`${cup.id}-${cup.messageAt}`}
            cup={cup}
            age={age}
            containerWidth={containerWidth}
            level={level}
          />
        );
      })}
    </div>
  );
}

function MessageBubble({
  cup,
  age,
  containerWidth,
  level,
}: {
  cup: CupWithPos;
  age: number;
  containerWidth: number;
  level: number;
}) {
  const [opacity, setOpacity] = useState(1);
  const clampedLeft = Math.max(
    BUBBLE_HALF_W,
    Math.min(cup.centerX, (containerWidth || 9999) - BUBBLE_HALF_W)
  );

  // 레벨에 따른 추가 오프셋 (레벨 0 = 컵 바로 위, 1 = 한 단 위, ...)
  const extraBottom = level * (BUBBLE_EST_H + LEVEL_GAP);

  useEffect(() => {
    const remaining = BUBBLE_LIFETIME_MS - age;
    const fadeStart = remaining - 1500;

    const fadeTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setOpacity((o) => {
          if (o <= 0.05) { clearInterval(interval); return 0; }
          return o - 0.05;
        });
      }, 50);
      return () => clearInterval(interval);
    }, Math.max(0, fadeStart));

    return () => clearTimeout(fadeTimer);
  }, [age]);

  if (opacity === 0) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: `calc(100% + ${8 + extraBottom}px)`,
      left: clampedLeft,
      transform: "translateX(-50%)",
      opacity,
      animation: "bubblePop 0.25s ease-out",
      maxWidth: BUBBLE_MAX_W,
      zIndex: 10 + level,
      transition: "bottom 0.15s ease",
    }}>
      {/* 말풍선 몸체 */}
      <div style={{
        background: "white",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "3px 3px 0 rgba(0,0,0,0.3)",
        padding: "5px 10px",
        fontFamily: "'DotGothic16', monospace",
        fontSize: 11,
        color: "hsl(30 25% 15%)",
        lineHeight: 1.6,
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        position: "relative",
      }}>
        {/* 닉네임 (레벨 1 이상에서만 표시 — 어느 컵 말인지 명확히) */}
        {level > 0 && (
          <div style={{
            fontSize: 9,
            color: cup.color,
            marginBottom: 2,
            fontWeight: "bold",
          }}>
            {cup.nickname.replace("Anonymous", "A")}
          </div>
        )}
        {cup.message}

        {/* 꼬리 — 모든 레벨 공통 */}
        <div style={{
          position: "absolute", bottom: -9, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
          borderTop: "9px solid hsl(30 25% 20%)",
        }} />
        <div style={{
          position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "4px solid transparent", borderRight: "4px solid transparent",
          borderTop: "6px solid white",
        }} />
      </div>
    </div>
  );
}
