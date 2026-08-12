import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import CupPresence from "./CupPresence";
import FloatingMessageLayer from "./FloatingMessageLayer";

const BATTLE_MSGS = (me: string, them: string): string[] => [
  `${me} ⚔️ ${them} 결투 신청!`,
  `${me} 님이 ${them} 님 컵 툭 건드림 ⚡`,
  `${me} 님 공격! ${them} 님 방어!`,
  `${me} 💥 ${them} 충돌!`,
  `${me} 님이 ${them} 님한테 싸움 걸었다 😤`,
  `어이쿠! ${me} → ${them} 도발!`,
];

/** 공용 카운터 — 더 크고 묵직하게 */
export default function SharedCounter() {
  const { cups, myCup, sendMessage } = useBreakRoom();
  const counterRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [cupPositions, setCupPositions] = useState<number[]>([]);

  // 컵 상호작용 상태
  const [isArmed, setIsArmed]         = useState(false);
  const [jigglingId, setJigglingId]   = useState<string | null>(null);
  const [hitId, setHitId]             = useState<string | null>(null);
  const [explosionAt, setExplosionAt] = useState<{ x: number; y: number } | null>(null);

  const myCupBrewedAt = useRef<number | null>(null);
  const [showMysteam, setShowMysteam] = useState(false);

  useLayoutEffect(() => {
    if (!counterRef.current) return;
    const obs = new ResizeObserver((e) => setContainerWidth(e[0].contentRect.width));
    obs.observe(counterRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (containerWidth === 0 || cups.length === 0) return;
    const CUP_W = 76;
    const spacing = Math.min(CUP_W, (containerWidth - 32) / cups.length);
    const total = spacing * cups.length;
    const startX = (containerWidth - total) / 2 + spacing / 2;
    setCupPositions(cups.map((_, i) => startX + i * spacing));
  }, [cups, containerWidth]);

  useEffect(() => {
    const mine = cups.find((c) => c.isMe);
    if (mine && myCupBrewedAt.current === null) {
      myCupBrewedAt.current = Date.now();
      setShowMysteam(true);
      setTimeout(() => setShowMysteam(false), 35000);
    }
  }, [cups]);

  // 내 컵이 사라지면 무장 해제
  useEffect(() => {
    if (!myCup) setIsArmed(false);
  }, [myCup]);

  const jiggle = useCallback((id: string) => {
    setJigglingId(id);
    setTimeout(() => setJigglingId(null), 580);
  }, []);

  const handleCupClick = useCallback((cup: typeof cups[0], idx: number) => {
    const centerX = cupPositions[idx] ?? containerWidth / 2;

    if (cup.isMe) {
      // 내 컵: 흔들림 + 무장 토글
      jiggle(cup.id);
      setIsArmed((a) => !a);
      return;
    }

    if (isArmed && myCup) {
      // 결투! — 상대 컵 히트 애니메이션 + 폭발 + 메시지
      setIsArmed(false);
      setHitId(cup.id);
      setTimeout(() => setHitId(null), 780);

      // 폭발은 두 컵 사이 중간 지점
      const myCupIdx = cups.findIndex((c) => c.isMe);
      const myCenterX = cupPositions[myCupIdx] ?? containerWidth / 2;
      setExplosionAt({ x: (myCenterX + centerX) / 2, y: 52 });
      setTimeout(() => setExplosionAt(null), 920);

      const me   = myCup.nickname.replace("Anonymous", "A");
      const them = cup.nickname.replace("Anonymous", "A");
      const msgs = BATTLE_MSGS(me, them);
      sendMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      return;
    }

    // 남의 컵: 그냥 흔들기
    jiggle(cup.id);
  }, [cups, cupPositions, containerWidth, isArmed, myCup, jiggle, sendMessage]);

  const cupsWithPos = cups.map((c, i) => ({ ...c, centerX: cupPositions[i] ?? containerWidth / 2 }));

  return (
    <div style={{ width: "100%", flexShrink: 0 }}>
      {/* 카운터 후면 판자 (배경 깊이감) */}
      <div style={{ height: 8, background: "hsl(28 40% 22%)", width: "100%" }} />

      {/* 컵 영역 + 말풍선 */}
      <div ref={counterRef} style={{
        position: "relative",
        minHeight: 128,
        background: "hsl(28 42% 36%)",
        borderTop: "3px solid hsl(28 35% 24%)",
      }}>
        {/* 카운터 상면 질감 */}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(0,0,0,0.04) 60px, rgba(0,0,0,0.04) 61px)" }} />

        <FloatingMessageLayer cupsWithPos={cupsWithPos} containerWidth={containerWidth} />

        {/* 결투 폭발 이펙트 */}
        {explosionAt && (
          <div
            className="battle-explosion"
            style={{
              position: "absolute",
              left: explosionAt.x,
              top: explosionAt.y,
              fontSize: 30,
              zIndex: 20,
              pointerEvents: "none",
            }}>
            💥
          </div>
        )}

        <div style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: cups.length > 0 ? "center" : "flex-start",
          flexWrap: "wrap",
          gap: 6,
          padding: "16px 16px 6px",
          minHeight: 122,
          position: "relative",
        }}>
          {cups.length === 0 && (
            <div style={{
              width: "100%", textAlign: "center",
              fontFamily: "'DotGothic16', monospace", fontSize: 11,
              color: "hsl(38 40% 75%)", paddingTop: 32,
            }}>
              아직 아무도 없어요... 커피 한잔 내려볼까요? ☕
            </div>
          )}
          {cups.map((cup, i) => (
            <CupPresence
              key={cup.id}
              cup={cup}
              showSteam={cup.isMe && showMysteam}
              isArmed={cup.isMe && isArmed}
              isJiggling={jigglingId === cup.id}
              isHit={hitId === cup.id}
              canAttack={isArmed && !cup.isMe && !!myCup}
              onClick={() => handleCupClick(cup, i)}
            />
          ))}
        </div>
      </div>

      {/* 카운터 앞면 (두껍고 진한 가장자리) */}
      <div style={{
        height: 28,
        background: "hsl(28 44% 28%)",
        borderTop: "5px solid hsl(28 34% 18%)",
        borderBottom: "4px solid hsl(28 34% 16%)",
        boxShadow: "0 5px 0 rgba(0,0,0,0.4)",
        position: "relative",
      }}>
        {[8, 22, 38, 52, 68, 82, 92].map((p) => (
          <div key={p} style={{ position: "absolute", top: 8, left: `${p}%`, width: "6%", height: 3, background: "rgba(0,0,0,0.14)", borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ height: 14, background: "hsl(28 38% 22%)" }} />
    </div>
  );
}
