/**
 * BreakRoomContext — 온라인 탕비실 핵심 상태
 *
 * LIVE mode (Supabase 환경변수 설정 시):
 *  - 초기 로드 시 cups 테이블 전체 조회
 *  - postgres_changes 구독으로 실시간 동기화
 *  - presence 채널로 실제 온라인 수 추적
 *  - 나갈 때 컵을 지우지 않고 left_at 마킹 → "식은 컵"으로 잔류 (v0.2)
 *
 * DEMO mode (Supabase 미설정 시):
 *  - 가짜 유저 없음 — 빈 방으로 시작
 *  - 나 혼자만 커피를 내릴 수 있음 (로컬 상태)
 *  - 봇/자동 메시지 없음
 *
 * v0.2 추가:
 *  - 식은 컵: 떠난 자리의 컵이 몇 시간 남아 "다녀간 흔적"이 됨
 *  - 유령 컵 정리: presence 에 없는 left_at=null 컵은 클라이언트에서 식은 컵 취급
 *  - 출근 도장: 하루 첫 커피 = 도장 + 연속 출근 스트릭 (localStorage)
 *  - 쉼 타이머: 탭이 보이는 동안 오늘 쉰 시간 누적 (localStorage)
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { supabase, isDemoMode } from "@/lib/supabase";
import { sound } from "@/lib/sound";

// ─── 타입 ────────────────────────────────────────────────────

export type CoffeeType = "americano" | "mix" | "latte";
export type PlantState = "dry" | "okay" | "happy";
export type LiveStatus = "demo" | "connecting" | "connected" | "error";

export type ActiveCup = {
  id: string;
  nickname: string;
  color: string;
  coffeeType: CoffeeType | null;
  message: string | null;
  messageAt: number | null;
  createdAt: number | null;
  /** 자리를 떠난 시각 — null 이면 아직 자리에 있음 */
  leftAt: number | null;
  isMe?: boolean;
};

/**
 * 손에 든 물건.
 * 셋 중 하나를 할 수 있다 — 내가 먹거나, 옆 사람한테 주거나, 흡연실 아저씨한테 가져가거나.
 */
export type HeldItem = {
  id: string;
  emoji: string;
  label: string;
};

/** 받았을 때 붙는 한마디 — 물건마다 다르다 */
const GIFT_FLAVOR: Record<string, string> = {
  "mandu": "앗 뜨거!",
  "burnt-mandu": "…이거 탄 거 아닌가",
  "drink": "시원하다",
  "juice": "오 이런 걸 다",
  "apple": "잘 먹을게요",
  "orange": "귤은 언제나 옳지",
  "peeled-apple": "깎아서까지 주다니",
  "rough-apple": "…껍질 좀 남았는데",
};

/** 먹었을 때 나가는 메시지 */
function eatMessage(item: HeldItem): string {
  if (item.id === "burnt-mandu") return "탄 만두 먹음… 맛없어 🥟";
  if (item.id === "mandu") return "만두 먹음 🥟 후후";
  if (item.id === "peeled-apple") return "깎은 사과 먹음 🍎 역시 깎아 먹어야";
  if (item.id === "rough-apple") return "대충 깎은 사과 먹음 🍎 껍질 씹힌다";
  return `${item.label} 먹음 ${item.emoji}`;
}

/** 남에게서 받은 물건 (토스트로 잠깐 뜬다) */
export type IncomingGift = {
  key: number;
  fromNick: string;
  fromColor: string;
  item: HeldItem;
  flavor: string;
};

export type RecentMsg = {
  id: string;
  nickname: string;
  color: string;
  text: string;
};

type BreakRoomContextValue = {
  nickname: string;
  myColor: string;
  rerollNickname: () => void;
  /** 살아있는 컵 (자리에 있는 사람들) */
  cups: ActiveCup[];
  /** 식은 컵 (다녀간 흔적, 최근 순) */
  coldCups: ActiveCup[];
  myCup: ActiveCup | null;
  brew: (type: CoffeeType) => void;
  sendMessage: (text: string) => void;
  onlineCount: number;
  liveStatus: LiveStatus;
  /** 연결이 안 될 때 서버가 실제로 뭐라고 했는지 — 화면에 그대로 보여준다 */
  liveError: string | null;
  recentMessages: RecentMsg[];
  plantState: PlantState;
  canWater: boolean;
  waterPlant: () => void;
  /** 물 준 누적 횟수로 결정되는 성장 단계 (0 = 그냥 화분) */
  plantStage: number;
  waterCount: number;
  /** 출근 도장이 찍힌 날짜들 (YYYY-MM-DD) */
  stampDays: string[];
  /** 오늘 포함 연속 출근일 수 */
  streak: number;
  /** 오늘 탕비실에서 쉰 시간 (분) */
  restMinutes: number;
  /** 손에 든 물건 (한 번에 하나) */
  heldItem: HeldItem | null;
  /** 물건을 집는다. 이미 들고 있으면 교체된다. */
  pickUp: (item: HeldItem) => void;
  /** 손에 든 걸 비운다 (건네줬거나 먹었을 때) */
  clearHeld: () => void;
  /** 전자레인지가 터진 시각 — 화면 흔들림·창밖 소방차가 여기에 반응한다 */
  explosionAt: number | null;
  triggerExplosion: () => void;
  /** 손에 든 걸 내가 먹는다 */
  eatHeld: () => void;
  /** 손에 든 걸 다른 사람 컵에 건넨다 */
  giveTo: (cup: ActiveCup) => void;
  /** 방금 누가 나한테 준 것 */
  incomingGift: IncomingGift | null;
  dismissGift: () => void;
  /** 건네줄 상대를 고르는 중 — 카운터의 컵이 대상이 된다 */
  giftMode: boolean;
  setGiftMode: (on: boolean) => void;
};

const BreakRoomContext = createContext<BreakRoomContextValue | null>(null);

// ─── 헬퍼 ────────────────────────────────────────────────────

const PALETTE = ["#c0392b","#d35400","#e67e22","#f39c12","#27ae60","#2980b9","#8e44ad","#16a085"];

function colorFor(nick: string): string {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = nick.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function generateNickname(): string {
  return `Anonymous${100 + Math.floor(Math.random() * 900)}`;
}

// 각 DB 행을 ActiveCup으로 변환
// 내 이전 방문의 컵(left_at 마킹됨)은 "내 컵"이 아니라 식은 컵으로 취급 —
// 새로 커피를 내리면 같은 PK 로 upsert 되며 되살아난다.
function rowToCup(row: Record<string, unknown>, myId: string): ActiveCup {
  return {
    id: String(row.id),
    nickname: String(row.nickname ?? ""),
    color: String(row.color ?? "#888"),
    coffeeType: (row.coffee_type as CoffeeType) ?? null,
    message: row.message ? String(row.message) : null,
    messageAt: row.message_at ? new Date(row.message_at as string).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : null,
    leftAt: row.left_at ? new Date(row.left_at as string).getTime() : null,
    isMe: row.id === myId && !row.left_at,
  };
}

const STORAGE_NICK = "tangbirsil_nick_v2";
const STORAGE_PLANT = "tangbirsil_plant_watered";
/** 물 준 누적 횟수 — 5번마다 한 단계씩 자란다 (잭과 콩나무) */
const STORAGE_PLANT_FED = "tangbirsil_plant_fed";
export const WATER_PER_STAGE = 5;
export const MAX_PLANT_STAGE = 4;
const STORAGE_SID = "tangbirsil_sid_v1";
const STORAGE_STAMPS = "tangbirsil_stamps_v1";
const STORAGE_REST = "tangbirsil_rest_v1";

// 브라우저마다 고정 ID — 재방문/새로고침 시 자기 컵을 재사용해 유령 컵 방지
const SESSION_ID: string = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_SID);
    if (saved) return saved;
    const fresh = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_SID, fresh);
    return fresh;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
})();

const WATER_COOLDOWN_MS = 30_000;
const PLANT_HAPPY_MS = 60_000;
const PLANT_OKAY_MS = 5 * 60_000;
// presence 에 없는 left_at=null 컵을 식은 컵으로 간주하기까지의 유예
const GHOST_GRACE_MS = 2 * 60_000;
// 화면에 보여줄 식은 컵 최대 개수
export const COLD_CUP_LIMIT = 10;

function getPlantState(lastWatered: number | null): PlantState {
  if (!lastWatered) return "dry";
  const age = Date.now() - lastWatered;
  if (age < PLANT_HAPPY_MS) return "happy";
  if (age < PLANT_OKAY_MS) return "okay";
  return "dry";
}

export function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dateKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function computeStreak(days: string[]): number {
  const set = new Set(days);
  let streak = 0;
  // 오늘 도장이 없으면 어제부터 이어진 스트릭을 센다
  let offset = set.has(todayKey()) ? 0 : -1;
  while (set.has(dateKeyOffset(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

function loadStamps(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_STAMPS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function loadRestSeconds(): number {
  try {
    const raw = localStorage.getItem(STORAGE_REST);
    if (!raw) return 0;
    const obj = JSON.parse(raw) as { date?: string; sec?: number };
    return obj.date === todayKey() ? (obj.sec ?? 0) : 0;
  } catch { return 0; }
}

// ─── Provider ─────────────────────────────────────────────────

export function BreakRoomProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_NICK) || generateNickname(); } catch { return generateNickname(); }
  });
  const myColor = colorFor(nickname);

  // 데모 모드: 빈 방으로 시작 (가짜 유저 없음)
  const [allCups, setAllCups] = useState<ActiveCup[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(isDemoMode ? "demo" : "connecting");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [recentMessages, setRecentMessages] = useState<RecentMsg[]>([]);
  // presence 채널에 실제로 접속 중인 세션 ID 들 (유령 컵 판별용)
  const [presenceIds, setPresenceIds] = useState<Set<string> | null>(null);

  // 손에 든 물건 — 방을 옮겨도 유지되도록 Provider 최상단에 둔다
  const [heldItem, setHeldItem] = useState<HeldItem | null>(null);
  // 폭발 신호 — 방 전체가 반응해야 해서 여기 둔다
  const [explosionAt, setExplosionAt] = useState<number | null>(null);
  // 남이 나한테 준 물건
  const [incomingGift, setIncomingGift] = useState<IncomingGift | null>(null);
  // 건네줄 상대를 고르는 중인가
  const [giftMode, setGiftMode] = useState(false);
  // 선물 broadcast 채널 — 스키마 변경 없이 순간 전달만 한다
  const giftChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const [lastWatered, setLastWatered] = useState<number | null>(() => {
    try { const v = localStorage.getItem(STORAGE_PLANT); return v ? Number(v) : null; } catch { return null; }
  });
  const [canWater, setCanWater] = useState(true);
  const plantState = getPlantState(lastWatered);
  const [waterCount, setWaterCount] = useState<number>(() => {
    try { return Number(localStorage.getItem(STORAGE_PLANT_FED) ?? 0) || 0; } catch { return 0; }
  });
  const plantStage = Math.min(MAX_PLANT_STAGE, Math.floor(waterCount / WATER_PER_STAGE));

  // 출근 도장 + 쉼 타이머
  const [stampDays, setStampDays] = useState<string[]>(loadStamps);
  const [restSeconds, setRestSeconds] = useState<number>(loadRestSeconds);

  // ─── 컵 분류: 살아있는 컵 / 식은 컵 ──────────────────────
  // left_at 이 찍혔거나, presence 에 없는데 생성된 지 오래된 컵(유령)은 식은 컵
  // (useMemo — 파생 배열의 참조 안정성 보장, 소비 컴포넌트의 effect 루프 방지)
  const { cups, coldCups } = useMemo(() => {
    const now = Date.now();
    const isCold = (c: ActiveCup): boolean => {
      if (c.isMe) return false;
      if (c.leftAt) return true;
      if (presenceIds && !presenceIds.has(c.id)) {
        const born = c.createdAt ?? 0;
        if (now - born > GHOST_GRACE_MS) return true;
      }
      return false;
    };
    return {
      cups: allCups.filter((c) => !isCold(c)),
      coldCups: allCups
        .filter(isCold)
        .sort((a, b) => (b.leftAt ?? b.messageAt ?? b.createdAt ?? 0) - (a.leftAt ?? a.messageAt ?? a.createdAt ?? 0))
        .slice(0, COLD_CUP_LIMIT),
    };
  }, [allCups, presenceIds]);

  const myCup = cups.find((c) => c.isMe) ?? null;
  // sendMessage 는 아래에서 정의되지만 eatHeld/giveTo 가 먼저 선언된다.
  // 호출 시점에 읽도록 ref 로 우회한다.
  const sendMessageRef = useRef<((text: string) => void) | null>(null);
  const heldItemRef = useRef<HeldItem | null>(null);
  heldItemRef.current = heldItem;
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  const myCupRef = useRef<ActiveCup | null>(null);
  myCupRef.current = myCup;
  // 이번 페이지 세션에서 커피를 내렸는지 (다른 탭 종료로 식은 내 컵 복구 판단용)
  const hasBrewedRef = useRef(false);

  const pushRecent = useCallback((msg: RecentMsg) => {
    setRecentMessages((prev) => [msg, ...prev].slice(0, 5));
  }, []);

  const rerollNickname = useCallback(() => {
    if (myCupRef.current) return;
    const n = generateNickname();
    try { localStorage.setItem(STORAGE_NICK, n); } catch { /* ignore */ }
    setNickname(n);
  }, []);

  // ─── 출근 도장 ───────────────────────────────────────────
  const recordStamp = useCallback(() => {
    const key = todayKey();
    setStampDays((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key].slice(-60); // 최근 60일만 보관
      try { localStorage.setItem(STORAGE_STAMPS, JSON.stringify(next)); } catch { /* ignore */ }
      sound.play("stamp");
      return next;
    });
  }, []);

  const brew = useCallback((type: CoffeeType) => {
    if (myCupRef.current) return;
    const cup: ActiveCup = {
      id: SESSION_ID, nickname, color: myColor,
      coffeeType: type, message: null, messageAt: null,
      createdAt: Date.now(), leftAt: null, isMe: true,
    };
    // 낙관적 업데이트 — 자신의 컵을 즉시 표시
    setAllCups((prev) => {
      const withoutMe = prev.filter((c) => c.id !== SESSION_ID);
      return [...withoutMe, cup];
    });
    if (!isDemoMode && supabase) {
      supabase.from("cups")
        .upsert({
          id: SESSION_ID, nickname, color: myColor, coffee_type: type,
          message: null, left_at: null, created_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) {
            // left_at 컬럼이 없는 구버전 스키마 폴백 — 기존 형태로 재시도
            supabase!.from("cups")
              .upsert({ id: SESSION_ID, nickname, color: myColor, coffee_type: type, message: null })
              .then(({ error: e2 }) => {
                if (e2) console.warn("[탕비실] cups upsert error:", e2.message);
              });
          }
        });
    }
    // 데모 모드: onlineCount 를 내 컵 추가 반영
    if (isDemoMode) setOnlineCount(1);
    hasBrewedRef.current = true;
    recordStamp();
  }, [nickname, myColor, recordStamp]);

  const sendMessage = useCallback((text: string) => {
    if (!myCupRef.current) return;
    const trimmed = text.trim().slice(0, 30);
    if (!trimmed) return;
    const now = Date.now();
    setAllCups((prev) => prev.map((c) => c.isMe ? { ...c, message: trimmed, messageAt: now } : c));
    pushRecent({ id: `${now}`, nickname, color: myColor, text: trimmed });
    if (!isDemoMode && supabase) {
      supabase.from("cups")
        .update({ message: trimmed, message_at: new Date().toISOString() })
        .eq("id", SESSION_ID)
        .then(({ error }) => {
          if (error) console.warn("[탕비실] message update error:", error.message);
        });
    }
  }, [nickname, myColor, pushRecent]);
  sendMessageRef.current = sendMessage;

  const pickUp = useCallback((item: HeldItem) => {
    setHeldItem(item);
    sound.play("blip");
  }, []);

  const clearHeld = useCallback(() => { setHeldItem(null); setGiftMode(false); }, []);

  /** 내가 먹는다 — 네트워크 불필요 */
  const eatHeld = useCallback(() => {
    const item = heldItemRef.current;
    if (!item) return;
    setHeldItem(null);
    setGiftMode(false);
    sendMessageRef.current?.(eatMessage(item));
    sound.play("crunch");
  }, []);

  /** 옆 사람한테 건넨다 — broadcast 로 순간 전달 (DB 에 남기지 않는다) */
  const giveTo = useCallback((cup: ActiveCup) => {
    const item = heldItemRef.current;
    if (!item || cup.isMe) return;
    setHeldItem(null);
    setGiftMode(false);

    const me = nicknameRef.current.replace("Anonymous", "A");
    const them = cup.nickname.replace("Anonymous", "A");
    sendMessageRef.current?.(`${them}님한테 ${item.label} 건넴 ${item.emoji}`);
    sound.play("pop");

    giftChannelRef.current?.send({
      type: "broadcast",
      event: "gift",
      payload: {
        to: cup.id,
        fromNick: me,
        fromColor: colorFor(nicknameRef.current),
        item,
      },
    });
  }, []);

  const dismissGift = useCallback(() => setIncomingGift(null), []);

  const triggerExplosion = useCallback(() => {
    setExplosionAt(Date.now());
    sound.play("blast");
    // 소방차는 조금 늦게 온다
    setTimeout(() => sound.play("siren"), 2200);
  }, []);

  const waterPlant = useCallback(() => {
    if (!canWater) return;
    const now = Date.now();
    setLastWatered(now);
    try { localStorage.setItem(STORAGE_PLANT, String(now)); } catch { /* ignore */ }
    setCanWater(false);
    setTimeout(() => setCanWater(true), WATER_COOLDOWN_MS);
    sound.play("water");

    // 5번마다 한 단계씩 자란다 — 단계가 오르는 순간엔 방에 알린다
    const fed = waterCount + 1;
    setWaterCount(fed);
    try { localStorage.setItem(STORAGE_PLANT_FED, String(fed)); } catch { /* ignore */ }
    const before = Math.min(MAX_PLANT_STAGE, Math.floor(waterCount / WATER_PER_STAGE));
    const after = Math.min(MAX_PLANT_STAGE, Math.floor(fed / WATER_PER_STAGE));

    if (myCupRef.current) {
      if (after > before) {
        sendMessage(
          after >= MAX_PLANT_STAGE ? "화분이 천장을 뚫었다 🌳" : "화분이 쑥 자랐다 🌱",
        );
      } else {
        sendMessage("화분에 물 줌 💧");
      }
    }
  }, [canWater, sendMessage, waterCount]);

  // ─── 내 컵 자가 복구 ─────────────────────────────────────
  // 이번 세션에서 커피를 내렸는데 내 컵에 left_at 이 찍혔다면
  // (같은 브라우저의 다른 탭이 닫히며 마킹한 경우) 되살린다.
  useEffect(() => {
    if (isDemoMode || !supabase || !hasBrewedRef.current) return;
    const mine = allCups.find((c) => c.id === SESSION_ID);
    if (mine && mine.leftAt) {
      supabase.from("cups").update({ left_at: null }).eq("id", SESSION_ID).then();
      // 낙관적 로컬 복구
      setAllCups((prev) => prev.map((c) => c.id === SESSION_ID ? { ...c, leftAt: null, isMe: true } : c));
    }
  }, [allCups]);

  // ─── 쉼 타이머: 자리에 있고 탭이 보이는 동안 15초 단위 누적 ──
  useEffect(() => {
    const t = setInterval(() => {
      if (!myCupRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setRestSeconds((prev) => {
        const next = prev + 15;
        try {
          localStorage.setItem(STORAGE_REST, JSON.stringify({ date: todayKey(), sec: next }));
        } catch { /* ignore */ }
        return next;
      });
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  // ─── Supabase 실시간 동기화 ──────────────────────────────────
  useEffect(() => {
    if (isDemoMode || !supabase) return;

    let cancelled = false;
    // 테이블 존재 여부가 확인돼야만 "connected" 로 전환
    let tableReady = false;

    // 초기 조회가 결론을 냈는지 (성공이든 실패든) — 타임아웃은 결론이 없을 때만.
    // 이게 없으면 "Invalid path" 같은 구체적인 원인을 8초 뒤 타임아웃 문구가 덮어쓴다.
    let settled = false;

    // 초기 조회가 영영 안 돌아오는 경우가 있다 (주소가 틀렸거나 네트워크가 막혔을 때
    // supabase-js 가 조용히 재시도만 하고 then 이 안 불린다). 그러면 화면은
    // "연결 중" 에서 멈춘 채 아무 말도 안 한다. 시간을 못 박아 원인을 띄운다.
    const connectTimer = setTimeout(() => {
      if (cancelled || settled) return;
      setLiveError(
        "서버가 응답하지 않습니다. Supabase 주소·키가 맞는지, 네트워크가 막혀 있지 않은지 확인하세요.",
      );
      setLiveStatus("error");
    }, 8000);

    // 0. 오래된 컵 정리 (8시간 이상 된 row — 식은 컵의 수명이기도 함)
    //
    // 클라이언트가 직접 DELETE 하면 anon key 를 쥔 누구나 방 전체를 비울 수 있다.
    // (anon key 는 번들에 그대로 들어간다) 그래서 삭제 권한은 RLS 로 막고,
    // "8시간 지난 것만" 지우는 함수로만 정리한다.
    // 아직 구버전 스키마를 쓰는 프로젝트를 위해 실패하면 예전 방식으로 폴백한다.
    const pruneOldCups = () => {
      supabase!.rpc("prune_old_cups").then(({ error }) => {
        if (!error) return;
        const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
        supabase!.from("cups").delete().lt("created_at", cutoff).then(({ error: e2 }) => {
          if (e2) console.warn(
            "[탕비실] 오래된 컵 정리 실패. supabase/schema.sql 을 다시 실행하세요:",
            error.message,
          );
        });
      });
    };
    pruneOldCups();
    // 30분마다 재실행
    const pruneTimer = setInterval(pruneOldCups, 30 * 60 * 1000);

    // 1. 초기 데이터 조회
    supabase.from("cups").select("*").then(({ data, error }) => {
      if (cancelled) return;
      settled = true;
      if (error) {
        // cups 테이블이 없는 경우 → 설정 안내 후 오프라인으로 대체
        const isMissingTable =
          error.code === "42P01" ||
          error.message?.includes("schema cache") ||
          error.message?.includes("does not exist");

        if (isMissingTable) {
          console.error(
            "[탕비실] cups 테이블이 없습니다. 레포의 supabase/schema.sql 을 " +
            "Supabase SQL Editor 에서 실행한 뒤 새로고침하세요."
          );
          setLiveError("cups 테이블이 없습니다. supabase/schema.sql 을 실행하세요.");
          setLiveStatus("demo"); // 테이블 없으면 데모 모드로 전환
        } else {
          console.warn("[탕비실] initial fetch error:", error.message);
          // "연결 오류" 네 글자로는 아무것도 알 수 없다. 서버가 한 말을 그대로 남긴다.
          setLiveError(error.message);
          setLiveStatus("error");
        }
        return;
      }
      if (data) {
        tableReady = true;
        setAllCups(data.map((row) => rowToCup(row, SESSION_ID)));
        setLiveError(null);
        setLiveStatus("connected");
      }
    });

    // 2. cups 테이블 변경 구독 — liveStatus 는 초기 fetch 기준으로만 결정
    const cupsChannel = supabase
      .channel("tangbirsil-cups")
      .on("postgres_changes", { event: "*", schema: "public", table: "cups" }, () => {
        if (cancelled || !tableReady) return;
        supabase!.from("cups").select("*").then(({ data }) => {
          if (cancelled || !data) return;
          setAllCups(data.map((row) => rowToCup(row, SESSION_ID)));
        });
      })
      .subscribe((status, err) => {
        if (cancelled) return;
        // CHANNEL_ERROR 는 실질적인 연결 오류 (테이블 없는 경우 제외)
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && tableReady) {
          console.warn("[탕비실] 실시간 채널 오류:", status, err?.message ?? "");
          setLiveError(err?.message ?? `실시간 채널 ${status}`);
          setLiveStatus("error");
        }
      });

    // 3. presence 채널 — 실제 접속자 수 + 유령 컵 판별
    const presenceChannel = supabase.channel("tangbirsil-presence", {
      config: { presence: { key: SESSION_ID } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return;
        const state = presenceChannel.presenceState();
        const ids = Object.keys(state);
        setOnlineCount(ids.length);
        setPresenceIds(new Set(ids));
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ nickname, session: SESSION_ID, joined: Date.now() });
        }
      });

    // 3.5 선물 채널 — broadcast 라 DB 에 남지 않는다.
    //     스키마 변경이 필요 없고, 선물은 원래 순간적인 것이라 이 편이 맞다.
    const giftChannel = supabase.channel("tangbirsil-gifts", {
      config: { broadcast: { self: false } },
    });
    giftChannel
      .on("broadcast", { event: "gift" }, ({ payload }) => {
        if (cancelled) return;
        const p = payload as {
          to?: string; fromNick?: string; fromColor?: string; item?: HeldItem;
        };
        if (p?.to !== SESSION_ID || !p.item) return;
        // 받은 물건은 내 손에 들린다 — 먹든, 넘기든, 아저씨한테 가져가든 자유
        setHeldItem(p.item);
        setIncomingGift({
          key: Date.now(),
          fromNick: p.fromNick ?? "누군가",
          fromColor: p.fromColor ?? "#888",
          item: p.item,
          flavor: GIFT_FLAVOR[p.item.id] ?? "",
        });
        sound.play("pop");
      })
      .subscribe();
    giftChannelRef.current = giftChannel;

    // 4. 페이지를 떠날 때 — 컵을 지우지 않고 "식은 컵"으로 마킹
    const markLeft = () => {
      supabase!.from("cups")
        .update({ left_at: new Date().toISOString() })
        .eq("id", SESSION_ID)
        .then(({ error }) => {
          // 예전엔 여기서 DELETE 로 폴백했지만, 이제 삭제는 RLS 로 막혀 있다.
          // (막아야 anon key 로 방을 통째로 비우는 걸 방지할 수 있다)
          if (error) console.warn("[탕비실] 퇴장 표시 실패:", error.message);
        });
    };
    window.addEventListener("beforeunload", markLeft);
    window.addEventListener("pagehide", markLeft);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      clearInterval(pruneTimer);
      window.removeEventListener("beforeunload", markLeft);
      window.removeEventListener("pagehide", markLeft);
      markLeft(); // unmount 시에도 마킹
      supabase!.removeChannel(cupsChannel);
      supabase!.removeChannel(presenceChannel);
      supabase!.removeChannel(giftChannel);
      giftChannelRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BreakRoomContext.Provider value={{
      nickname, myColor, rerollNickname,
      cups, coldCups, myCup, brew, sendMessage,
      onlineCount, liveStatus, liveError,
      recentMessages,
      plantState, canWater, waterPlant, plantStage, waterCount,
      stampDays, streak: computeStreak(stampDays),
      restMinutes: Math.floor(restSeconds / 60),
      heldItem, pickUp, clearHeld,
      explosionAt, triggerExplosion,
      eatHeld, giveTo, incomingGift, dismissGift, giftMode, setGiftMode,
    }}>
      {children}
    </BreakRoomContext.Provider>
  );
}

export function useBreakRoom() {
  const ctx = useContext(BreakRoomContext);
  if (!ctx) throw new Error("useBreakRoom must be used inside BreakRoomProvider");
  return ctx;
}
