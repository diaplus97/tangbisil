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
import { sound } from "@/lib/sound";

type CatState = "walk" | "sit" | "wash" | "sleep";

const PET_MSG_COOLDOWN_MS = 45_000;

function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

function pickNext(state: CatState): CatState {
  const r = Math.random();
  if (isNightNow()) return r < 0.7 ? "sleep" : r < 0.9 ? "sit" : "walk";
  switch (state) {
    case "walk":  return r < 0.5 ? "sit" : r < 0.75 ? "wash" : "walk";
    case "sit":   return r < 0.45 ? "walk" : r < 0.7 ? "wash" : r < 0.9 ? "sleep" : "sit";
    case "wash":  return r < 0.6 ? "sit" : "walk";
    case "sleep": return r < 0.6 ? "sleep" : "sit";
  }
}

function stateDuration(state: CatState): number {
  switch (state) {
    case "walk":  return 0; // 걷기는 이동 시간으로 결정
    case "sit":   return 4000 + Math.random() * 7000;
    case "wash":  return 3000 + Math.random() * 3000;
    case "sleep": return 12000 + Math.random() * 18000;
  }
}

export default function BreakRoomCat() {
  const { myCup, sendMessage } = useBreakRoom();
  const [state, setState] = useState<CatState>("sit");
  const [pos, setPos] = useState(30);        // 카운터 좌우 위치 (%)
  const [walkMs, setWalkMs] = useState(0);   // 현재 이동에 걸리는 시간
  const [facingLeft, setFacingLeft] = useState(false);
  const [hearts, setHearts] = useState(0);   // 💕 파티클 트리거
  const lastPetMsg = useRef(0);
  const stateRef = useRef<CatState>("sit");
  const posRef = useRef(30);

  // 상태 머신 루프 (ref 기반 — setState 업데이터에 사이드이펙트 없음)
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
        const dur = Math.max(1500, Math.abs(target - cur) * 90);
        setFacingLeft(target < cur);
        setWalkMs(dur);
        posRef.current = target;
        setPos(target);
        timer = setTimeout(step, dur + 300);
      } else {
        timer = setTimeout(step, stateDuration(next));
      }
    };
    timer = setTimeout(step, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const pet = useCallback(() => {
    sound.play("purr");
    setHearts((n) => n + 1);
    setTimeout(() => setHearts((n) => Math.max(0, n - 1)), 1100);
    const now = Date.now();
    if (myCup && now - lastPetMsg.current > PET_MSG_COOLDOWN_MS) {
      lastPetMsg.current = now;
      sendMessage("고양이 쓰다듬음 🐈💕");
    }
  }, [myCup, sendMessage]);

  const emoji = state === "walk" ? "🐈" : "🐱";

  return (
    <div
      onClick={pet}
      title="탕비 (탕비실 고양이) — 쓰다듬기"
      style={{
        position: "absolute",
        bottom: 4,
        left: `${pos}%`,
        transform: "translateX(-50%)",
        transition: state === "walk" ? `left ${walkMs}ms linear` : "none",
        cursor: "pointer",
        zIndex: 1,
        userSelect: "none",
        touchAction: "manipulation",
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {/* 하트 파티클 */}
      {hearts > 0 && (
        <div style={{
          position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 11, animation: "snackPop 1.1s ease-out forwards", pointerEvents: "none",
        }}>
          💕
        </div>
      )}
      {/* 잠잘 때 zzz */}
      {state === "sleep" && (
        <div style={{
          position: "absolute", top: -13, left: "72%",
          fontSize: 9, opacity: 0.75, animation: "steam 2.4s ease-in-out infinite", pointerEvents: "none",
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
          className={state === "walk" ? "npc-bounce" : undefined}
          style={{ display: "inline-block", fontSize: 20 }}
        >
          {emoji}
        </span>
      </span>
    </div>
  );
}
