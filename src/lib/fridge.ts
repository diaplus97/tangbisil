/**
 * fridge — 다음 사람에게 남기고 가는 냉장고
 *
 * 동접이 0~1명인 시간이 대부분이라 혼자 들어오면 빈 방이다.
 * 먹을 걸 하나 넣어두고 가면 다음 사람이 꺼내 먹는다 —
 * 같은 시간에 없어도 서로를 느낀다.
 */
import { supabase, isDemoMode } from "./supabase";

export type FridgeItem = {
  id: string;
  itemId: string;
  emoji: string;
  label: string;
  note: string | null;
  fromNick: string;
  fromColor: string;
  fromSid: string;
  createdAt: number;
};

/** 한 사람이 동시에 넣어둘 수 있는 개수 — 한 명이 냉장고를 채워버리지 않게 */
export const MY_LIMIT = 2;
/** 냉장고에 보이는 최대 개수 */
export const SHOW_MAX = 8;
/** 이 시간이 지나면 '상한 것' 으로 보인다 (지우지는 않는다 — 빈 냉장고보단 낫다) */
export const SPOIL_MS = 14 * 60 * 60_000;

/** 넣을 때 고르는 한 마디. 자유 입력이 아니다 —
 *  냉장고 메모는 며칠 남으니 아무 말이나 붙게 두면 안 된다. */
export const NOTES = [
  "드세요",
  "야근하는 분 힘내세요",
  "손 안 댔습니다",
  "제 건 아니고 주웠어요",
  "이거 맛있어요",
  "누가 좀 드셔주세요",
] as const;

/** 넣을 수 없는 것 — 상해서 이미 못 먹는 것들 */
const NOT_STORABLE = new Set(["burnt-mandu", "burnt-sausage", "messy-orange", "spoiled", "banana-peel"]);

export function canStore(itemId: string): boolean {
  return !NOT_STORABLE.has(itemId);
}

export function isSpoiled(item: FridgeItem): boolean {
  return Date.now() - item.createdAt > SPOIL_MS;
}

/** 꺼냈을 때 손에 들리는 것 — 오래된 건 상해 있다 */
export function takenAs(item: FridgeItem): { id: string; emoji: string; label: string } {
  return isSpoiled(item)
    ? { id: "spoiled", emoji: "🤢", label: `상한 ${item.label}` }
    : { id: item.itemId, emoji: item.emoji, label: item.label };
}

export function agoText(ms: number): string {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60_000));
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.round(hr / 24)}일 전`;
}

type Row = Record<string, unknown>;

function rowToItem(r: Row): FridgeItem {
  return {
    id: String(r.id),
    itemId: String(r.item_id),
    emoji: String(r.emoji),
    label: String(r.label),
    note: r.note ? String(r.note) : null,
    fromNick: String(r.from_nick ?? ""),
    fromColor: String(r.from_color ?? "#888"),
    fromSid: String(r.from_sid ?? ""),
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
}

/* ── 오프라인(데모) 냉장고 ─────────────────────────────────
 * 키가 없으면 서버가 없다. 그래도 냉장고는 열려야 하니
 * 이 탭 안에서만 도는 가짜 냉장고를 쓴다. */
let demoStore: FridgeItem[] = [];
let demoSeeded = false;

function seedDemo(): void {
  if (demoSeeded) return;
  demoSeeded = true;
  const h = 60 * 60_000;
  demoStore = [
    { id: "d1", itemId: "mandu", emoji: "🥟", label: "만두", note: "야근하는 분 힘내세요",
      fromNick: "Anonymous312", fromColor: "#2980b9", fromSid: "demo1", createdAt: Date.now() - 3 * h },
    { id: "d2", itemId: "banana", emoji: "🍌", label: "바나나", note: "드세요",
      fromNick: "Anonymous887", fromColor: "#27ae60", fromSid: "demo2", createdAt: Date.now() - 20 * h },
  ];
}

/** 냉장고 안 (아직 아무도 안 꺼낸 것, 최근 순) */
export async function listFridge(): Promise<FridgeItem[]> {
  if (isDemoMode || !supabase) {
    seedDemo();
    return [...demoStore].sort((a, b) => b.createdAt - a.createdAt).slice(0, SHOW_MAX);
  }
  const { data, error } = await supabase
    .from("fridge")
    .select("*")
    .is("taken_by", null)
    .order("created_at", { ascending: false })
    .limit(SHOW_MAX);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToItem);
}

/** 넣어두기. 이미 내 것이 MY_LIMIT 개 있으면 거절한다. */
export async function putInFridge(input: {
  itemId: string; emoji: string; label: string; note: string | null;
  nick: string; color: string; sid: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!canStore(input.itemId)) return { ok: false, reason: "이건 넣어둬도 아무도 안 먹어요" };

  if (isDemoMode || !supabase) {
    seedDemo();
    if (demoStore.filter((i) => i.fromSid === input.sid).length >= MY_LIMIT) {
      return { ok: false, reason: `내가 넣어둔 게 이미 ${MY_LIMIT}개예요` };
    }
    demoStore.push({
      id: `d${Date.now()}`, itemId: input.itemId, emoji: input.emoji, label: input.label,
      note: input.note, fromNick: input.nick, fromColor: input.color,
      fromSid: input.sid, createdAt: Date.now(),
    });
    return { ok: true };
  }

  const { count, error: cErr } = await supabase
    .from("fridge")
    .select("id", { count: "exact", head: true })
    .is("taken_by", null)
    .eq("from_sid", input.sid);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) >= MY_LIMIT) {
    return { ok: false, reason: `내가 넣어둔 게 이미 ${MY_LIMIT}개예요` };
  }

  const { error } = await supabase.from("fridge").insert({
    item_id: input.itemId, emoji: input.emoji, label: input.label, note: input.note,
    from_nick: input.nick, from_color: input.color, from_sid: input.sid,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** 꺼내기. 누가 먼저 꺼냈으면 실패한다 (taken_by is null 조건이 경쟁을 막는다). */
export async function takeFromFridge(id: string, byNick: string): Promise<boolean> {
  if (isDemoMode || !supabase) {
    const before = demoStore.length;
    demoStore = demoStore.filter((i) => i.id !== id);
    return demoStore.length < before;
  }
  const { data, error } = await supabase
    .from("fridge")
    .update({ taken_by: byNick, taken_at: new Date().toISOString() })
    .eq("id", id)
    .is("taken_by", null)   // 이미 꺼내 간 건 여기서 걸러진다
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** 오래된 것 정리 — 함수가 아직 없는 프로젝트도 있으니 실패는 조용히 넘긴다 */
export async function pruneFridge(): Promise<void> {
  if (isDemoMode || !supabase) return;
  const { error } = await supabase.rpc("prune_fridge");
  if (error) console.warn("[탕비실] prune_fridge:", error.message);
}
