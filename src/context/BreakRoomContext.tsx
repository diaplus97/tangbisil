/**
 * BreakRoomContext — 온라인 탕비실 핵심 상태
 *
 * LIVE mode (Supabase 환경변수 설정 시):
 *  - 초기 로드 시 cups 테이블 전체 조회
 *  - postgres_changes 구독으로 실시간 동기화
 *  - presence 채널로 실제 온라인 수 추적
 *  - beforeunload/unmount 시 자신의 컵 삭제
 *
 * DEMO mode (Supabase 미설정 시):
 *  - 가짜 유저 없음 — 빈 방으로 시작
 *  - 나 혼자만 커피를 내릴 수 있음 (로컬 상태)
 *  - 봇/자동 메시지 없음
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { supabase, isDemoMode } from "@/lib/supabase";

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
  isMe?: boolean;
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
  cups: ActiveCup[];
  myCup: ActiveCup | null;
  brew: (type: CoffeeType) => void;
  sendMessage: (text: string) => void;
  onlineCount: number;
  liveStatus: LiveStatus;
  recentMessages: RecentMsg[];
  plantState: PlantState;
  canWater: boolean;
  waterPlant: () => void;
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
function rowToCup(row: Record<string, unknown>, myId: string): ActiveCup {
  return {
    id: String(row.id),
    nickname: String(row.nickname ?? ""),
    color: String(row.color ?? "#888"),
    coffeeType: (row.coffee_type as CoffeeType) ?? null,
    message: row.message ? String(row.message) : null,
    messageAt: row.message_at ? new Date(row.message_at as string).getTime() : null,
    isMe: row.id === myId,
  };
}

const STORAGE_NICK = "tangbirsil_nick_v2";
const STORAGE_PLANT = "tangbirsil_plant_watered";
// 세션마다 고유 ID — 새로고침 시 재생성하여 중복 presence 방지
const SESSION_ID = Math.random().toString(36).slice(2, 10);
const WATER_COOLDOWN_MS = 30_000;
const PLANT_HAPPY_MS = 60_000;
const PLANT_OKAY_MS = 5 * 60_000;

function getPlantState(lastWatered: number | null): PlantState {
  if (!lastWatered) return "dry";
  const age = Date.now() - lastWatered;
  if (age < PLANT_HAPPY_MS) return "happy";
  if (age < PLANT_OKAY_MS) return "okay";
  return "dry";
}

// ─── Provider ─────────────────────────────────────────────────

export function BreakRoomProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_NICK) || generateNickname(); } catch { return generateNickname(); }
  });
  const myColor = colorFor(nickname);

  // 데모 모드: 빈 방으로 시작 (가짜 유저 없음)
  const [cups, setCups] = useState<ActiveCup[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(isDemoMode ? 0 : 0);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(isDemoMode ? "demo" : "connecting");
  const [recentMessages, setRecentMessages] = useState<RecentMsg[]>([]);

  const [lastWatered, setLastWatered] = useState<number | null>(() => {
    try { const v = localStorage.getItem(STORAGE_PLANT); return v ? Number(v) : null; } catch { return null; }
  });
  const [canWater, setCanWater] = useState(true);
  const plantState = getPlantState(lastWatered);

  const myCup = cups.find((c) => c.isMe) ?? null;

  const pushRecent = useCallback((msg: RecentMsg) => {
    setRecentMessages((prev) => [msg, ...prev].slice(0, 5));
  }, []);

  const rerollNickname = useCallback(() => {
    if (myCup) return;
    const n = generateNickname();
    try { localStorage.setItem(STORAGE_NICK, n); } catch {}
    setNickname(n);
  }, [myCup]);

  const brew = useCallback((type: CoffeeType) => {
    if (myCup) return;
    const cup: ActiveCup = {
      id: SESSION_ID, nickname, color: myColor,
      coffeeType: type, message: null, messageAt: null, isMe: true,
    };
    // 낙관적 업데이트 — 자신의 컵을 즉시 표시
    setCups((prev) => {
      const withoutMe = prev.filter((c) => !c.isMe);
      return [...withoutMe, cup];
    });
    if (!isDemoMode && supabase) {
      supabase.from("cups")
        .upsert({ id: SESSION_ID, nickname, color: myColor, coffee_type: type, message: null })
        .then(({ error }) => {
          if (error) console.warn("[탕비실] cups upsert error:", error.message);
        });
    }
    // 데모 모드: onlineCount 를 내 컵 추가 반영
    if (isDemoMode) setOnlineCount(1);
  }, [myCup, nickname, myColor]);

  const sendMessage = useCallback((text: string) => {
    if (!myCup) return;
    const trimmed = text.trim().slice(0, 30);
    if (!trimmed) return;
    const now = Date.now();
    setCups((prev) => prev.map((c) => c.isMe ? { ...c, message: trimmed, messageAt: now } : c));
    pushRecent({ id: `${now}`, nickname, color: myColor, text: trimmed });
    if (!isDemoMode && supabase) {
      supabase.from("cups")
        .update({ message: trimmed, message_at: new Date().toISOString() })
        .eq("id", SESSION_ID)
        .then(({ error }) => {
          if (error) console.warn("[탕비실] message update error:", error.message);
        });
    }
  }, [myCup, nickname, myColor, pushRecent]);

  const waterPlant = useCallback(() => {
    if (!canWater) return;
    const now = Date.now();
    setLastWatered(now);
    try { localStorage.setItem(STORAGE_PLANT, String(now)); } catch {}
    setCanWater(false);
    setTimeout(() => setCanWater(true), WATER_COOLDOWN_MS);
    if (myCup) sendMessage("화분에 물 줌 💧");
  }, [canWater, myCup, sendMessage]);

  // ─── Supabase 실시간 동기화 ──────────────────────────────────
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isDemoMode || !supabase) return;

    let cancelled = false;
    // 테이블 존재 여부가 확인돼야만 "connected" 로 전환
    let tableReady = false;

    // 0. 오래된 컵 정리 (8시간 이상 된 row 삭제)
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
            "[탕비실] cups 테이블이 없습니다. Supabase SQL Editor에서 아래를 실행하세요:\n\n" +
            "CREATE TABLE cups (\n" +
            "  id          TEXT PRIMARY KEY,\n" +
            "  nickname    TEXT NOT NULL,\n" +
            "  color       TEXT NOT NULL DEFAULT '#888',\n" +
            "  coffee_type TEXT,\n" +
            "  message     TEXT,\n" +
            "  message_at  TIMESTAMPTZ,\n" +
            "  created_at  TIMESTAMPTZ DEFAULT NOW()\n" +
            ");\n" +
            "ALTER TABLE cups ENABLE ROW LEVEL SECURITY;\n" +
            "CREATE POLICY \"public_all\" ON cups FOR ALL USING (true) WITH CHECK (true);\n\n" +
            "그 다음 Supabase > Database > Replication 에서 cups 테이블 realtime 을 활성화하세요."
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
        setCups(data.map((row) => rowToCup(row, SESSION_ID)));
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
          setCups(data.map((row) => rowToCup(row, SESSION_ID)));
        });
      })
      .subscribe((status) => {
        if (cancelled) return;
        // CHANNEL_ERROR 는 실질적인 연결 오류 (테이블 없는 경우 제외)
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && tableReady) {
          setLiveStatus("error");
        }
      });

    // 3. presence 채널 — 실제 접속자 수 추적
    const presenceChannel = supabase.channel("tangbirsil-presence", {
      config: { presence: { key: SESSION_ID } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return;
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ nickname, session: SESSION_ID, joined: Date.now() });
        }
      });

    // 4. 페이지 언로드 시 내 컵 삭제
    const cleanup = () => {
      supabase!.from("cups").delete().eq("id", SESSION_ID).then();
    };
    cleanupRef.current = cleanup;
    window.addEventListener("beforeunload", cleanup);

    return () => {
      cancelled = true;
      clearInterval(pruneTimer);
      window.removeEventListener("beforeunload", cleanup);
      cleanup(); // unmount 시에도 정리
      supabase!.removeChannel(cupsChannel);
      supabase!.removeChannel(presenceChannel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BreakRoomContext.Provider value={{
      nickname, myColor, rerollNickname,
      cups, myCup, brew, sendMessage,
      onlineCount, liveStatus,
      recentMessages,
      plantState, canWater, waterPlant,
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
