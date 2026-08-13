/**
 * npcMemory.ts — 흡연실 NPC 기억 (브라우저 로컬 저장)
 *
 * 기억의 소유자는 브라우저다. 서버는 이걸 받아서 프롬프트에 끼워넣기만 한다.
 * 즉 이 파일이 "상담 챗봇"의 기억 그 자체다.
 *
 * 4층 구조:
 *   1. 단기   — 현재 대화 (여기 저장 안 함, 화면 상태)
 *   2. 요약   — 대화가 끝날 때 3~5줄로 압축 (최근 5개)
 *   3. 프로필 — 지속적인 사실들 (직군, 반복 인물, 장기 고민)
 *   4. 미결   — 아저씨가 준 조언 중 결과를 못 들은 것 ← 재방문의 핵심
 *
 * 프라이버시: 전부 이 브라우저에만 있다. 서버에 저장되지 않는다.
 * forget() 하면 실제로 사라진다.
 */

const KEY_MEMORY = "tangbisil_npc_memory_v1";
const KEY_PACK = "tangbisil_pack_v1";

/** 이름을 알려주기 시작하는 만남 횟수 */
const NAME_REVEAL_AT = 3;
/** 보관할 세션 요약 개수 */
const MAX_SUMMARIES = 5;
/** 동시에 들고 있을 미결 과제 개수 */
const MAX_OPEN_LOOPS = 5;

/** 하루 기본 지급 개비 수 */
export const PACK_SIZE = 20;
/** 자판기에서 한 번에 사는 갑 크기 */
export const BUY_PACK_SIZE = 10;
/** 하루에 구매로 보충할 수 있는 최대 개비 수 */
export const MAX_BOUGHT = 20;
/** 하루에 NPC 와 주고받을 수 있는 최대 턴 수 (비용 상한) */
export const DAILY_TURN_LIMIT = 40;

// ─── 타입 ────────────────────────────────────────────────────

export type SessionSummary = { at: number; text: string };
export type OpenLoop = { at: number; text: string };

export type NpcMemory = {
  version: 1;
  /** 아저씨를 만난 횟수 */
  metCount: number;
  /** 마지막 대화 종료 시각 */
  lastMetAt: number | null;
  /** 지속적인 사실들 (LLM 이 갱신) */
  profile: string;
  summaries: SessionSummary[];
  openLoops: OpenLoop[];
};

export type PackState = {
  /** YYYY-MM-DD — 날짜가 바뀌면 리셋 */
  date: string;
  /** 오늘 피운 개비 수 */
  smoked: number;
  /** 오늘 NPC 와 주고받은 턴 수 */
  turns: number;
  /** 오늘 자판기에서 사서 보충한 개비 수 */
  bought: number;
};

/** summarize 엔드포인트 응답 */
export type MemoryUpdate = {
  profile: string;
  summary: string;
  openLoops: string[];
  closedLoopIndexes: number[];
};

// ─── 기본값 ──────────────────────────────────────────────────

const EMPTY_MEMORY: NpcMemory = {
  version: 1,
  metCount: 0,
  lastMetAt: null,
  profile: "",
  summaries: [],
  openLoops: [],
};

function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ─── 기억 읽기/쓰기 ──────────────────────────────────────────

export function loadMemory(): NpcMemory {
  try {
    const raw = localStorage.getItem(KEY_MEMORY);
    if (!raw) return { ...EMPTY_MEMORY };
    const parsed = JSON.parse(raw) as Partial<NpcMemory>;
    if (parsed.version !== 1) return { ...EMPTY_MEMORY };
    return {
      version: 1,
      metCount: typeof parsed.metCount === "number" ? parsed.metCount : 0,
      lastMetAt: typeof parsed.lastMetAt === "number" ? parsed.lastMetAt : null,
      profile: typeof parsed.profile === "string" ? parsed.profile : "",
      summaries: Array.isArray(parsed.summaries) ? parsed.summaries.slice(-MAX_SUMMARIES) : [],
      openLoops: Array.isArray(parsed.openLoops) ? parsed.openLoops.slice(-MAX_OPEN_LOOPS) : [],
    };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export function saveMemory(m: NpcMemory): void {
  try {
    localStorage.setItem(KEY_MEMORY, JSON.stringify(m));
  } catch {
    /* 용량 초과 등 — 기억을 못 남길 뿐 대화는 계속된다 */
  }
}

/** "우리 얘기 다 잊어줘" — 진짜로 지운다 */
export function forgetMemory(): NpcMemory {
  try {
    localStorage.removeItem(KEY_MEMORY);
  } catch {
    /* ignore */
  }
  return { ...EMPTY_MEMORY };
}

export function hasMetBefore(m: NpcMemory): boolean {
  return m.metCount > 0;
}

// ─── 프롬프트용 기억 블록 조립 ───────────────────────────────

function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function agoLabel(ts: number): string {
  const days = daysSince(ts);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

/**
 * 서버로 보낼 기억 블록.
 * 사용자마다 다르므로 캐시 경계 뒤에 놓인다 (functions/api/chat.ts 참고).
 */
export function buildMemoryBlock(m: NpcMemory): string {
  if (m.metCount === 0) {
    return "<기억>\n비어 있음. 이 사용자와는 초면이다. 아는 척하지 마라.\n</기억>";
  }

  const lines: string[] = ["<기억>"];

  lines.push(`[${m.metCount + 1}번째 만남]`);
  if (m.lastMetAt) lines.push(`[마지막 대화: ${agoLabel(m.lastMetAt)}]`);
  if (m.metCount >= NAME_REVEAL_AT) lines.push("[이름 공개 가능]");

  if (m.profile.trim()) {
    lines.push("", "이 사용자에 대해 아는 것:", m.profile.trim());
  }

  if (m.openLoops.length > 0) {
    lines.push("", "미결 과제 — 인사 직후에 이것부터 결과를 물어봐라:");
    m.openLoops.forEach((l, i) => {
      lines.push(`${i + 1}. (${agoLabel(l.at)}) ${l.text}`);
    });
  }

  if (m.summaries.length > 0) {
    lines.push("", "지난 대화들 (최근 순):");
    [...m.summaries].reverse().forEach((s) => {
      lines.push(`- (${agoLabel(s.at)}) ${s.text}`);
    });
  }

  lines.push("</기억>");
  return lines.join("\n");
}

// ─── 기억 갱신 ───────────────────────────────────────────────

/** summarize 결과를 기억에 병합한다 */
export function applyUpdate(m: NpcMemory, u: MemoryUpdate): NpcMemory {
  const now = Date.now();
  const closed = new Set(u.closedLoopIndexes ?? []);

  const survivingLoops = m.openLoops.filter((_, i) => !closed.has(i));
  const freshLoops: OpenLoop[] = (u.openLoops ?? [])
    .filter((t) => typeof t === "string" && t.trim())
    .map((text) => ({ at: now, text: text.trim() }));

  const summaries = [...m.summaries];
  if (u.summary?.trim()) summaries.push({ at: now, text: u.summary.trim() });

  return {
    version: 1,
    metCount: m.metCount + 1,
    lastMetAt: now,
    profile: u.profile?.trim() || m.profile,
    summaries: summaries.slice(-MAX_SUMMARIES),
    openLoops: [...survivingLoops, ...freshLoops].slice(-MAX_OPEN_LOOPS),
  };
}

/**
 * 요약 호출이 실패했을 때의 최소 갱신 —
 * 만난 횟수와 시각만이라도 남겨서 "3주 만이네"가 계속 동작하게 한다.
 */
export function bumpMeeting(m: NpcMemory): NpcMemory {
  return { ...m, metCount: m.metCount + 1, lastMetAt: Date.now() };
}

// ─── 담배 갑 (일일 사용 상한) ────────────────────────────────

export function loadPack(): PackState {
  const fresh: PackState = { date: todayKey(), smoked: 0, turns: 0, bought: 0 };
  try {
    const raw = localStorage.getItem(KEY_PACK);
    if (!raw) return fresh;
    const p = JSON.parse(raw) as Partial<PackState>;
    if (p.date !== todayKey()) return fresh; // 날짜 바뀌면 새 갑
    return {
      date: todayKey(),
      smoked: typeof p.smoked === "number" ? p.smoked : 0,
      turns: typeof p.turns === "number" ? p.turns : 0,
      bought: typeof p.bought === "number" ? p.bought : 0,
    };
  } catch {
    return fresh;
  }
}

export function savePack(p: PackState): void {
  try {
    localStorage.setItem(KEY_PACK, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function cigarettesLeft(p: PackState): number {
  return Math.max(0, PACK_SIZE + p.bought - p.smoked);
}

/** 오늘 더 살 수 있는가 (대화 턴 상한은 별개라 비용에는 영향이 없다) */
export function canBuyCigarettes(p: PackState): boolean {
  return p.bought < MAX_BOUGHT;
}

/**
 * 자판기에서 한 갑 산다. 살 수 없으면 null.
 * 흡연실과 탕비실을 잇는 유일한 물건이라 저장소를 공유한다.
 */
export function buyCigarettes(): PackState | null {
  const p = loadPack();
  if (!canBuyCigarettes(p)) return null;
  const next: PackState = {
    ...p,
    bought: Math.min(MAX_BOUGHT, p.bought + BUY_PACK_SIZE),
  };
  savePack(next);
  return next;
}

export function turnsLeft(p: PackState): number {
  return Math.max(0, DAILY_TURN_LIMIT - p.turns);
}
