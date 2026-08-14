/**
 * BreakRoomCat — 탕비실 고양이 "탕비"
 *
 * 카운터 위를 어슬렁거리는 상주 NPC. 동접자가 없어도 방에 생명감을 준다.
 * - 걷기 / 앉기 / 그루밍 / 잠자기 상태를 랜덤하게 오감
 * - 밤(23시~6시)에는 주로 잠
 * - 탭하면 골골송 💕 (+ 자리에 있으면 가끔 한마디 자동 발화)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { useRoomEvent } from "@/hooks/useRoomEvent";
import { sound } from "@/lib/sound";
import { loadBond, addBond, bondLevel, toNextStep, feedResult, claimSpot, setSpot, PET_NAME } from "@/lib/petMemory";

type CatState = "walk" | "sit" | "wash" | "sleep" | "flee";

const PET_MSG_COOLDOWN_MS = 45_000;

function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

/** 정이 붙으면(2단계) 덜 자고 더 움직인다.
 *  안 그러면 낮잠이 50초씩 이어져서 "곁에 온다" 는 보상이 화면에 안 나타난다. */
function pickNext(state: CatState, bonded: boolean): CatState {
  const r = Math.random();
  // 밤에도 정이 붙었으면 곁에 와서 잔다. 안 그러면 밤 손님은
  // 정을 아무리 쌓아도 보상을 못 본다 (늦게까지 남는 사람이 오히려 단골인데)
  if (isNightNow()) {
    if (bonded) return r < 0.45 ? "sleep" : r < 0.65 ? "sit" : "walk";
    return r < 0.7 ? "sleep" : r < 0.9 ? "sit" : "walk";
  }
  if (bonded) {
    switch (state) {
      case "walk":  return r < 0.5 ? "sit" : r < 0.8 ? "wash" : "walk";
      case "sit":   return r < 0.6 ? "walk" : r < 0.85 ? "wash" : r < 0.95 ? "sleep" : "sit";
      case "wash":  return r < 0.55 ? "walk" : "sit";
      case "sleep": return r < 0.3 ? "sleep" : "walk";
      case "flee":  return "sit";
    }
  }
  switch (state) {
    case "walk":  return r < 0.5 ? "sit" : r < 0.75 ? "wash" : "walk";
    case "sit":   return r < 0.45 ? "walk" : r < 0.7 ? "wash" : r < 0.9 ? "sleep" : "sit";
    case "wash":  return r < 0.6 ? "sit" : "walk";
    case "sleep": return r < 0.6 ? "sleep" : "sit";
    case "flee":  return "sit";
  }
}

function stateDuration(state: CatState, bonded: boolean): number {
  switch (state) {
    case "walk":  return 0; // 걷기는 이동 시간으로 결정
    case "sit":   return bonded ? 3000 + Math.random() * 4000 : 4000 + Math.random() * 7000;
    case "wash":  return 3000 + Math.random() * 3000;
    case "sleep": return bonded ? 6000 + Math.random() * 8000 : 12000 + Math.random() * 18000;
    case "flee":  return 1000;
  }
}

export default function BreakRoomCat({ myCupPct }: { myCupPct: number | null }) {
  const { myCup, sendMessage, heldItem, clearHeld, explosionAt } = useBreakRoom();
  const [state, setState] = useState<CatState>("sit");
  const [pos, setPos] = useState(30);        // 카운터 좌우 위치 (%)
  const [walkMs, setWalkMs] = useState(0);   // 현재 이동에 걸리는 시간
  const [facingLeft, setFacingLeft] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const [bond, setBond] = useState(() => loadBond("cat"));
  const lastPetMsg = useRef(0);
  const stateRef = useRef<CatState>("sit");
  const posRef = useRef(30);
  const cupPctRef = useRef<number | null>(myCupPct);
  cupPctRef.current = myCupPct;
  const bondRef = useRef(bond);
  bondRef.current = bond;

  const level = bondLevel(bond);

  const flash = useCallback((emoji: string, ms = 1100) => {
    setPop(emoji);
    setTimeout(() => setPop(null), ms);
  }, []);

  /** 정이 붙으면 자주 내 컵 옆에 와서 앉는다.
   *  강아지와 같은 자리를 고르지 않게 claimSpot 을 거친다. */
  const pickTarget = useCallback(() => claimSpot("cat", () => {
    const cup = cupPctRef.current;
    // 컵 왼쪽 — 강아지는 오른쪽에 선다
    if (cup !== null && bondLevel(bondRef.current) >= 2 && Math.random() < 0.62) return cup - 13;
    return 8 + Math.random() * 84;
  }), []);

  // 시작 자리도 등록해 둔다 — 안 그러면 잠든 채 한 번도 안 걸었을 때
  // 강아지가 이 자리를 비어 있다고 보고 위에 올라선다
  useEffect(() => { setSpot("cat", posRef.current); }, []);

  // 상태 머신 루프 (ref 기반 — setState 업데이터에 사이드이펙트 없음)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      const bonded = bondLevel(bondRef.current) >= 2;
      const next = pickNext(stateRef.current, bonded);
      stateRef.current = next;
      setState(next);
      if (next === "walk") {
        const cur = posRef.current;
        const target = pickTarget();
        const dur = Math.max(1500, Math.abs(target - cur) * 90);
        setFacingLeft(target < cur);
        setWalkMs(dur);
        posRef.current = target;
        setPos(target);
        timer = setTimeout(step, dur + 300);
      } else {
        timer = setTimeout(step, stateDuration(next, bonded));
      }
    };
    timer = setTimeout(step, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pickTarget]);

  /** 전자레인지가 터지면 놀라서 튄다 — 고양이가 제일 빠르다 */
  useRoomEvent(explosionAt, () => {
    stateRef.current = "flee";
    setState("flee");
    const away = posRef.current > 50 ? 94 : 6;
    setFacingLeft(away < posRef.current);
    setWalkMs(450);
    posRef.current = away;
    setPos(away);
    setSpot("cat", away);
    flash("💨", 900);
  });

  const pet = useCallback(() => {
    const item = heldItem;
    const verdict = item ? feedResult("cat", item.id) : "ignore";

    // 고양이는 따뜻한 것만 받는다. 나머지는 쳐다도 안 본다
    if (item && verdict === "ignore") {
      sound.play("blip");
      flash("…", 1100);
      return;
    }
    if (item && verdict === "eat") {
      clearHeld();
      sound.play("purr");
      flash("😻", 1400);
      setBond(addBond("cat", 2));
      if (myCup) sendMessage(`탕비한테 ${item.label} 줌 🐈`);
      return;
    }

    sound.play("purr");
    flash("💕", 1100);
    setBond(addBond("cat", 1));
    const now = Date.now();
    if (myCup && now - lastPetMsg.current > PET_MSG_COOLDOWN_MS) {
      lastPetMsg.current = now;
      sendMessage("고양이 쓰다듬음 🐈💕");
    }
  }, [heldItem, clearHeld, myCup, sendMessage, flash]);

  const wants = !!heldItem && feedResult("cat", heldItem.id) === "eat";
  const emoji = state === "walk" || state === "flee" ? "🐈" : "🐱";
  const remain = toNextStep(bond);

  return (
    <div
      onClick={pet}
      title={
        wants ? `탕비한테 ${heldItem!.label} 주기`
        : level === 0 ? "탕비실 고양이 — 쓰다듬기"
        : `${PET_NAME.cat} — 쓰다듬기${remain ? ` (${remain}번 더 챙기면 더 친해져요)` : " · 단짝"}`
      }
      style={{
        position: "absolute",
        bottom: 4,
        left: `${pos}%`,
        transform: "translateX(-50%)",
        transition: state === "walk" || state === "flee" ? `left ${walkMs}ms linear` : "none",
        cursor: "pointer",
        zIndex: 1,
        userSelect: "none",
        touchAction: "manipulation",
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {/* 반응 이모지 — 이름표가 붙으면 그만큼 위로 비켜준다 */}
      {pop && (
        <div style={{
          position: "absolute", top: level >= 1 ? -30 : -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 13, animation: "snackPop 1.2s ease-out forwards", pointerEvents: "none",
        }}>
          {pop}
        </div>
      )}
      {wants && !pop && (
        <div style={{
          position: "absolute", top: level >= 1 ? -29 : -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 12, pointerEvents: "none", animation: "npcBounce 0.9s ease-in-out infinite",
        }}>
          {heldItem!.emoji}
        </div>
      )}
      {/* 이름표 — 정이 붙어야 보인다 (발밑에 두면 카운터 앞면으로 삐져나간다) */}
      {level >= 1 && (
        <div style={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'DotGothic16', monospace", fontSize: 9, lineHeight: 1,
          padding: "1px 4px",
          background: "hsl(28 34% 20% / 0.72)",
          color: "hsl(38 55% 88%)", whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          {PET_NAME.cat}
        </div>
      )}
      {/* 잠잘 때 zzz */}
      {state === "sleep" && (
        <div style={{
          position: "absolute", top: level >= 1 ? -26 : -13, left: "76%",
          fontSize: 10, opacity: 0.8, animation: "steam 2.4s ease-in-out infinite", pointerEvents: "none",
        }}>
          💤
        </div>
      )}
      {/* 바깥 span: 방향 뒤집기 / 안쪽 span: 걷기 바운스 (transform 충돌 방지) */}
      <span style={{
        display: "inline-block",
        transform: facingLeft ? "scaleX(-1)" : "none",
        filter: state === "sleep" ? "brightness(0.82)" : "none",
      }}>
        <span
          className={state === "walk" || state === "flee" ? "npc-bounce" : undefined}
          style={{ display: "inline-block", fontSize: 20 }}
        >
          {emoji}
        </span>
      </span>
    </div>
  );
}
