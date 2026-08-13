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

/** 손에 든 물건 — 탕비실에서 집어서 흡연실 아저씨에게 건넬 수 있다 */
export type HeldItem = {
  id: string;
  emoji: string;
  label: string;
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
  recentMessages: RecentMsg[];
  plantState: PlantState;
  canWater: boolean;
  waterPlant: () => void;
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
  const [recentMessages, setRecentMessages] = useState<RecentMsg[]>([]);
  // presence 채널에 실제로 접속 중인 세션 ID 들 (유령 컵 판별용)
  const [presenceIds, setPresenceIds] = useState<Set<string> | null>(null);

  // 손에 든 물건 — 방을 옮겨도 유지되도록 Provider 최상단에 둔다
  const [heldItem, setHeldItem] = useState<HeldItem | null>(null);

  const [lastWatered, setLastWatered] = useState<number | null>(() => {
    try { const v = localStorage.getItem(STORAGE_PLANT); return v ? Number(v) : null; } catch { return null; }
  });
  const [canWater, setCanWater] = useState(true);
  const plantState = getPlantState(lastWatered);

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

  const pickUp = useCallback((item: HeldItem) => {
    setHeldItem(item);
    sound.play("blip");
  }, []);

  const clearHeld = useCallback(() => setHeldItem(null), []);

  const waterPlant = useCallback(() => {
    if (!canWater) return;
    const now = Date.now();
    setLastWatered(now);
    try { localStorage.setItem(STORAGE_PLANT, String(now)); } catch { /* ignore */ }
    setCanWater(false);
    setTimeout(() => setCanWater(true), WATER_COOLDOWN_MS);
    sound.play("water");
    if (myCupRef.current) sendMessage("화분에 물 줌 💧");
  }, [canWater, sendMessage]);

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

    // 0. 오래된 컵 정리 (8시간 이상 된 row 삭제 — 식은 컵의 수명이기도 함)
    const pruneOldCups = () => {
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      supabase!.from("cups").delete().lt("created_at", cutoff).then();
    };
    pruneOldCups();
    // 30분마다 재실행
    const pruneTimer = setInterval(pruneOldCups, 30 * 60 * 1000);

    // 1. 초기 데이터 조회
    supabase.from("cups").select("*").then(({ data, error }) => {
      if (cancelled) return;
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
          setLiveStatus("demo"); // 테이블 없으면 데모 모드로 전환
        } else {
          console.warn("[탕비실] initial fetch error:", error.message);
          setLiveStatus("error");
        }
        return;
      }
      if (data) {
        tableReady = true;
        setAllCups(data.map((row) => rowToCup(row, SESSION_ID)));
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
      .subscribe((status) => {
        if (cancelled) return;
        // CHANNEL_ERROR 는 실질적인 연결 오류 (테이블 없는 경우 제외)
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && tableReady) {
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

    // 4. 페이지를 떠날 때 — 컵을 지우지 않고 "식은 컵"으로 마킹
    const markLeft = () => {
      supabase!.from("cups")
        .update({ left_at: new Date().toISOString() })
        .eq("id", SESSION_ID)
        .then(({ error }) => {
          // left_at 컬럼이 없는 구버전 스키마면 기존 동작(삭제)으로 폴백
          if (error) supabase!.from("cups").delete().eq("id", SESSION_ID).then();
        });
    };
    window.addEventListener("beforeunload", markLeft);
    window.addEventListener("pagehide", markLeft);

    return () => {
      cancelled = true;
      clearInterval(pruneTimer);
      window.removeEventListener("beforeunload", markLeft);
      window.removeEventListener("pagehide", markLeft);
      markLeft(); // unmount 시에도 마킹
      supabase!.removeChannel(cupsChannel);
      supabase!.removeChannel(presenceChannel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BreakRoomContext.Provider value={{
      nickname, myColor, rerollNickname,
      cups, coldCups, myCup, brew, sendMessage,
      onlineCount, liveStatus,
      recentMessages,
      plantState, canWater, waterPlant,
      stampDays, streak: computeStreak(stampDays),
      restMinutes: Math.floor(restSeconds / 60),
      heldItem, pickUp, clearHeld,
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
