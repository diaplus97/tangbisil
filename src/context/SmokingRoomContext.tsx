/**
 * SmokingRoomContext — 흡연실 상태
 *
 * 소환 의식:
 *   담배 한 개비 = 12초 실시간. 연달아 피우면 체인이 오른다.
 *   체인이 임계치에 닿으면 문이 열리고 NPC 가 들어온다.
 *
 *   입장   — 벽 낙서 두 줄이 이미 보인다 (유일한 발견 단서)
 *   1개비 — 재떨이에 꽁초 + 낙서가 더 드러남
 *   2개비 — 낙서가 더 드러나고, 복도에서 발자국. 안 옴.
 *   3개비 — 문이 열린다
 *
 *   개비마다 반드시 뭔가 일어나야 한다. 아무 일도 없는 개비가 있으면
 *   그 12초가 통째로 지루해진다.
 *
 *   한 번 만난 뒤엔 한 대면 오고, 들어왔을 때 이미 앉아 있기도 하다.
 *   매번 처음부터 소환하게 만들면 재방문이 고문이 된다.
 *
 * 비흡연자 경로:
 *   담배를 안 피우고 흡연실에 3분간 그냥 서 있어도 같은 NPC 가 온다.
 *   게임이 흡연만 보상하는 구조가 되지 않도록.
 */
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { sound } from "@/lib/sound";
import {
  loadMemory,
  saveMemory,
  loadPack,
  savePack,
  applyUpdate,
  bumpMeeting,
  forgetMemory,
  buildMemoryBlock,
  cigarettesLeft,
  turnsLeft,
  hasMetBefore,
  type NpcMemory,
  type PackState,
} from "@/lib/npcMemory";
import { streamChat, requestMemoryUpdate, type Turn } from "@/lib/npcClient";
import { looksLikeCrisis } from "@/lib/npcPrompt";

// ─── 상수 ────────────────────────────────────────────────────

/** 담배 한 개비에 걸리는 실제 시간 */
const CIGARETTE_MS = 12_000;
/** 한 개비 끝나고 이 시간 안에 다시 붙이면 체인 유지 */
const CHAIN_WINDOW_MS = 60_000;
/**
 * 초면일 때 소환에 필요한 연속 개비 수.
 * 4개비(48초)는 지루하다는 피드백을 받아 3개비(36초)로 줄였다.
 * 대신 개비마다 반드시 뭔가 일어나게 해서 빈 개비가 없도록 했다.
 */
const SUMMON_CHAIN_FIRST = 3;
/** 이미 만난 사이면 한 대면 온다 (재방문을 고문으로 만들지 않는다) */
const SUMMON_CHAIN_RETURN = 1;
/** 발자국 소리가 들리는 체인 — 소환 직전 개비 */
const FOOTSTEPS_AT = 2;
/** 비흡연자: 이 시간만큼 그냥 서 있으면 NPC 등장 */
const STANDING_MS = 180_000;
/** 재방문 시 들어오자마자 NPC 가 있을 확률 */
const ALREADY_HERE_CHANCE = 0.4;
/** 문 열리고 실제로 말 걸기까지 */
const ARRIVAL_MS = 2600;

export const NPC_NAME = "박정우";

/** 재방문 첫 인사 — 매번 같은 말이면 금방 대사처럼 느껴진다 */
const RETURN_GREETINGS = [
  "…또 왔네.",
  "어. 왔어?",
  "…오늘도 별로였나 보네.",
  "왔어. 불 있어?",
];

export type Phase = "idle" | "smoking" | "arriving" | "talking";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 스트리밍 중이면 true */
  pending?: boolean;
  /** 위기 감지로 상담 자원을 함께 노출해야 하면 true */
  crisis?: boolean;
};

type SmokingRoomValue = {
  phase: Phase;
  /** 연속으로 피운 개비 수 */
  chain: number;
  /** 현재 개비 진행도 0~1 */
  progress: number;
  /** 재떨이에 쌓인 꽁초 (이번 방문) */
  butts: number;
  footstepsHeard: boolean;
  /** 남은 담배 (하루 한 갑) */
  cigsLeft: number;
  /** 남은 대화 턴 (하루 상한) */
  turnsLeft: number;
  /** 오늘 담배를 다 피웠나 */
  packEmpty: boolean;

  light: () => void;

  messages: ChatMessage[];
  streaming: boolean;
  send: (text: string) => void;
  /** 이름을 알려줄 사이인가 */
  knowsName: boolean;
  /** 아저씨를 만난 횟수 */
  metCount: number;

  /** 흡연실을 나간다 — 대화 요약을 트리거한다 */
  leave: () => void;
  /** "우리 얘기 다 잊어줘" — 되돌릴 수 없으므로 한 번 확인을 받는다 */
  requestForget: () => void;
  confirmForget: () => void;
  cancelForget: () => void;
  pendingForget: boolean;
  /** 기억 갱신 중 */
  saving: boolean;
};

const Ctx = createContext<SmokingRoomValue | null>(null);

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

// ─── Provider ────────────────────────────────────────────────

export function SmokingRoomProvider({ children }: { children: ReactNode }) {
  const [memory, setMemory] = useState<NpcMemory>(loadMemory);
  const [pack, setPack] = useState<PackState>(loadPack);

  const [phase, setPhase] = useState<Phase>("idle");
  const [chain, setChain] = useState(0);
  const [progress, setProgress] = useState(0);
  const [butts, setButts] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingForget, setPendingForget] = useState(false);

  const chainExpiryRef = useRef<number>(0);
  const burnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  /** 이번 방문에서 이미 요약을 보냈는지 (중복 호출 방지) */
  const summarizedRef = useRef(false);

  const summonThreshold = hasMetBefore(memory) ? SUMMON_CHAIN_RETURN : SUMMON_CHAIN_FIRST;

  const persistPack = useCallback((next: PackState) => {
    setPack(next);
    savePack(next);
  }, []);

  // ─── NPC 등장 ──────────────────────────────────────────────

  const summon = useCallback(() => {
    if (phaseRef.current === "arriving" || phaseRef.current === "talking") return;
    setPhase("arriving");
    sound.play("door");
    setTimeout(() => {
      setPhase("talking");
      const met = hasMetBefore(memoryRef.current);
      setMessages([
        {
          id: nextId(),
          role: "assistant",
          content: met
            ? RETURN_GREETINGS[Math.floor(Math.random() * RETURN_GREETINGS.length)]
            : "담배… 끊어.\n\n…라고 하려다 말았다. 라이터 좀.",
        },
      ]);
    }, ARRIVAL_MS);
  }, []);

  // 재방문이면 들어오자마자 이미 있을 수 있다
  useEffect(() => {
    if (hasMetBefore(memoryRef.current) && Math.random() < ALREADY_HERE_CHANCE) {
      summon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 담배 ──────────────────────────────────────────────────

  const light = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    if (cigarettesLeft(pack) <= 0) return;

    // 체인 창이 지났으면 리셋
    const keepChain = Date.now() < chainExpiryRef.current;
    const nextChain = keepChain ? chain + 1 : 1;

    setChain(nextChain);
    setPhase("smoking");
    setProgress(0);
    sound.play("lighter");

    persistPack({ ...pack, smoked: pack.smoked + 1 });

    const started = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / CIGARETTE_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        burnTimerRef.current = null;
        setPhase("idle");
        setProgress(0);
        setButts((b) => b + 1);
        chainExpiryRef.current = Date.now() + CHAIN_WINDOW_MS;
        sound.play("stub");

        if (nextChain === FOOTSTEPS_AT && nextChain < summonThreshold) {
          setTimeout(() => sound.play("footsteps"), 700);
        }
        if (nextChain >= summonThreshold) {
          setTimeout(summon, 900);
        }
      }
    }, 100);
    burnTimerRef.current = tick;
  }, [chain, pack, persistPack, summon, summonThreshold]);

  // 담배를 피우는 도중에 흡연실을 나가도 타이머가 남지 않게
  useEffect(() => () => {
    if (burnTimerRef.current) clearInterval(burnTimerRef.current);
  }, []);

  // 연기 들이마시는 소리 — 개비당 3번
  useEffect(() => {
    if (phase !== "smoking") return;
    const t1 = setTimeout(() => sound.play("inhale"), 800);
    const t2 = setTimeout(() => sound.play("inhale"), 5200);
    const t3 = setTimeout(() => sound.play("inhale"), 9200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // ─── 비흡연자 경로: 그냥 서 있기 ───────────────────────────

  useEffect(() => {
    if (phase === "arriving" || phase === "talking") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "idle" || phaseRef.current === "smoking") summon();
    }, STANDING_MS);
    return () => clearTimeout(t);
    // 대화가 시작되기 전까지 한 번만 건다
  }, [phase === "arriving" || phase === "talking", summon]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 대화 ──────────────────────────────────────────────────

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (turnsLeft(pack) <= 0) return;

      const crisis = looksLikeCrisis(trimmed);
      const userMsg: ChatMessage = { id: nextId(), role: "user", content: trimmed, crisis };
      const replyId = nextId();

      const history: Turn[] = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: replyId, role: "assistant", content: "", pending: true, crisis },
      ]);
      setStreaming(true);
      summarizedRef.current = false;
      persistPack({ ...pack, turns: pack.turns + 1 });

      streamChat({
        memoryBlock: buildMemoryBlock(memoryRef.current),
        messages: history,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === replyId ? { ...m, content: m.content + delta } : m)),
          );
        },
      })
        .then((result) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== replyId) return m;
              const content = result.ok
                ? m.content
                : m.content || (result as { message: string }).message;
              return { ...m, content, pending: false };
            }),
          );
        })
        .finally(() => setStreaming(false));
    },
    [pack, persistPack, streaming],
  );

  // ─── 기억 갱신 ─────────────────────────────────────────────

  const flushMemory = useCallback(async () => {
    if (summarizedRef.current) return;
    const convo = messagesRef.current.filter((m) => m.content.trim());
    // 사용자가 실제로 말을 한 대화만 기억한다
    if (!convo.some((m) => m.role === "user")) return;

    summarizedRef.current = true;
    setSaving(true);
    try {
      const update = await requestMemoryUpdate({
        memoryBlock: buildMemoryBlock(memoryRef.current),
        messages: convo.map((m) => ({ role: m.role, content: m.content })),
      });
      const next = update
        ? applyUpdate(memoryRef.current, update)
        : bumpMeeting(memoryRef.current); // 요약 실패해도 만남은 기록한다
      setMemory(next);
      saveMemory(next);
    } finally {
      setSaving(false);
    }
  }, []);

  const leave = useCallback(() => {
    void flushMemory();
  }, [flushMemory]);

  // 삭제는 되돌릴 수 없다 — 한 번 확인을 받는다
  const requestForget = useCallback((): void => {
    setPendingForget(true);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: "…진짜로?\n한 번 지우면 못 되돌린다. 확실하면 \"응\" 이라고 해.",
      },
    ]);
  }, []);

  const cancelForget = useCallback(() => setPendingForget(false), []);

  const confirmForget = useCallback(() => {
    setPendingForget(false);
    summarizedRef.current = true; // 지운 뒤에 요약이 덮어쓰지 않도록
    const empty = forgetMemory();
    setMemory(empty);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: "…그래. 없던 걸로 하자.\n\n(아저씨가 당신에 대해 알던 걸 전부 잊었다)",
      },
    ]);
  }, []);

  // 언마운트 시에도 기억을 남긴다
  useEffect(() => () => { void flushMemory(); }, [flushMemory]);

  const value = useMemo<SmokingRoomValue>(
    () => ({
      phase,
      chain,
      progress,
      butts,
      footstepsHeard: chain >= FOOTSTEPS_AT,
      cigsLeft: cigarettesLeft(pack),
      turnsLeft: turnsLeft(pack),
      packEmpty: cigarettesLeft(pack) <= 0,
      light,
      messages,
      streaming,
      send,
      knowsName: memory.metCount >= 3,
      metCount: memory.metCount,
      leave,
      requestForget,
      confirmForget,
      cancelForget,
      pendingForget,
      saving,
    }),
    [
      phase, chain, progress, butts, pack, light, messages, streaming, send, memory,
      leave, requestForget, confirmForget, cancelForget, pendingForget, saving,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmokingRoom(): SmokingRoomValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSmokingRoom must be used inside SmokingRoomProvider");
  return v;
}
