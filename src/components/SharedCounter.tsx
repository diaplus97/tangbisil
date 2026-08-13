import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useBreakRoom, type ActiveCup } from "@/context/BreakRoomContext";
import CupPresence from "./CupPresence";
import FloatingMessageLayer from "./FloatingMessageLayer";
import BreakRoomCat from "./BreakRoomCat";
import BreakRoomDog from "./BreakRoomDog";
import { sound } from "@/lib/sound";

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
  const { cups, coldCups, myCup, sendMessage, giftMode, giveTo, heldItem, incomingGift, dismissGift } = useBreakRoom();
  const counterRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [cupPositions, setCupPositions] = useState<number[]>([]);

  // 표시 순서: 식은 컵(오래된 것부터) → 살아있는 컵 — 시간이 왼쪽으로 흘러가는 느낌
  const displayCups: ActiveCup[] = useMemo(
    () => [...coldCups.slice().reverse(), ...cups],
    [cups, coldCups],
  );

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

  // 컵 위치는 재서 쓴다.
  //
  // 예전엔 "컵 하나에 76px" 이라고 가정하고 계산했는데, 실제 컵은 44px 간격이라
  // 말풍선 꼬리가 엉뚱한 컵을 가리켰다. 컵 디자인이 바뀔 때마다 어긋나는 구조였다.
  // flex 가 배치를 끝낸 뒤 DOM 에서 직접 중심을 읽으면 그런 일이 없다.
  useLayoutEffect(() => {
    const root = counterRef.current;
    if (!root) return;

    const measure = () => {
      const base = root.getBoundingClientRect();
      const next = displayCups.map((c) => {
        const el = root.querySelector<HTMLElement>(`[data-cup="${CSS.escape(c.id)}"]`);
        if (!el) return base.width / 2;
        const r = el.getBoundingClientRect();
        return r.left - base.left + r.width / 2;
      });
      setCupPositions((prev) =>
        prev.length === next.length && prev.every((v, i) => Math.abs(v - next[i]) < 0.5)
          ? prev
          : next,
      );
    };

    measure();
    // 폰트가 늦게 붙거나 컵이 줄바꿈되면 위치가 바뀐다
    const obs = new ResizeObserver(measure);
    obs.observe(root);
    return () => obs.disconnect();
  }, [displayCups, containerWidth]);

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

  // 식은 컵 판별용 ID 셋
  const coldIds = useMemo(() => new Set(coldCups.map((c) => c.id)), [coldCups]);

  const handleCupClick = useCallback((cup: ActiveCup, idx: number) => {
    const centerX = cupPositions[idx] ?? containerWidth / 2;

    if (coldIds.has(cup.id)) {
      // 식은 컵: 살짝 흔들리기만 (결투 대상 아님)
      jiggle(cup.id);
      sound.play("blip");
      return;
    }

    // 선물 모드 — 결투보다 우선한다 (물건을 들고 있을 때만 켜진다)
    if (giftMode && heldItem && !cup.isMe) {
      jiggle(cup.id);
      giveTo(cup);
      return;
    }

    if (cup.isMe) {
      // 내 컵: 흔들림 + 무장 토글
      jiggle(cup.id);
      sound.play("blip");
      setIsArmed((a) => !a);
      return;
    }

    if (isArmed && myCup) {
      // 결투! — 상대 컵 히트 애니메이션 + 폭발 + 메시지
      setIsArmed(false);
      setHitId(cup.id);
      setTimeout(() => setHitId(null), 780);
      sound.play("boom");

      // 폭발은 두 컵 사이 중간 지점
      const myCupIdx = displayCups.findIndex((c) => c.isMe);
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
    sound.play("blip");
  }, [displayCups, coldIds, cupPositions, containerWidth, isArmed, myCup, jiggle, sendMessage, giftMode, heldItem, giveTo]);

  const cupsWithPos = displayCups.map((c, i) => ({ ...c, centerX: cupPositions[i] ?? containerWidth / 2 }));

  // 정이 붙은 고양이/강아지가 내 컵 옆으로 오려면 컵이 어디 있는지 알아야 한다
  const myCupPct = (() => {
    const i = displayCups.findIndex((c) => c.isMe);
    if (i < 0 || !containerWidth || cupPositions[i] == null) return null;
    return (cupPositions[i] / containerWidth) * 100;
  })();

  return (
    <div style={{ width: "100%", flexShrink: 0 }}>
      {/* 카운터 후면 판자 (배경 깊이감) */}
      <div style={{ height: 8, background: "hsl(28 40% 22%)", width: "100%" }} />

      {/* 컵 영역 + 말풍선
          — 아무도 없을 땐 낮게. 컵이 놓이면 그만큼 자란다.
            혼자 있을 때 화면의 1/4 이 빈 갈색 벽인 건 낭비다 */}
      <div ref={counterRef} style={{
        position: "relative",
        minHeight: displayCups.length === 0 ? 60 : 96,
        transition: "min-height 0.35s cubic-bezier(0.3, 1.1, 0.5, 1)",
        background: "hsl(28 42% 36%)",
        borderTop: "3px solid hsl(28 35% 24%)",
      }}>
        {/* 카운터 상면 질감 */}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(0,0,0,0.04) 60px, rgba(0,0,0,0.04) 61px)" }} />

        <FloatingMessageLayer cupsWithPos={cupsWithPos} containerWidth={containerWidth} />

        {/* 누가 나한테 뭔가 줬을 때 */}
        {incomingGift && (
          <GiftToast key={incomingGift.key} gift={incomingGift} onDone={dismissGift} />
        )}

        {/* 탕비실 고양이 */}
        <BreakRoomCat myCupPct={myCupPct} />
        <BreakRoomDog myCupPct={myCupPct} />

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
          padding: displayCups.length === 0 ? "8px 16px 6px" : "10px 16px 6px",
          minHeight: displayCups.length === 0 ? 54 : 90,
          transition: "min-height 0.35s cubic-bezier(0.3, 1.1, 0.5, 1)",
          // 고양이(zIndex 1)보다 위 — 안 그러면 안내 문구를 깔고 앉는다
          position: "relative", zIndex: 2,
        }}>
          {displayCups.length === 0 && (
            <div style={{
              width: "100%", textAlign: "center",
              fontFamily: "'DotGothic16', monospace", fontSize: 11,
              color: "hsl(38 40% 78%)",
              // 이 줄은 flex-end 로 깔리면 고양이(바닥을 돌아다닌다)와 겹친다.
              // 위로 올려서 고양이 머리 위를 비켜준다.
              alignSelf: "flex-start",
              position: "relative", zIndex: 3,
              textShadow: "0 1px 0 hsl(28 42% 26%)",
            }}>
              아직 아무도 없어요... 커피 한잔 내려볼까요? ☕
            </div>
          )}
          {displayCups.length > 0 && cups.length === 0 && (
            <div style={{
              position: "absolute", top: 6, left: 0, right: 0, textAlign: "center",
              fontFamily: "'DotGothic16', monospace", fontSize: 9,
              color: "hsl(38 35% 70%)", pointerEvents: "none",
            }}>
              지금은 아무도 없어요 — 컵들이 식어가는 중...
            </div>
          )}
          {displayCups.map((cup, i) => (
            <CupPresence
              key={cup.id}
              cup={cup}
              showSteam={cup.isMe && showMysteam}
              isArmed={cup.isMe && isArmed}
              isJiggling={jigglingId === cup.id}
              isHit={hitId === cup.id}
              canAttack={isArmed && !cup.isMe && !!myCup && !coldIds.has(cup.id)}
              isCold={coldIds.has(cup.id)}
              isGiftTarget={giftMode && !!heldItem && !cup.isMe && !coldIds.has(cup.id)}
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


/* ─── 받은 선물 토스트 ───────────────────────────────────── */
function GiftToast({ gift, onDone }: {
  gift: NonNullable<ReturnType<typeof useBreakRoom>["incomingGift"]>;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="panel-up"
      style={{
        position: "absolute",
        left: "50%", top: 8,
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px",
        background: "hsl(38 55% 92%)",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "3px 3px 0 rgba(0,0,0,0.35)",
        fontFamily: "'DotGothic16', monospace",
        zIndex: 20,
        maxWidth: "92%",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{gift.item.emoji}</span>
      <span style={{ fontSize: 11, color: "hsl(30 25% 22%)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <b style={{ color: gift.fromColor }}>{gift.fromNick}</b>
        님이 {gift.item.label}을(를) 건네주었습니다
        {gift.flavor && <span style={{ color: "hsl(28 45% 40%)" }}> — {gift.flavor}</span>}
      </span>
    </div>
  );
}
