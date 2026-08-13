/**
 * petMemory — 고양이·강아지와 쌓인 "정"
 *
 * 쓰다듬거나 먹이를 주면 조금씩 쌓인다. 이 브라우저에만 남는다
 * (흡연실 아저씨의 기억과 같은 원칙 — 서버로 안 보낸다).
 *
 * 정이 쌓이면 달라지는 것:
 *   1단계  이름을 알게 된다
 *   2단계  내 컵 옆으로 와서 앉는다
 *   3단계  가끔 뭘 물어다 준다 (강아지)
 */

export type PetId = "cat" | "dog";

const KEY: Record<PetId, string> = {
  cat: "tangbirsil_pet_cat",
  dog: "tangbirsil_pet_dog",
};

/** 단계가 오르는 지점 */
export const BOND_STEPS = [4, 12, 24] as const;
export const MAX_BOND = 40;

export const PET_NAME: Record<PetId, string> = { cat: "탕비", dog: "누룽지" };

export function loadBond(pet: PetId): number {
  try { return Math.min(MAX_BOND, Number(localStorage.getItem(KEY[pet]) ?? 0) || 0); }
  catch { return 0; }
}

export function addBond(pet: PetId, n = 1): number {
  const next = Math.min(MAX_BOND, loadBond(pet) + n);
  try { localStorage.setItem(KEY[pet], String(next)); } catch { /* ignore */ }
  return next;
}

/** 0 = 아직 남남 / 1 = 이름을 안다 / 2 = 곁에 온다 / 3 = 보답한다 */
export function bondLevel(bond: number): 0 | 1 | 2 | 3 {
  if (bond >= BOND_STEPS[2]) return 3;
  if (bond >= BOND_STEPS[1]) return 2;
  if (bond >= BOND_STEPS[0]) return 1;
  return 0;
}

/** 다음 단계까지 몇 번 남았나 (최고 단계면 null) */
export function toNextStep(bond: number): number | null {
  for (const s of BOND_STEPS) if (bond < s) return s - bond;
  return null;
}

/* ── 먹이 규칙 ────────────────────────────────────────────
 * 강아지는 아무거나 잘 먹는다. 단 초콜릿은 개한테 위험해서 거부한다.
 * 고양이는 따뜻한 것만 관심 있고 나머지는 시크하게 쳐다도 안 본다. */

/** 개에게 절대 주면 안 되는 것 */
const DOG_TOXIC = new Set(["royce"]);

const DOG_FOOD = new Set([
  "sausage", "burnt-sausage", "mandu", "burnt-mandu",
  "cookie", "donut", "candy", "apple", "peeled-apple", "rough-apple",
  "banana", "orange", "sliced-orange", "orange-plate", "messy-orange", "juice",
]);

/** 고양이는 따뜻한 것만 */
const CAT_FOOD = new Set(["sausage", "burnt-sausage", "mandu", "burnt-mandu"]);

export type FeedResult = "eat" | "refuse" | "ignore";

export function feedResult(pet: PetId, itemId: string): FeedResult {
  if (pet === "dog") {
    if (DOG_TOXIC.has(itemId)) return "refuse";
    return DOG_FOOD.has(itemId) ? "eat" : "ignore";
  }
  return CAT_FOOD.has(itemId) ? "eat" : "ignore";
}

/* ── 서로 밟지 않게 ──────────────────────────────────────
 * 고양이와 강아지는 서로의 존재를 모른 채 각자 걸어다닌다.
 * 우연히 같은 자리에 서면 이름표 두 개가 겹쳐서 글자가 안 읽힌다.
 * 컴포넌트를 엮는 대신 "지금 어디로 가는 중" 만 여기서 공유한다. */

const spots: Partial<Record<PetId, number>> = {};

/** 이름표 두 개가 안 겹치려면 최소 이만큼은 떨어져야 한다 (카운터 폭 대비 %) */
export const MIN_GAP_PCT = 12;

/** 지금 서 있는 자리를 알린다. 걷지 않고 자리를 옮긴 경우(시작 위치·도망)에 쓴다 —
 *  등록을 빼먹으면 상대가 그 자리를 비어 있다고 보고 위에 올라선다. */
export function setSpot(pet: PetId, pct: number): void {
  spots[pet] = pct;
}

/** 상대와 겹치지 않는 자리를 고른다. roll 을 몇 번 다시 굴려보고, 안 되면 밀어낸다. */
export function claimSpot(pet: PetId, roll: () => number): number {
  const other = spots[pet === "cat" ? "dog" : "cat"];
  let want = roll();
  if (other != null) {
    for (let i = 0; i < 4 && Math.abs(want - other) < MIN_GAP_PCT; i++) want = roll();
    if (Math.abs(want - other) < MIN_GAP_PCT) {
      want = other > 50 ? other - MIN_GAP_PCT : other + MIN_GAP_PCT;
    }
  }
  const spot = Math.max(6, Math.min(94, want));
  spots[pet] = spot;
  return spot;
}

/** 강아지가 물어다 주는 것 */
export const FETCHABLE = [
  { id: "cookie", emoji: "🍪", label: "쿠키" },
  { id: "candy",  emoji: "🍬", label: "사탕" },
  { id: "apple",  emoji: "🍎", label: "사과" },
  { id: "orange", emoji: "🍊", label: "오렌지" },
  { id: "banana", emoji: "🍌", label: "바나나" },
] as const;
