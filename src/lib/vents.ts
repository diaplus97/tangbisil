/**
 * vents — 흡연실 하소연 벽
 *
 * 냉장고가 "다음 사람에게 덕담" 이라면 이쪽은 그 반대편이다.
 * 회사 얘기를 한 줄 적고 가면 다음 사람이 읽고 "나도" 를 누른다.
 * 하소연은 공감을 받아야 의미가 생긴다 — 그래서 그 버튼이 핵심이다.
 *
 * 다만 냉장고와 성격이 정반대라 취급도 달라야 한다.
 * 냉장고 메모는 정해진 6개 중 고르게 했지만 하소연을 그렇게 두면
 * 아무 의미가 없다. 자유 입력을 열되 아래를 겹겹이 둔다:
 *
 *   위기 신호   저장 자체를 막고 상담 연결을 안내한다
 *   길이        40자
 *   도배        한 사람당 살아있는 하소연 1개
 *   신고        3회 이상이면 화면에서 감춘다
 */
import { supabase, isDemoMode } from "./supabase";
import { looksLikeCrisis } from "./npcPrompt";

export type Vent = {
  id: string;
  text: string;
  nick: string;
  color: string;
  sid: string;
  agrees: number;
  reports: number;
  createdAt: number;
};

export const MAX_LEN = 40;
/** 패널에 보이는 최대 개수.
 *
 *  처음엔 "최신 5개" 였는데, 사람이 많아지면 내가 쓴 게 몇 분 만에
 *  밀려나 아무도 못 본다. "다음 사람이 읽는다" 는 약속이 깨진다.
 *  그래서 최신순과 공감순 두 갈래로 나눠 보여준다 —
 *  공감을 받은 건 밀려나지 않고 며칠 남는다. */
export const SHOW_MAX = 12;

/** 벽에 직접 붙는 건 두 장. 더 붙이면 낙서가 아니라 게시판이 된다 */
export const WALL_MAX = 2;

export type VentSort = "recent" | "top";
/** 이만큼 신고되면 안 보인다 */
export const HIDE_AT = 3;

const AGREED_KEY = "tangbirsil_vent_agreed";
const REPORTED_KEY = "tangbirsil_vent_reported";

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function addTo(key: string, id: string): void {
  try {
    const s = loadSet(key);
    s.add(id);
    // 무한정 쌓이지 않게 최근 것만 둔다
    localStorage.setItem(key, JSON.stringify([...s].slice(-200)));
  } catch { /* ignore */ }
}

export const hasAgreed = (id: string) => loadSet(AGREED_KEY).has(id);
export const hasReported = (id: string) => loadSet(REPORTED_KEY).has(id);

export function agoText(ms: number): string {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60_000));
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.round(hr / 24)}일 전`;
}

/** 쓴 게 남길 수 있는 것인가 */
export type CheckResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; crisis?: boolean };

export function checkVent(raw: string): CheckResult {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "한 줄 적어주세요" };
  if (text.length > MAX_LEN) return { ok: false, reason: `${MAX_LEN}자까지예요` };
  // 여기서 막는 게 핵심이다. 힘든 얘기를 하러 온 사람에게
  // "저장했습니다" 라고 답하고 끝내면 안 된다.
  if (looksLikeCrisis(text)) {
    return { ok: false, crisis: true, reason: "혼자 두기 어려운 얘기 같아요" };
  }
  return { ok: true, text };
}

type Row = Record<string, unknown>;
const rowToVent = (r: Row): Vent => ({
  id: String(r.id),
  text: String(r.text),
  nick: String(r.nick ?? ""),
  color: String(r.color ?? "#888"),
  sid: String(r.sid ?? ""),
  agrees: Number(r.agrees ?? 0),
  reports: Number(r.reports ?? 0),
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
});

/* ── 오프라인(데모) 벽 ────────────────────────────────────── */
let demo: Vent[] = [];
let seeded = false;
function seed(): void {
  if (seeded) return;
  seeded = true;
  const h = 60 * 60_000;
  demo = [
    { id: "v1", text: "오늘도 정시 퇴근은 글렀다", nick: "Anonymous204", color: "#d35400",
      sid: "demo1", agrees: 7, reports: 0, createdAt: Date.now() - 2 * h },
    { id: "v2", text: "회의가 회의를 부른다", nick: "Anonymous551", color: "#2980b9",
      sid: "demo2", agrees: 12, reports: 0, createdAt: Date.now() - 9 * h },
    { id: "v3", text: "월요일이 벌써 또 온다", nick: "Anonymous773", color: "#16a085",
      sid: "demo3", agrees: 4, reports: 0, createdAt: Date.now() - 26 * h },
  ];
}

/** 벽에 붙은 것들 (신고 많은 건 빼고) */
export async function listVents(sort: VentSort = "recent"): Promise<Vent[]> {
  if (isDemoMode || !supabase) {
    seed();
    const arr = [...demo];
    arr.sort(sort === "top"
      ? (a, b) => b.agrees - a.agrees || b.createdAt - a.createdAt
      : (a, b) => b.createdAt - a.createdAt);
    return arr.slice(0, SHOW_MAX);
  }
  const q = supabase.from("vents").select("*").lt("reports", HIDE_AT).limit(SHOW_MAX);
  const { data, error } = sort === "top"
    ? await q.order("agrees", { ascending: false }).order("created_at", { ascending: false })
    : await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToVent);
}

/** 벽에 붙일 두 장 — 방금 붙은 것 하나, 제일 공감받은 것 하나.
 *  최신만 걸면 사람이 많을 때 잘 쓴 글이 순식간에 사라지고,
 *  공감순만 걸면 벽이 몇 날 며칠 그대로다. 둘을 섞는다. */
export async function listWallVents(): Promise<Vent[]> {
  const [recent, top] = await Promise.all([listVents("recent"), listVents("top")]);
  const out: Vent[] = [];
  if (recent[0]) out.push(recent[0]);
  const best = top.find((v) => v.id !== recent[0]?.id && v.agrees > 0);
  if (best) out.push(best);
  else if (recent[1]) out.push(recent[1]);
  return out.slice(0, WALL_MAX);
}

/** 한 줄 남기고 간다 */
export async function postVent(input: {
  text: string; nick: string; color: string; sid: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const c = checkVent(input.text);
  if (!c.ok) return { ok: false, reason: c.reason };

  if (isDemoMode || !supabase) {
    seed();
    if (demo.some((v) => v.sid === input.sid)) {
      return { ok: false, reason: "이미 하나 붙여두셨어요" };
    }
    demo.push({
      id: `v${Date.now()}`, text: c.text, nick: input.nick, color: input.color,
      sid: input.sid, agrees: 0, reports: 0, createdAt: Date.now(),
    });
    return { ok: true };
  }

  const { count, error: cErr } = await supabase
    .from("vents")
    .select("id", { count: "exact", head: true })
    .eq("sid", input.sid);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) >= 1) return { ok: false, reason: "이미 하나 붙여두셨어요" };

  const { error } = await supabase.from("vents").insert({
    text: c.text, nick: input.nick, color: input.color, sid: input.sid,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** "나도" — 같은 브라우저에서 두 번은 못 누른다 */
export async function agreeVent(id: string): Promise<boolean> {
  if (hasAgreed(id)) return false;
  addTo(AGREED_KEY, id);
  if (isDemoMode || !supabase) {
    const v = demo.find((x) => x.id === id);
    if (v) v.agrees += 1;
    return true;
  }
  const { error } = await supabase.rpc("agree_vent", { vent_id: id });
  if (error) { console.warn("[탕비실] agree_vent:", error.message); return false; }
  return true;
}

export async function reportVent(id: string): Promise<boolean> {
  if (hasReported(id)) return false;
  addTo(REPORTED_KEY, id);
  if (isDemoMode || !supabase) {
    const v = demo.find((x) => x.id === id);
    if (v) v.reports += 1;
    return true;
  }
  const { error } = await supabase.rpc("report_vent", { vent_id: id });
  if (error) { console.warn("[탕비실] report_vent:", error.message); return false; }
  return true;
}

export async function pruneVents(): Promise<void> {
  if (isDemoMode || !supabase) return;
  const { error } = await supabase.rpc("prune_vents");
  if (error) console.warn("[탕비실] prune_vents:", error.message);
}
