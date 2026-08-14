/**
 * BananaRaceGame — 탕비실 복도 레이싱
 *
 * 사과깎기는 "누르고 있기"(정밀 유지), 오렌지는 "긋기"(반사신경).
 * 세 번째가 또 같은 근육을 쓰면 재탕이라, 이쪽은 "계속 피하기" 로 잡았다.
 *
 * 카트는 내 컵이다. 방에서 내 정체성이 컵이니까 그대로 몰고 나간다 —
 * 닉네임 색까지 그대로 따라온다.
 *
 * 밟으면 죽는 게 아니라 미끄러진다. 그게 마리오카트의 그 느낌이고,
 * 회복 가능해야 한 판이 길어진다. 세 번 미끄러지면 끝.
 *
 * ⚠️ 이 오버레이는 반드시 createPortal 로 document.body 에 붙여야 한다
 * (OrangeNinjaGame 주석 참고 — 방이 scale 돼서 fixed 가 갇힌다).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const INK = "hsl(30 25% 16%)";
const BEST_KEY = "tangbirsil_race_best";

/* ── 놀이판 ────────────────────────────────────────────────── */
const VB_W = 300;
const VB_H = 420;
/** 컵이 서 있는 높이 (아래에서부터) */
const CUP_Y = VB_H - 58;
const CUP_R = 17;

/* ── 난이도 ────────────────────────────────────────────────
 * scripts/tune-race.mjs 로 굴려서 맞췄다. 두 번 갈아엎었다:
 *
 * 1) 껍질을 흩뿌렸더니 복도가 넓어 늘 빈 곳이 있었다 — 아무리 빨라도
 *    안 어려웠다 (평균 1200m). 그래서 4칸 중 몇 칸을 막는 "줄" 로 바꿨다.
 * 2) 속도를 계속 올리면 어느 순간 물리적으로 못 피하게 되는데, 그러면
 *    실력과 무관하게 다 같은 데서 죽는다. 상한을 낮춰 항상 풀 수 있게
 *    두고, 실수로만 죽게 했다 — 엔드리스 러너는 그래야 한다.
 *
 * 지금 값: 실수 잦은 사람 기준 중앙값 200m / 한 판 15초. 잘하면 상한 없음. */
const SPEED_START = 165;   // px/s
const SPEED_MAX = 400;     // 이 위로 올리면 완벽하게 해도 못 피한다
const SPEED_RAMP = 10;     // 초당 증가

/** 줄 간격(초) — 이게 좁아지는 게 난이도의 절반 */
const ROW_START = 0.86;
const ROW_MIN = 0.38;
const ROW_RAMP = 0.024;

/** 4칸 중 2칸 / 3칸을 막기 시작하는 시각(초). 3칸이 최대 — 길은 늘 있어야 한다 */
const BLOCK2_AT = 8;
const BLOCK3_AT = 20;
const LANES = 4;

/** 미끄러지는 시간 — 이 동안은 조작이 안 먹고 옆으로 밀린다 */
const SLIP_SEC = 0.85;
const SLIP_PUSH = 118;     // px/s 옆으로 밀리는 속도
const LIVES = 3;
/** 미끄러진 직후 잠깐은 무적 — 같은 껍질에 두 번 걸리지 않게 */
const MERCY_SEC = 1.1;

/** 각설탕 — 먹으면 보너스. 껍질만 있으면 화면이 심심하다 */
const SUGAR_P = 0.16;

/** 껍질 판정 반폭.
 *  레인 간격(62)보다 넓어야 한다 — 좁으면 두 레인 정확히 가운데에 서서
 *  아무것도 안 맞는 무적 자리가 생긴다. 실제로 그렇게 1680m 를 갔다. */
const PEEL_HALF = 34;
const CUP_SPEED = 260;     // 손가락을 따라가는 최고 속도 (px/s)
const LANE_PAD = 26;       // 복도 벽에서 이만큼 안쪽까지만
const PX_PER_M = 20;       // 이만큼 지나면 1m

/** 이 거리를 넘으면 껍질까지 다 치운 걸로 친다.
 *  판정 버그를 잡고 나니 브라우저 자동 플레이가 평균 155m 로 내려왔다.
 *  몇 번 해보면 닿는 선으로 잡는다 — 매번 되면 보상이 아니고,
 *  아예 안 되면 그냥 벽이다. */
const CLEAN_AT = 180;

const MAX_OBJ = 24;

type ObjKind = "peel" | "sugar";
type Obj = { id: number; kind: ObjKind; x: number; y: number; spin: number; hit: boolean };

/* ── 복도에서 마주치는 것들 ────────────────────────────────
 * 껍질만 계속 나오면 금방 질린다. 그렇다고 아무거나 쏟아부으면
 * 한 줄을 0.5초에 읽어야 하는 게임이 해독 불가가 된다.
 *
 * 그래서 상시 장애물은 껍질 하나로 두고, 정신없음은 "한 번에 하나씩,
 * 예고 후 끼어드는 이벤트" 로 넣는다. 방해 / 도움 / 무해 / 보너스를
 * 섞어야 정신없는 게 스트레스가 아니라 재미가 된다. */
type EvKind =
  | "boss"      // 부장님 — 잔소리하며 길을 막는다
  | "manager"   // 차장님 — 서류를 흩뿌려 앞이 안 보인다
  | "peer"      // 김대리 — 같이 뛴다. 앞지르면 보너스
  | "ceo"       // 사장님 — 다들 인사하느라 껍질이 멈춘다
  | "dog"       // 누룽지 — 가로지르며 껍질을 물고 간다
  | "cat";      // 탕비 — 복도에 앉아서 안 비킨다

type Ev = {
  id: number;
  kind: EvKind;
  x: number; y: number;
  vx: number; vy: number;
  born: number;
  done: boolean;   // 이미 처리됨 (중복 판정 방지)
  say?: string;
};

/** 이벤트 등장 간격 (초). 처음 한 번은 좀 늦게 — 조작부터 익히게 */
const EV_FIRST = 7;
const EV_GAP: [number, number] = [5.5, 9];

/** 각 이벤트가 살아 있는 최대 시간 — 화면 밖으로 나가면 알아서 지워진다 */
const EV_MAX_SEC = 9;

/** 부장님한테 걸리면 이만큼 멈춘다 (그동안은 무적 — 멈춘 채 껍질을 맞으면 억울하다) */
const NAG_SEC = 1.0;
/** 서류가 날려 앞이 흐린 시간 */
const PAPER_SEC = 2.2;
/** 사장님이 지나가는 동안 껍질이 멈춘다 */
const CEO_SEC = 3.2;
/** 김대리를 앞지르면 주는 보너스 (m) */
const PEER_BONUS = 15;

type Phase = "ready" | "play" | "over";

/** 부장님 잔소리 — 이름을 넣어야 진짜 나한테 하는 소리로 들린다 */
const NAG = (who: string) => [
  `${who}! 복도에서 뛰면 어떻게 하나!`,
  `${who}, 잠깐 이리 와보게`,
  `아니 ${who}, 지금 어디 가나?`,
  `${who}! 그 커피 내 거 아닌가?`,
];
const PEER_SAY = ["같이 가!", "먼저 갑니다", "헉헉…", "커피 식겠다"];
const CEO_SAY = ["다들 수고가 많아", "음, 좋아 좋아"];
const MGR_SAY = ["아 서류가!", "잠깐만요!"];

/** 이벤트 하나를 만든다. 시간이 지날수록 부장님이 자주 나온다. */
function makeEv(id: number, t: number, speed: number, nick: string): Ev {
  const r = Math.random();
  const side = Math.random() < 0.5 ? -1 : 1;
  const enterX = side < 0 ? -34 : VB_W + 34;
  const lane = Math.floor(Math.random() * LANES);
  const laneW = (VB_W - LANE_PAD * 2) / LANES;
  const laneX = LANE_PAD + laneW * lane + laneW / 2;
  const base = { id, born: t, done: false };

  // 사장님은 아주 드물게 — 흔해지면 보너스가 보너스가 아니다
  if (r < 0.06) {
    return { ...base, kind: "ceo", x: enterX, y: 96,
      vx: -side * 84, vy: 0, say: CEO_SAY[Math.floor(Math.random() * CEO_SAY.length)] };
  }
  if (r < 0.28) {
    return { ...base, kind: "dog", x: enterX, y: CUP_Y - 104,
      vx: -side * 268, vy: 0, say: "멍멍!" };
  }
  if (r < 0.46) {
    return { ...base, kind: "manager", x: enterX, y: CUP_Y - 172,
      vx: -side * 158, vy: 0, say: MGR_SAY[Math.floor(Math.random() * MGR_SAY.length)] };
  }
  if (r < 0.62) {
    return { ...base, kind: "cat", x: laneX, y: -34, vx: 0, vy: speed };
  }
  if (r < 0.80) {
    return { ...base, kind: "peer", x: laneX, y: -46,
      vx: 0, vy: speed * 0.9, say: PEER_SAY[Math.floor(Math.random() * PEER_SAY.length)] };
  }
  // 부장님 — 3칸을 막고 천천히 내려온다 (컵이 따라잡는 구조)
  const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 3).sort();
  const cx = LANE_PAD + laneW * ((lanes[0] + lanes[2]) / 2) + laneW / 2;
  const lines = NAG(nick);
  return { ...base, kind: "boss", x: cx, y: -56,
    vx: 0, vy: speed * 0.5, say: lines[Math.floor(Math.random() * lines.length)] };
}

/** 지금 무적인가 */
function mercyNow(g: { t: number; mercyUntil: number }): boolean {
  return g.t < g.mercyUntil;
}

/** 부딪히는 크기 (반폭, 반높이) */
const EV_BOX: Record<EvKind, [number, number]> = {
  boss:    [70, 26],
  manager: [0, 0],    // 서류만 날린다 — 몸은 안 부딪힌다
  peer:    [0, 0],    // 같이 뛰는 사이라 안 부딪힌다
  ceo:     [0, 0],
  dog:     [0, 0],    // 껍질만 물고 간다
  cat:     [17, 14],
};

/** 기록에 따라 손에 남는 것 — 못 치웠으면 껍질이 내 손에 남는다 */
function resultItem(meters: number) {
  return meters >= CLEAN_AT
    ? null                                                       // 깔끔하게 처리함
    : { id: "banana-peel", emoji: "🍌", label: "바나나 껍질" };
}

export default function BananaRaceGame({ onClose }: { onClose: () => void }) {
  const { pickUp, sendMessage, myCup, nickname } = useBreakRoom();
  const cupColor = myCup?.color ?? "#c0392b";
  const shortNick = (myCup?.nickname ?? nickname).replace("Anonymous", "A");

  const [phase, setPhase] = useState<Phase>("ready");
  const [meters, setMeters] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [sugar, setSugar] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [slipping, setSlipping] = useState(false);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { return 0; }
  });

  // 렌더용 상태 (그리기 전용 — 로직은 전부 ref 에서 돈다)
  const [objs, setObjs] = useState<Obj[]>([]);
  const [evs, setEvs] = useState<Ev[]>([]);
  const [cupX, setCupX] = useState(VB_W / 2);
  const [tilt, setTilt] = useState(0);
  const [paper, setPaper] = useState(false);
  const [nagging, setNagging] = useState(false);

  const phaseRef = useRef<Phase>("ready");
  const rafRef = useRef<number | null>(null);
  const objsRef = useRef<Obj[]>([]);
  const evsRef = useRef<Ev[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const gRef = useRef({
    t: 0, dist: 0, speed: SPEED_START, spawnAt: 0.5,
    x: VB_W / 2, targetX: VB_W / 2, vx: 0,
    lives: LIVES, sugar: 0, slipUntil: 0, slipDir: 1, mercyUntil: 0,
    lastLane: -1,
    evAt: EV_FIRST, nagUntil: 0, paperUntil: 0, ceoUntil: 0, bonus: 0,
  });

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const finish = useCallback(() => {
    stop();
    const g = gRef.current;
    phaseRef.current = "over";
    setPhase("over");
    sound.play("boom");

    const m = Math.floor(g.dist);
    const total = m + g.sugar * 12 + g.bonus;
    if (total > best) {
      setBest(total);
      try { localStorage.setItem(BEST_KEY, String(total)); } catch { /* ignore */ }
    }
    const item = resultItem(total);
    if (item) pickUp(item);
    sendMessage(
      item ? `복도에서 바나나 밟고 미끄러짐 🍌 ${total}m`
           : `복도 ${total}m 완주 🏁 껍질도 다 치웠다`,
    );
  }, [best, pickUp, sendMessage, stop]);

  /* ── 조작 — 손가락이 컵을 가리지 않게 판 어디를 끌어도 따라온다 ── */
  const aim = useCallback((clientX: number) => {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * VB_W;
    gRef.current.targetX = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD, x));
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== "play") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    aim(e.clientX);
  }, [aim]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== "play") return;
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    aim(e.clientX);
  }, [aim]);

  /* ── 루프 ─────────────────────────────────────────────── */
  const start = useCallback(() => {
    objsRef.current = [];
    idRef.current = 0;
    gRef.current = {
      t: 0, dist: 0, speed: SPEED_START, spawnAt: 0.6,
      x: VB_W / 2, targetX: VB_W / 2, vx: 0,
      lives: LIVES, sugar: 0, slipUntil: 0, slipDir: 1, mercyUntil: 0,
      lastLane: -1,
      evAt: EV_FIRST, nagUntil: 0, paperUntil: 0, ceoUntil: 0, bonus: 0,
    };
    evsRef.current = [];
    setMeters(0); setLives(LIVES); setSugar(0); setBonus(0); setSlipping(false);
    setObjs([]); setEvs([]); setCupX(VB_W / 2); setTilt(0);
    setPaper(false); setNagging(false);
    phaseRef.current = "play";
    setPhase("play");
    sound.play("brew");

    let last = performance.now();
    const loop = (now: number) => {
      // 탭 전환 후 복귀 시 한 프레임에 몰아서 진행되는 걸 막는다
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const g = gRef.current;
      g.t += dt;
      g.speed = Math.min(SPEED_MAX, SPEED_START + g.t * SPEED_RAMP);
      g.dist += (g.speed * dt) / PX_PER_M;

      /* 컵 이동 — 부장님한테 붙잡히면 아예 못 움직인다 */
      const nag = g.t < g.nagUntil;
      const slip = g.t < g.slipUntil;
      if (nag) {
        // 잔소리 듣는 중. 멈춘 채로 껍질을 맞으면 억울하니 무적이다
      } else if (slip) {
        // 미끄러지는 동안엔 조작이 안 먹고 옆으로 밀린다
        g.x += g.slipDir * SLIP_PUSH * dt;
        g.x = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD, g.x));
        if (g.x <= LANE_PAD || g.x >= VB_W - LANE_PAD) g.slipDir *= -1;
      } else {
        const d = g.targetX - g.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), CUP_SPEED * dt);
        g.x += step;
        g.vx = step / Math.max(dt, 0.001);
      }

      /* 장애물 — 줄 단위로 깐다.
         흩뿌리면 복도가 넓어서 늘 빈 곳이 있고, 그러면 아무리 빨라도
         안 어렵다 (시뮬에서 평균 1200m 나왔다). 4칸 중 몇 칸을 막느냐가
         난이도고, 3칸이 최대 — 길이 아예 없으면 게임이 아니다. */
      // 사장님이 지나가는 동안엔 다들 비켜서서 복도가 깨끗해진다
      const ceoWalk = g.t < g.ceoUntil;
      g.spawnAt -= dt;
      if (!ceoWalk && g.spawnAt <= 0 && objsRef.current.length < MAX_OBJ) {
        g.spawnAt = Math.max(ROW_MIN, ROW_START - g.t * ROW_RAMP);
        const block = g.t >= BLOCK3_AT ? 3 : g.t >= BLOCK2_AT ? 2 : 1;
        const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        const laneW = (VB_W - LANE_PAD * 2) / LANES;
        const at = (i: number) => LANE_PAD + laneW * lanes[i] + laneW / 2;
        for (let i = 0; i < block; i++) {
          objsRef.current.push({
            id: idRef.current++, kind: "peel",
            x: at(i), y: -30, spin: Math.random() * 360, hit: false,
          });
        }
        // 남은 칸 하나에 각설탕 — 빈 곳으로 유도하는 미끼도 된다
        if (Math.random() < SUGAR_P && block < LANES) {
          objsRef.current.push({
            id: idRef.current++, kind: "sugar",
            x: at(block), y: -30, spin: 0, hit: false,
          });
        }
      }

      /* ── 복도에서 마주치는 것들 ──
         한 번에 하나만 나온다. 둘씩 겹치면 0.5초에 읽어야 하는 게임이
         해독 불가가 된다. */
      g.evAt -= dt;
      if (g.evAt <= 0 && evsRef.current.length === 0) {
        g.evAt = EV_GAP[0] + Math.random() * (EV_GAP[1] - EV_GAP[0]);
        const ev = makeEv(idRef.current++, g.t, g.speed, shortNick);
        evsRef.current.push(ev);
        // 소리가 진짜 예고다 — 화면을 다 보고 있을 수 없으니까
        sound.play(
          ev.kind === "dog" ? "bark"
          : ev.kind === "cat" ? "purr"
          : ev.kind === "ceo" ? "ding"
          : ev.kind === "boss" ? "knock"
          : ev.kind === "peer" ? "footsteps" : "blip",
        );
        if (ev.kind === "ceo") { g.ceoUntil = g.t + CEO_SEC; objsRef.current = []; }
        if (ev.kind === "manager") { g.paperUntil = g.t + PAPER_SEC; }
      }

      for (const ev of evsRef.current) {
        ev.x += ev.vx * dt;
        ev.y += ev.vy * dt;

        if (ev.kind === "dog") {
          // 지나가며 껍질을 물고 간다 — 유일하게 도와주는 녀석
          for (const o of objsRef.current) {
            if (!o.hit && o.kind === "peel"
                && Math.abs(o.x - ev.x) < 26 && Math.abs(o.y - ev.y) < 26) {
              o.hit = true;
            }
          }
          continue;
        }
        if (ev.kind === "peer") {
          // 앞지르면 보너스. 컵보다 아래로 내려간 순간이 앞지른 순간이다
          if (!ev.done && ev.y > CUP_Y + 6) {
            ev.done = true;
            g.bonus += PEER_BONUS;
            setBonus(g.bonus);
            sound.play("ding");
          }
          continue;
        }
        const [bw, bh] = EV_BOX[ev.kind];
        if (!bw || ev.done) continue;
        if (Math.abs(ev.x - g.x) < bw + CUP_R * 0.6 && Math.abs(ev.y - CUP_Y) < bh + CUP_R * 0.6) {
          ev.done = true;
          if (ev.kind === "boss") {
            g.nagUntil = g.t + NAG_SEC;
            g.mercyUntil = g.t + NAG_SEC + 0.35;
            sound.play("knock");
          } else if (ev.kind === "cat" && !mercyNow(g) && !slip) {
            g.lives -= 1;
            setLives(g.lives);
            g.slipUntil = g.t + SLIP_SEC;
            g.mercyUntil = g.t + SLIP_SEC + MERCY_SEC;
            g.slipDir = g.x < VB_W / 2 ? 1 : -1;
            sound.play("purr");
            if (g.lives <= 0) { finish(); return; }
          }
        }
      }
      evsRef.current = evsRef.current.filter((e) =>
        g.t - e.born < EV_MAX_SEC && e.x > -80 && e.x < VB_W + 80 && e.y < VB_H + 70);

      /* 장애물 이동 + 충돌 */
      const mercy = g.t < g.mercyUntil;
      for (const o of objsRef.current) {
        o.y += g.speed * dt;
        if (o.hit) continue;
        const dx = o.x - g.x;
        const dy = o.y - CUP_Y;
        if (Math.abs(dx) < (o.kind === "sugar" ? CUP_R + 11 : PEEL_HALF)
            && Math.abs(dy) < CUP_R + 8) {
          if (o.kind === "sugar") {
            o.hit = true;
            g.sugar += 1;
            setSugar(g.sugar);
            sound.play("blip");
          } else if (!mercy && !slip) {
            o.hit = true;
            g.lives -= 1;
            setLives(g.lives);
            g.slipUntil = g.t + SLIP_SEC;
            g.mercyUntil = g.t + SLIP_SEC + MERCY_SEC;
            g.slipDir = g.x < VB_W / 2 ? 1 : -1;
            setSlipping(true);
            sound.play("splat");
            if (g.lives <= 0) { finish(); return; }
          }
        }
      }
      if (!slip && slipping) setSlipping(false);
      objsRef.current = objsRef.current.filter((o) => o.y < VB_H + 40);

      /* 그리기 */
      setObjs([...objsRef.current]);
      setEvs([...evsRef.current]);
      setPaper(g.t < g.paperUntil);
      setNagging(nag);
      setCupX(g.x);
      setMeters(Math.floor(g.dist));
      setTilt(slip ? (g.t * 900) % 360 : nag ? Math.sin(g.t * 22) * 7 : Math.max(-16, Math.min(16, -g.vx * 0.055)));

      if (phaseRef.current === "play") rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [finish, slipping]);

  const total = meters + sugar * 12 + bonus;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 95,
        background: "rgba(20,14,8,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 12,
        fontFamily: "'DotGothic16', monospace",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "play") onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 340,
        maxHeight: "100dvh", boxSizing: "border-box",
        background: "hsl(38 32% 90%)",
        border: `4px solid ${INK}`,
        boxShadow: "6px 6px 0 rgba(0,0,0,0.45)",
        padding: 10,
        userSelect: "none", WebkitUserSelect: "none",
      }}>
        {/* 머리 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "hsl(30 30% 22%)" }}>🏁 복도 레이싱</span>
          <span style={{ fontSize: 10, color: "hsl(0 55% 40%)" }}>
            {"♥".repeat(Math.max(0, lives))}
            <span style={{ opacity: 0.25 }}>{"♥".repeat(LIVES - Math.max(0, lives))}</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "hsl(30 25% 30%)" }}>{total}m</span>
          {(sugar > 0 || bonus > 0) && (
            <span style={{ fontSize: 9, color: "hsl(38 60% 38%)" }}>
              {sugar > 0 && `🍬${sugar}`}{bonus > 0 && ` +${bonus}`}
            </span>
          )}
          <span style={{ fontSize: 9, color: "hsl(30 20% 48%)" }}>최고 {best}</span>
          {phase !== "play" && (
            <button onClick={onClose} aria-label="닫기" style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "hsl(30 20% 40%)", padding: "0 2px", lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* 복도 */}
        <div
          ref={boardRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          style={{
            position: "relative",
            touchAction: "none",
            WebkitTapHighlightColor: "transparent",
            cursor: phase === "play" ? "none" : "default",
            lineHeight: 0,
          }}
        >
          <Corridor
            objs={objs} evs={evs} cupX={cupX} tilt={tilt}
            cupColor={cupColor} nick={shortNick}
            dist={meters} slipping={slipping}
            nagging={nagging} paper={paper} t={meters / 8}
          />

          {phase !== "play" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
              background: "rgba(28,20,12,0.72)", padding: 16, textAlign: "center",
            }}>
              {phase === "ready" ? (
                <>
                  <div style={{ fontSize: 15, color: "hsl(45 80% 82%)" }}>복도에 껍질이 깔렸다</div>
                  <div style={{ fontSize: 11, color: "hsl(38 30% 78%)", lineHeight: 1.8 }}>
                    화면을 <b>좌우로 끌어</b> 컵을 몹니다<br />
                    🍌 밟으면 미끄러져요 (3번이면 끝)<br />
                    🍬 각설탕 12m · 김대리 앞지르면 15m
                  </div>
                  <div style={{
                    fontSize: 10, color: "hsl(38 24% 66%)", lineHeight: 1.9,
                    borderTop: "1px solid hsl(38 18% 45%)", paddingTop: 7, marginTop: 1,
                  }}>
                    복도에서 누굴 마주칠지 모릅니다<br />
                    부장님 · 차장님 · 김대리 · 사장님 · 누룽지 · 탕비
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 17, color: "hsl(45 80% 82%)" }}>{total}m</div>
                  <div style={{ fontSize: 11, color: "hsl(38 30% 78%)", lineHeight: 1.8 }}>
                    {total >= CLEAN_AT
                      ? "복도를 다 지났다 — 껍질도 치웠어요 🏁"
                      : "바나나 껍질이 손에 남았어요 🍌"}
                    {total > 0 && total >= best && <><br />최고 기록!</>}
                  </div>
                </>
              )}
              <button
                onClick={start}
                style={{
                  marginTop: 2, padding: "11px 20px",
                  fontFamily: "'DotGothic16', monospace", fontSize: 14,
                  background: "hsl(45 80% 55%)", color: "hsl(30 40% 18%)",
                  border: `3px solid ${INK}`, boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
                  cursor: "pointer", touchAction: "manipulation",
                }}
              >
                {phase === "ready" ? "출발" : "다시"}
              </button>
              {phase === "over" && (
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px 16px",
                    fontFamily: "'DotGothic16', monospace", fontSize: 12,
                    background: "hsl(30 14% 74%)", color: "hsl(30 25% 24%)",
                    border: `3px solid ${INK}`, cursor: "pointer", touchAction: "manipulation",
                  }}
                >
                  나가기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── 복도에서 마주치는 사람들 ───────────────────────────────
 * 흡연실 아저씨와 같은 화풍 — 네모난 몸통에 두꺼운 외곽선.
 * 직급이 한눈에 보여야 하니 실루엣부터 다르게 그린다:
 * 부장은 배가 나오고, 차장은 서류를 안고, 대리는 뛰고, 사장은 뒷짐. */

function Bubble({ text, flip }: { text: string; flip?: boolean }) {
  const w = Math.min(150, 12 + text.length * 8.2);
  return (
    <g transform={`translate(${flip ? -w - 14 : 14} -34)`}>
      <rect x="0" y="0" width={w} height="22" rx="3"
        fill="hsl(38 45% 96%)" stroke={INK} strokeWidth="2.5" />
      <path d={flip ? `M${w - 10},22 l8,9 l-16,-9 Z` : "M10,22 l-8,9 l16,-9 Z"}
        fill="hsl(38 45% 96%)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <text x={w / 2} y="15" textAnchor="middle" fontSize="10"
        fontFamily="'DotGothic16', monospace" fill="hsl(30 30% 20%)">{text}</text>
    </g>
  );
}

/** 부장님 — 배가 나오고 손가락질을 한다. 3칸을 막는다 */
function Boss({ say, flip }: { say?: string; flip?: boolean }) {
  return (
    <g>
      {say && <Bubble text={say} flip={flip} />}
      {/* 팔 벌려 길을 막는다 */}
      <rect x="-58" y="-6" width="116" height="9" rx="4"
        fill="hsl(215 14% 40%)" stroke={INK} strokeWidth="2.5" />
      {/* 다리 */}
      <rect x="-11" y="12" width="9" height="16" fill="hsl(215 12% 24%)" stroke={INK} strokeWidth="2.5" />
      <rect x="3" y="12" width="9" height="16" fill="hsl(215 12% 24%)" stroke={INK} strokeWidth="2.5" />
      {/* 배 나온 몸통 */}
      <rect x="-20" y="-14" width="40" height="30" rx="6"
        fill="hsl(215 16% 46%)" stroke={INK} strokeWidth="3" />
      {/* 넥타이 */}
      <rect x="-3" y="-13" width="6" height="17" fill="hsl(0 55% 42%)" stroke={INK} strokeWidth="1.6" />
      {/* 머리 — 정수리가 비었다 */}
      <rect x="-11" y="-36" width="22" height="21" rx="4"
        fill="hsl(28 34% 68%)" stroke={INK} strokeWidth="3" />
      <rect x="-11" y="-36" width="22" height="4" fill="hsl(28 20% 52%)" />
      <rect x="-7" y="-28" width="4" height="3" fill={INK} />
      <rect x="3" y="-28" width="4" height="3" fill={INK} />
      {/* 찌푸린 눈썹 */}
      <rect x="-8" y="-32" width="6" height="2.5" fill={INK} transform="rotate(12 -5 -31)" />
      <rect x="2" y="-32" width="6" height="2.5" fill={INK} transform="rotate(-12 5 -31)" />
    </g>
  );
}

/** 차장님 — 서류를 잔뜩 안고 간다 */
function Manager({ say, flip }: { say?: string; flip?: boolean }) {
  return (
    <g>
      {say && <Bubble text={say} flip={flip} />}
      <rect x="-8" y="12" width="8" height="15" fill="hsl(215 12% 26%)" stroke={INK} strokeWidth="2.5" />
      <rect x="2" y="12" width="8" height="15" fill="hsl(215 12% 24%)" stroke={INK} strokeWidth="2.5" />
      <rect x="-14" y="-12" width="28" height="26" rx="4"
        fill="hsl(200 14% 58%)" stroke={INK} strokeWidth="3" />
      {/* 안고 있는 서류 뭉치 */}
      <rect x="-17" y="-6" width="34" height="13" rx="1"
        fill="hsl(45 30% 94%)" stroke={INK} strokeWidth="2.5" />
      <rect x="-13" y="-3" width="26" height="1.6" fill="hsl(210 12% 66%)" />
      <rect x="-13" y="1" width="20" height="1.6" fill="hsl(210 12% 66%)" />
      {/* 머리 + 안경 */}
      <rect x="-10" y="-32" width="20" height="20" rx="4"
        fill="hsl(28 32% 70%)" stroke={INK} strokeWidth="3" />
      <rect x="-11" y="-33" width="22" height="6" rx="2" fill="hsl(28 22% 34%)" stroke={INK} strokeWidth="2" />
      <circle cx="-4" cy="-24" r="3.4" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="5" cy="-24" r="3.4" fill="none" stroke={INK} strokeWidth="2" />
      <rect x="-1" y="-25" width="3" height="1.6" fill={INK} />
    </g>
  );
}

/** 김대리 — 같이 뛰고 있다. 앞지르면 보너스 */
function Peer({ say, t, flip }: { say?: string; t: number; flip?: boolean }) {
  const swing = Math.sin(t * 14) * 9;
  return (
    <g>
      {say && <Bubble text={say} flip={flip} />}
      {/* 뛰는 다리 */}
      <rect x="-9" y="11" width="8" height="16" fill="hsl(215 12% 28%)" stroke={INK} strokeWidth="2.5"
        transform={`rotate(${swing} -5 11)`} />
      <rect x="1" y="11" width="8" height="16" fill="hsl(215 12% 26%)" stroke={INK} strokeWidth="2.5"
        transform={`rotate(${-swing} 5 11)`} />
      <rect x="-13" y="-11" width="26" height="24" rx="4"
        fill="hsl(190 30% 66%)" stroke={INK} strokeWidth="3" />
      {/* 흔드는 팔 */}
      <rect x="-20" y="-8" width="8" height="15" rx="3" fill="hsl(190 26% 58%)" stroke={INK} strokeWidth="2.5"
        transform={`rotate(${-swing * 1.4} -16 -6)`} />
      <rect x="12" y="-8" width="8" height="15" rx="3" fill="hsl(190 26% 58%)" stroke={INK} strokeWidth="2.5"
        transform={`rotate(${swing * 1.4} 16 -6)`} />
      <rect x="-9" y="-30" width="19" height="19" rx="4"
        fill="hsl(28 34% 70%)" stroke={INK} strokeWidth="3" />
      {/* 헝클어진 머리 */}
      <rect x="-10" y="-32" width="21" height="7" rx="2" fill="hsl(28 24% 26%)" stroke={INK} strokeWidth="2" />
      <rect x="-6" y="-35" width="4" height="4" fill="hsl(28 24% 26%)" />
      <rect x="-5" y="-23" width="3.4" height="3" fill={INK} />
      <rect x="3" y="-23" width="3.4" height="3" fill={INK} />
    </g>
  );
}

/** 사장님 — 뒷짐 지고 천천히. 지나가는 동안 복도가 깨끗해진다 */
function Ceo({ say, flip }: { say?: string; flip?: boolean }) {
  return (
    <g>
      {say && <Bubble text={say} flip={flip} />}
      {/* 후광 — 보너스 구간이라는 걸 알아채야 한다 */}
      <circle cx="0" cy="-6" r="34" fill="hsl(45 92% 62%)" opacity="0.2">
        <animate attributeName="r" values="30;40;30" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <rect x="-9" y="12" width="8" height="16" fill="hsl(230 14% 18%)" stroke={INK} strokeWidth="2.5" />
      <rect x="2" y="12" width="8" height="16" fill="hsl(230 14% 18%)" stroke={INK} strokeWidth="2.5" />
      {/* 정장 */}
      <rect x="-15" y="-13" width="30" height="27" rx="4"
        fill="hsl(230 16% 28%)" stroke={INK} strokeWidth="3" />
      <path d="M-5,-13 L0,-2 L5,-13 Z" fill="hsl(45 30% 92%)" stroke={INK} strokeWidth="1.6" />
      <rect x="-1.5" y="-4" width="4" height="12" fill="hsl(45 75% 55%)" stroke={INK} strokeWidth="1.4" />
      {/* 머리 + 금테 안경 + 흰머리 */}
      <rect x="-10" y="-33" width="20" height="20" rx="4"
        fill="hsl(28 30% 72%)" stroke={INK} strokeWidth="3" />
      <rect x="-11" y="-34" width="22" height="5" rx="2" fill="hsl(0 0% 88%)" stroke={INK} strokeWidth="2" />
      <circle cx="-4" cy="-25" r="3.4" fill="none" stroke="hsl(45 75% 52%)" strokeWidth="2" />
      <circle cx="5" cy="-25" r="3.4" fill="none" stroke="hsl(45 75% 52%)" strokeWidth="2" />
    </g>
  );
}

/* ─── 복도 그림 ──────────────────────────────────────────── */

function Corridor({ objs, evs, cupX, tilt, cupColor, nick, dist, slipping, nagging, paper, t }: {
  objs: Obj[]; evs: Ev[]; cupX: number; tilt: number;
  cupColor: string; nick: string; dist: number;
  slipping: boolean; nagging: boolean; paper: boolean; t: number;
}) {
  // 바닥 타일이 흘러가야 달리는 느낌이 난다
  const scroll = (dist * PX_PER_M) % 40;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
    >
      {/* 바닥 */}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="hsl(35 22% 72%)" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={i * 40 - 40 + scroll} width={VB_W} height="2" fill="hsl(35 18% 62%)" />
      ))}
      {/* 벽 */}
      <rect x="0" y="0" width={LANE_PAD - 8} height={VB_H} fill="hsl(30 24% 48%)" />
      <rect x={VB_W - LANE_PAD + 8} y="0" width={LANE_PAD - 8} height={VB_H} fill="hsl(30 24% 48%)" />
      <rect x={LANE_PAD - 8} y="0" width="3" height={VB_H} fill="hsl(30 28% 32%)" />
      <rect x={VB_W - LANE_PAD + 5} y="0" width="3" height={VB_H} fill="hsl(30 28% 32%)" />

      {/* 장애물 */}
      {objs.map((o) => (
        o.hit ? null : o.kind === "sugar" ? (
          <g key={o.id} transform={`translate(${o.x} ${o.y})`}>
            <rect x="-8" y="-6" width="16" height="12" rx="2"
              fill="hsl(45 30% 96%)" stroke={INK} strokeWidth="2" />
            <rect x="-4" y="-3" width="8" height="2" fill="hsl(45 20% 82%)" />
          </g>
        ) : (
          <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.spin}) scale(1.5)`}>
            {/* 바나나 껍질 — 세 갈래로 벌어진 모양.
                판정 반폭(34)에 맞춰 키웠다. 그림보다 판정이 넓으면
                "안 닿았는데 맞았다" 가 되고, 그게 제일 억울하다 */}
            <path d="M-13,3 Q-4,-11 10,-5 Q2,5 -13,3 Z" fill="hsl(48 85% 62%)" stroke={INK} strokeWidth="1.6" />
            <path d="M-11,5 Q0,12 13,3 Q1,4 -11,5 Z" fill="hsl(46 70% 52%)" stroke={INK} strokeWidth="1.6" />
            <path d="M-14,1 Q-7,-3 -2,1" fill="none" stroke="hsl(40 40% 38%)" strokeWidth="1.2" />
          </g>
        )
      ))}

      {/* 복도에서 마주치는 것들 — 컵보다 뒤에 그린다 */}
      {evs.map((e) => (
        <g key={e.id} transform={`translate(${e.x} ${e.y})`}>
          {/* 말풍선은 화면 밖으로 나가지 않게 반대쪽으로 편다 */}
          {e.kind === "boss"    && <Boss say={e.say} flip={e.x > VB_W * 0.45} />}
          {e.kind === "manager" && <Manager say={e.say} flip={e.x > VB_W * 0.5} />}
          {e.kind === "peer"    && <Peer say={e.say} t={t} flip={e.x > VB_W * 0.5} />}
          {e.kind === "ceo"     && <Ceo say={e.say} flip={e.x > VB_W * 0.5} />}
          {e.kind === "dog" && (
            <>
              {e.say && <Bubble text={e.say} flip={e.vx < 0} />}
              <text x="0" y="8" textAnchor="middle" fontSize="26"
                transform={e.vx < 0 ? "scale(-1 1)" : undefined}>🐕</text>
            </>
          )}
          {e.kind === "cat" && (
            <>
              <text x="0" y="8" textAnchor="middle" fontSize="24">🐈</text>
              <text x="15" y="-6" fontSize="9" fontFamily="'DotGothic16', monospace"
                fill="hsl(30 25% 30%)">야옹</text>
            </>
          )}
        </g>
      ))}

      {/* 차장님이 흘린 서류 — 잠깐 앞이 흐려진다 */}
      {paper && Array.from({ length: 11 }, (_, i) => {
        const a = (i * 2.399 + t * 1.3) % (Math.PI * 2);
        return (
          <rect key={i}
            x={30 + ((i * 73 + t * 46) % (VB_W - 80))}
            y={((i * 131 + t * 92) % (VB_H - 30))}
            width="15" height="19" rx="1"
            fill="hsl(45 30% 96%)" stroke={INK} strokeWidth="1.6" opacity="0.82"
            transform={`rotate(${(a * 57) % 360} ${30 + ((i * 73 + t * 46) % (VB_W - 80))} ${((i * 131 + t * 92) % (VB_H - 30))})`}
          />
        );
      })}

      {/* 내 컵 — 방에서 쓰는 그 컵이 그대로 카트가 된다 */}
      <g transform={`translate(${cupX} ${CUP_Y}) rotate(${tilt})`}>
        {slipping && (
          <circle cx="0" cy="0" r="24" fill="none" stroke="hsl(45 90% 62%)" strokeWidth="3" opacity="0.75">
            <animate attributeName="r" values="20;27;20" dur="0.4s" repeatCount="indefinite" />
          </circle>
        )}
        {nagging && (
          <text x="0" y="-24" textAnchor="middle" fontSize="15">😰</text>
        )}
        <rect x="-14" y="-15" width="28" height="30" rx="2" fill={cupColor} stroke={INK} strokeWidth="3" />
        <rect x="-14" y="-15" width="28" height="7" fill="rgba(255,255,255,0.32)" />
        {/* 손잡이 */}
        <path d="M14,-6 q9,0 9,8 q0,8 -9,8" fill="none" stroke={INK} strokeWidth="3" />
        <text x="0" y="6" textAnchor="middle" fontSize="9"
          fontFamily="'DotGothic16', monospace" fill="hsl(38 60% 96%)">
          {nick.slice(0, 4)}
        </text>
      </g>

      {/* 거리 */}
      <text x={VB_W - 12} y="20" textAnchor="end" fontSize="13"
        fontFamily="'DotGothic16', monospace" fill="hsl(30 25% 38%)">
        {dist}m
      </text>
    </svg>
  );
}
