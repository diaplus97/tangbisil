/**
 * BreakRoomDog — 탕비실 강아지 "누룽지"
 *
 * 고양이(탕비)와 같은 바닥을 쓰는 두 번째 상주 NPC.
 * 고양이가 앉아 있는 시간이 길다면 이쪽은 대체로 돌아다닌다.
 *
 * 탭 한 번이 전부면 금방 질린다. 그래서 정(bond)을 쌓게 했다 —
 * 쓰다듬고 먹이면 이름을 알게 되고, 내 컵 옆으로 오고, 결국 뭘 물어다 준다.
 *
 * zIndex 는 반드시 1 이하로 둔다. 컵 행이 2, 빈 방 안내 문구가 3 인데
 * 예전에 고양이가 그 문구를 깔고 앉은 적이 있다 (커밋 d74f384).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { useRoomEvent } from "@/hooks/useRoomEvent";
import { sound } from "@/lib/sound";
import {
  loadBond, addBond, bondLevel, toNextStep, feedResult, claimSpot, setSpot, PET_NAME, FETCHABLE,
} from "@/lib/petMemory";

type DogState = "walk" | "sit" | "sniff" | "beg" | "sleep" | "flee";

const PET_MSG_COOLDOWN_MS = 45_000;
/** 정이 3단계일 때, 이 간격마다 뭘 물어올지 굴린다 */
const FETCH_ROLL_MS = 90_000;
const FETCH_CHANCE = 0.35;

function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

/** 고양이보다 활동적이다 — 앉아 있기보다 돌아다니고 킁킁댄다 */
function pickNext(state: DogState, bonded: boolean): DogState {
  const r = Math.random();
  // 밤에도 정이 붙었으면 곁으로 온다 (고양이와 같은 이유)
  if (isNightNow()) {
    if (bonded) return r < 0.35 ? "sleep" : r < 0.55 ? "sit" : "walk";
    return r < 0.55 ? "sleep" : r < 0.8 ? "sit" : "walk";
  }
  switch (state) {
    case "walk":  return r < 0.35 ? "sniff" : r < 0.55 ? "sit" : "walk";
    case "sit":   return r < 0.5 ? "walk" : r < 0.75 ? "sniff" : r < 0.9 ? "beg" : "sit";
    case "sniff": return r < 0.65 ? "walk" : r < 0.85 ? "sit" : "sniff";
    case "beg":   return r < 0.6 ? "walk" : "sit";
    case "sleep": return r < 0.45 ? "sleep" : "walk";
    case "flee":  return "walk";
  }
}

function stateDuration(state: DogState): number {
  switch (state) {
    case "walk":  return 0;
    case "sit":   return 2500 + Math.random() * 4000;
    case "sniff": return 2000 + Math.random() * 2500;
    case "beg":   return 3000 + Math.random() * 3000;
    case "sleep": return 9000 + Math.random() * 14000;
    case "flee":  return 900;
  }
}

export default function BreakRoomDog({ myCupPct }: { myCupPct: number | null }) {
  const { myCup, sendMessage, heldItem, clearHeld, pickUp, explosionAt } = useBreakRoom();
  const [state, setState] = useState<DogState>("walk");
  // 고양이가 30% 에서 시작하니 반대편에서 시작한다
  const [pos, setPos] = useState(72);
  const [walkMs, setWalkMs] = useState(0);
  const [facingLeft, setFacingLeft] = useState(true);
  const [pop, setPop] = useState<string | null>(null);
  const [bond, setBond] = useState(() => loadBond("dog"));

  const lastPetMsg = useRef(0);
  const stateRef = useRef<DogState>("walk");
  const posRef = useRef(72);
  const cupPctRef = useRef<number | null>(myCupPct);
  cupPctRef.current = myCupPct;
  const bondRef = useRef(bond);
  bondRef.current = bond;

  const level = bondLevel(bond);

  const flash = useCallback((emoji: string, ms = 1200) => {
    setPop(emoji);
    setTimeout(() => setPop(null), ms);
  }, []);

  /** 목적지 — 정이 2단계 이상이면 자주 내 컵 옆으로 간다.
   *  고양이와 같은 자리를 고르지 않게 claimSpot 을 거친다. */
  const pickTarget = useCallback(() => claimSpot("dog", () => {
    const cup = cupPctRef.current;
    // 컵 오른쪽에 선다 — 고양이는 왼쪽에 세운다
    if (cup !== null && bondLevel(bondRef.current) >= 2 && Math.random() < 0.55) return cup + 13;
    return 8 + Math.random() * 84;
  }), []);

  // 시작 자리 등록 (고양이와 같은 이유 — 등록 안 된 자리는 빈 자리로 보인다)
  useEffect(() => { setSpot("dog", posRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      const next = pickNext(stateRef.current, bondLevel(bondRef.current) >= 2);
      stateRef.current = next;
      setState(next);
      if (next === "walk") {
        const cur = posRef.current;
        const target = pickTarget();
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
  }, [pickTarget]);

  /** 전자레인지가 터지면 놀라서 구석으로 튄다 */
  useRoomEvent(explosionAt, () => {
    stateRef.current = "flee";
    setState("flee");
    // 고양이는 구석(94/6)까지 튄다. 같은 쪽으로 도망쳐도 겹치지 않게 한 칸 앞에 선다
    const away = posRef.current > 50 ? 80 : 20;
    setFacingLeft(away < posRef.current);
    setWalkMs(600);
    posRef.current = away;
    setPos(away);
    setSpot("dog", away);
    flash("💨", 1000);
  });

  /** 정이 깊으면 가끔 뭘 물어다 준다.
   *  단 손이 비었을 때만 — pickUp 은 들고 있던 걸 덮어쓴다.
   *  깎던 사과가 강아지 때문에 사라지면 그건 선물이 아니라 사고다. */
  const heldRef = useRef(heldItem);
  heldRef.current = heldItem;
  useEffect(() => {
    if (level < 3) return;
    const t = setInterval(() => {
      if (!myCup || heldRef.current || Math.random() >= FETCH_CHANCE) return;
      const item = FETCHABLE[Math.floor(Math.random() * FETCHABLE.length)];
      pickUp({ id: item.id, emoji: item.emoji, label: item.label });
      sound.play("bark");
      flash(item.emoji, 1600);
      sendMessage(`누룽지가 ${item.label} 물어다 줌 🐕`);
    }, FETCH_ROLL_MS);
    return () => clearInterval(t);
  }, [level, myCup, pickUp, sendMessage, flash]);

  const tap = useCallback(() => {
    const item = heldItem;
    const verdict = item ? feedResult("dog", item.id) : "ignore";

    // ── 먹이 ──
    if (item && verdict === "refuse") {
      // 초콜릿은 개한테 위험하다 — 안 먹는다
      sound.play("blip");
      flash("🙅", 1400);
      if (myCup) sendMessage("초콜릿은 개가 먹으면 안 된대 🍫🐕");
      return;
    }
    if (item && verdict === "eat") {
      clearHeld();
      sound.play("bark");
      flash("😋", 1400);
      const next = addBond("dog", 2);
      setBond(next);
      stateRef.current = "beg";
      setState("beg");
      if (myCup) {
        sendMessage(
          item.id === "burnt-sausage" ? "탄 소세지 줬는데 잘 먹음 🐕"
          : `누룽지한테 ${item.label} 줌 🐕`,
        );
      }
      return;
    }

    // ── 쓰다듬기 ──
    sound.play("bark");
    flash("💕", 1100);
    const next = addBond("dog", 1);
    setBond(next);
    const now = Date.now();
    if (myCup && now - lastPetMsg.current > PET_MSG_COOLDOWN_MS) {
      lastPetMsg.current = now;
      sendMessage("강아지 쓰다듬음 🐕💕");
    }
  }, [heldItem, clearHeld, myCup, sendMessage, flash]);

  const wants = !!heldItem && feedResult("dog", heldItem.id) === "eat";
  const emoji = state === "walk" || state === "flee" ? "🐕" : "🐶";
  const remain = toNextStep(bond);

  return (
    <div
      onClick={tap}
      title={
        wants ? `누룽지한테 ${heldItem!.label} 주기`
        : level === 0 ? "탕비실 강아지 — 쓰다듬기"
        : `${PET_NAME.dog} — 쓰다듬기${remain ? ` (${remain}번 더 챙기면 더 친해져요)` : " · 단짝"}`
      }
      style={{
        position: "absolute",
        bottom: 4,
        left: `${pos}%`,
        transform: "translateX(-50%)",
        transition: state === "walk" || state === "flee" ? `left ${walkMs}ms linear` : "none",
        cursor: "pointer",
        // 컵 행(2)·안내 문구(3)보다 아래여야 한다
        zIndex: 1,
        userSelect: "none",
        touchAction: "manipulation",
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {/* 반응 이모지 (하트 / 먹는 중 / 거부 / 물어온 것)
          이름표가 머리 위에 붙으면 그만큼 더 올려서 겹치지 않게 한다 */}
      {pop && (
        <div style={{
          position: "absolute", top: level >= 1 ? -30 : -17, left: "50%", transform: "translateX(-50%)",
          fontSize: 13, animation: "snackPop 1.3s ease-out forwards", pointerEvents: "none",
        }}>
          {pop}
        </div>
      )}
      {/* 먹을 걸 들고 있으면 알아채고 쳐다본다 */}
      {wants && !pop && (
        <div style={{
          position: "absolute", top: level >= 1 ? -29 : -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 12, pointerEvents: "none", animation: "npcBounce 0.9s ease-in-out infinite",
        }}>
          {heldItem!.emoji}
        </div>
      )}
      {state === "sleep" && (
        <div style={{
          position: "absolute", top: level >= 1 ? -26 : -13, left: "76%",
          fontSize: 10, opacity: 0.8, animation: "steam 2.4s ease-in-out infinite", pointerEvents: "none",
        }}>
          💤
        </div>
      )}
      {state === "sniff" && (
        <div style={{
          position: "absolute", top: level >= 1 ? -25 : -12, left: "74%",
          fontSize: 9, opacity: 0.75, pointerEvents: "none",
        }}>
          ᵕ̈
        </div>
      )}

      {/* 이름표 — 정이 붙어야 보인다.
          발밑에 두면 카운터 앞면으로 4px 삐져나간다 (재봤다). 머리 위가 맞다.
          더 올리면 컵 행(zIndex 2) 뒤로 숨는다 — 겹침은 높이가 아니라
          좌우로 푼다 (고양이는 컵 왼쪽, 강아지는 오른쪽). */}
      {level >= 1 && (
        <div style={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'DotGothic16', monospace", fontSize: 9, lineHeight: 1,
          padding: "1px 4px",
          background: "hsl(28 34% 20% / 0.72)",
          color: "hsl(38 55% 88%)", whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          {PET_NAME.dog}
        </div>
      )}

      {/* 바깥 span: 방향 / 안쪽 span: 움직임 (transform 충돌 방지 — 고양이와 같은 구조) */}
      <span style={{
        display: "inline-block",
        transform: facingLeft ? "scaleX(-1)" : "none",
        filter: state === "sleep" ? "brightness(0.82)" : "none",
      }}>
        <span
          className={
            state === "walk" || state === "flee" ? "npc-bounce"
            : state === "beg" ? "dog-wag" : undefined
          }
          style={{ display: "inline-block", fontSize: 19 }}
        >
          {emoji}
        </span>
      </span>
    </div>
  );
}
