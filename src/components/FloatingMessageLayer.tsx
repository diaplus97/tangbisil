/**
 * FloatingMessageLayer — 컵 위에 뜨는 하소연 말풍선
 *
 * 예전엔 말풍선이 위로 무한정 쌓여서, 다섯 명만 떠들어도 흡연실 문·커피머신·
 * 자판기가 전부 가려졌다. 하소연하러 온 공간인데 하소연이 방을 잡아먹었다.
 *
 * 그래서 두 가지를 못 박았다:
 *  - 최대 2단까지만 쌓는다. 넘치면 안 띄운다 (아래 "최근:" 줄에는 그대로 남는다)
 *  - 가로도 화면 안으로 물린다. 예전엔 왼쪽 말풍선이 x0 까지 밀려서
 *    꼬리가 엉뚱한 곳을 가리켰다
 *
 * 수명은 6초에서 11초로 늘렸다. 남의 하소연을 읽을 시간은 됐어야 했다.
 * 페이드는 CSS 로 넘겼다 — 예전엔 말풍선마다 50ms 간격 setInterval 로
 * opacity 를 깎아서, 하나당 20번씩 리렌더가 돌았다.
 */
import { useEffect, useState } from "react";
import { type ActiveCup } from "@/context/BreakRoomContext";

const BUBBLE_LIFETIME_MS = 11_000;
/** 폰에서는 좁혀야 두어 개라도 나란히 들어간다 */
function bubbleWidth(containerWidth: number): number {
  return containerWidth && containerWidth < 520 ? 132 : 150;
}
const BUBBLE_EST_H = 62;
const LEVEL_GAP = 8;
/** 이보다 높이 쌓지 않는다 — 방을 가리는 것보다 안 보이는 게 낫다 */
const MAX_LEVEL = 1;
/** 화면 가장자리에서 최소한 이만큼은 띄운다 */
const EDGE_PAD = 6;

type CupWithPos = ActiveCup & { centerX: number };

type Placed = { cup: CupWithPos; level: number; left: number; age: number; width: number };

/**
 * 겹치지 않게 말풍선 자리를 잡는다.
 * 최신 순으로 훑으면서, 가로로 안 겹치는 가장 낮은 단에 넣는다.
 * MAX_LEVEL 을 넘으면 자리를 못 얻고 화면에서 빠진다.
 */
function place(cups: CupWithPos[], cw: number, now: number): Placed[] {
  // 최신 순으로 자리를 준다. 자리가 모자랄 때 밀려나야 하는 건 오래된 쪽이다.
  // (예전엔 X 좌표 순이라, 왼쪽에 앉은 사람의 옛날 하소연이 방금 올라온 걸 밀어냈다)
  const active = cups
    .filter((c) => c.message && c.messageAt && now - c.messageAt <= BUBBLE_LIFETIME_MS)
    .sort((a, b) => (b.messageAt ?? 0) - (a.messageAt ?? 0));

  const width = cw || 9999;
  const halfW = bubbleWidth(cw) / 2;
  const minX = halfW + EDGE_PAD;
  const maxX = Math.max(minX, width - halfW - EDGE_PAD);

  // 레벨마다 이미 찬 가로 구간들
  const taken: Array<Array<[number, number]>> = [];
  const out: Placed[] = [];

  for (const cup of active) {
    const left = Math.max(minX, Math.min(cup.centerX, maxX));
    const l = left - halfW - 8;
    const r = left + halfW + 8;

    let level = 0;
    while (level <= MAX_LEVEL && taken[level]?.some(([a, b]) => l < b && r > a)) level++;
    // 자리가 없으면 포기 — 위로 더 쌓지 않는다 (아래 "최근:" 줄에는 남는다)
    if (level > MAX_LEVEL) continue;

    (taken[level] ??= []).push([l, r]);
    out.push({ cup, level, left, age: now - (cup.messageAt ?? now), width: halfW * 2 });
  }
  return out;
}

/** 컵 배열과 각 컵의 X 중심 위치를 받아, 컵 위에 말풍선을 띄움 */
export default function FloatingMessageLayer({
  cupsWithPos,
  containerWidth,
}: {
  cupsWithPos: CupWithPos[];
  containerWidth: number;
}) {
  // 말풍선이 제 때 사라지려면 시간이 흐르는 걸 누군가는 알려줘야 한다.
  // (예전엔 다른 이유로 리렌더가 일어날 때까지 화면에 남아 있었다)
  const [, tick] = useState(0);
  const hasLive = cupsWithPos.some(
    (c) => c.message && c.messageAt && Date.now() - c.messageAt <= BUBBLE_LIFETIME_MS,
  );
  useEffect(() => {
    if (!hasLive) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [hasLive]);

  const placed = place(cupsWithPos, containerWidth, Date.now());

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {placed.map((p) => (
        <MessageBubble key={`${p.cup.id}-${p.cup.messageAt}`} {...p} />
      ))}
    </div>
  );
}

function MessageBubble({ cup, age, level, left, width }: Placed) {
  const extraBottom = level * (BUBBLE_EST_H + LEVEL_GAP);

  return (
    <div style={{
      position: "absolute",
      bottom: `calc(100% + ${8 + extraBottom}px)`,
      left,
      maxWidth: width,
      zIndex: 10 + level,
      // 뜨고 → 머물고 → 사라지는 걸 CSS 한 줄에 맡긴다.
      // 음수 delay 로 "이미 age 만큼 지난 상태"부터 재생한다
      // (새로고침해서 들어와도 남은 시간만큼만 보인다)
      animation: `bubbleLife ${BUBBLE_LIFETIME_MS}ms linear both`,
      animationDelay: `-${age}ms`,
    }}>
      <div style={{
        background: "white",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "3px 3px 0 rgba(0,0,0,0.3)",
        padding: "5px 9px",
        fontFamily: "'DotGothic16', monospace",
        fontSize: 11,
        color: "hsl(30 25% 15%)",
        lineHeight: 1.55,
        wordBreak: "break-word",
        overflowWrap: "break-word",
        position: "relative",
      }}>
        {/* 누구 말인지 항상 보여준다 — 예전엔 2단부터만 이름이 붙어서
            1단 말풍선은 꼬리로만 주인을 찾아야 했다 */}
        <div style={{ fontSize: 9, color: cup.color, marginBottom: 1, fontWeight: "bold" }}>
          {cup.nickname.replace("Anonymous", "A")}
        </div>
        {cup.message}

        {/* 꼬리 */}
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
