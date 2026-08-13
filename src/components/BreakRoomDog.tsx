/**
 * BreakRoomDog — 탕비실 강아지 "누룽지"
 *
 * 고양이(탕비)와 같은 바닥을 쓰는 두 번째 상주 NPC.
 * 고양이가 앉아 있는 시간이 길다면 이쪽은 대체로 돌아다닌다.
 *
 * 소세지를 들고 탭하면 준다 — 자판기·전자레인지로 얻은 걸 쓸 데가 생긴다.
 *
 * zIndex 는 반드시 1 이하로 둔다. 컵 행이 zIndex 2, 빈 방 안내 문구가 3 인데
 * 예전에 고양이가 그 문구를 깔고 앉은 적이 있다 (커밋 d74f384).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

type DogState = "walk" | "sit" | "sniff" | "beg" | "sleep";

const PET_MSG_COOLDOWN_MS = 45_000;
/** 강아지가 받아먹는 것 */
const DOG_LIKES = new Set(["sausage", "burnt-sausage"]);

function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

/** 고양이보다 활동적이다 — 앉아 있기보다 돌아다니고 킁킁댄다 */
function pickNext(state: DogState): DogState {
  const r = Math.random();
  if (isNightNow()) return r < 0.55 ? "sleep" : r < 0.8 ? "sit" : "walk";
  switch (state) {
    case "walk":  return r < 0.35 ? "sniff" : r < 0.55 ? "sit" : "walk";
    case "sit":   return r < 0.5 ? "walk" : r < 0.75 ? "sniff" : r < 0.9 ? "beg" : "sit";
    case "sniff": return r < 0.65 ? "walk" : r < 0.85 ? "sit" : "sniff";
    case "beg":   return r < 0.6 ? "walk" : "sit";
    case "sleep": return r < 0.45 ? "sleep" : "walk";
  }
}

function stateDuration(state: DogState): number {
  switch (state) {
    case "walk":  return 0; // 이동 시간으로 결정
    case "sit":   return 2500 + Math.random() * 4000;
    case "sniff": return 2000 + Math.random() * 2500;
    case "beg":   return 3000 + Math.random() * 3000;
    case "sleep": return 9000 + Math.random() * 14000;
  }
}

export default function BreakRoomDog() {
  const { myCup, sendMessage, heldItem, clearHeld } = useBreakRoom();
  const [state, setState] = useState<DogState>("walk");
  // 고양이가 30% 에서 시작하니 반대편에서 시작한다
  const [pos, setPos] = useState(72);
  const [walkMs, setWalkMs] = useState(0);
  const [facingLeft, setFacingLeft] = useState(true);
  const [hearts, setHearts] = useState(0);
  const [chomp, setChomp] = useState(false);
  const lastPetMsg = useRef(0);
  const stateRef = useRef<DogState>("walk");
  const posRef = useRef(72);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      const next = pickNext(stateRef.current);
      stateRef.current = next;
      setState(next);
      if (next === "walk") {
        const cur = posRef.current;
        const target = 8 + Math.random() * 84;
        // 고양이(1% 당 90ms)보다 빠릿하다
        const dur = Math.max(1100, Math.abs(target - cur) * 62);
        setFacingLeft(target < cur);
        setWalkMs(dur);
        posRef.current = target;
        setPos(target);
        timer = setTimeout(step, dur + 250);
      } else {
        timer = setTimeout(step, stateDuration(next));
      }
    };
    timer = setTimeout(step, 1800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  /** 소세지를 들고 있으면 먹이주기, 아니면 쓰다듬기 */
  const tap = useCallback(() => {
    const food = heldItem && DOG_LIKES.has(heldItem.id) ? heldItem : null;

    if (food) {
      clearHeld();
      sound.play("bark");
      setChomp(true);
      setHearts((n) => n + 1);
      setTimeout(() => { setChomp(false); setHearts((n) => Math.max(0, n - 1)); }, 1400);
      // 먹이주기는 쿨다운 없이 항상 알린다 — 자주 있는 일이 아니다
      if (myCup) {
        sendMessage(
          food.id === "burnt-sausage"
            ? "탄 소세지 줬는데 잘 먹음 🐕"
            : "강아지한테 소세지 줌 🌭🐕",
        );
      }
      // 얻어먹었으면 잠깐 앉아서 꼬리 흔든다
      stateRef.current = "beg";
      setState("beg");
      return;
    }

    sound.play("bark");
    setHearts((n) => n + 1);
    setTimeout(() => setHearts((n) => Math.max(0, n - 1)), 1100);
    const now = Date.now();
    if (myCup && now - lastPetMsg.current > PET_MSG_COOLDOWN_MS) {
      lastPetMsg.current = now;
      sendMessage("강아지 쓰다듬음 🐕💕");
    }
  }, [heldItem, clearHeld, myCup, sendMessage]);

  const hasFood = !!heldItem && DOG_LIKES.has(heldItem.id);
  const emoji = state === "walk" ? "🐕" : "🐶";

  return (
    <div
      onClick={tap}
      title={hasFood ? "누룽지한테 소세지 주기 🌭" : "누룽지 (탕비실 강아지) — 쓰다듬기"}
      style={{
        position: "absolute",
        bottom: 4,
        left: `${pos}%`,
        transform: "translateX(-50%)",
        transition: state === "walk" ? `left ${walkMs}ms linear` : "none",
        cursor: "pointer",
        // 컵 행(2)·안내 문구(3)보다 아래여야 한다
        zIndex: 1,
        userSelect: "none",
        touchAction: "manipulation",
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {/* 하트 */}
      {hearts > 0 && (
        <div style={{
          position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 11, animation: "snackPop 1.1s ease-out forwards", pointerEvents: "none",
        }}>
          💕
        </div>
      )}
      {/* 소세지를 들고 있으면 알아채고 쳐다본다 */}
      {hasFood && !chomp && (
        <div style={{
          position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)",
          fontSize: 10, pointerEvents: "none", animation: "npcBounce 0.9s ease-in-out infinite",
        }}>
          🌭
        </div>
      )}
      {/* 먹는 중 */}
      {chomp && (
        <div style={{
          position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 11, animation: "snackPop 1.4s ease-out forwards", pointerEvents: "none",
        }}>
          😋
        </div>
      )}
      {/* 잘 때 */}
      {state === "sleep" && (
        <div style={{
          position: "absolute", top: -13, left: "72%",
          fontSize: 9, opacity: 0.75, animation: "steam 2.4s ease-in-out infinite", pointerEvents: "none",
        }}>
          💤
        </div>
      )}
      {/* 킁킁 */}
      {state === "sniff" && (
        <div style={{
          position: "absolute", top: -12, left: "70%",
          fontSize: 8, opacity: 0.7, pointerEvents: "none",
        }}>
          ᵕ̈
        </div>
      )}
      {/* 바깥 span: 방향 / 안쪽 span: 움직임 (transform 충돌 방지 — 고양이와 같은 구조) */}
      <span style={{
        display: "inline-block",
        transform: facingLeft ? "scaleX(-1)" : "none",
        filter: state === "sleep" ? "brightness(0.82)" : "none",
      }}>
        <span
          className={state === "walk" ? "npc-bounce" : state === "beg" ? "dog-wag" : undefined}
          style={{ display: "inline-block", fontSize: 19 }}
        >
          {emoji}
        </span>
      </span>
    </div>
  );
}
