/**
 * discovery — 이 사람이 방에서 뭘 이미 찾았나
 *
 * 방에 인터랙션 지점이 14개인데 안내는 "커피를 내려 자리를 잡으세요"
 * 한 줄뿐이라, 처음 온 사람은 서너 개만 발견하고 나간다.
 *
 * 그렇다고 방에 표시를 덕지덕지 붙이면 탕비실이 설명도가 된다.
 * 대신 상단 띠(이미 있는 것)에 **아직 안 해본 것 하나만**, 그것도
 * **지금 실제로 사실인 경우에만** 한 줄 흘린다. 팁이 아니라 관찰이다.
 *
 * 한 번 해본 건 여기 기록되고 다시는 안 나온다.
 */

export type SpotId =
  | "fridge" | "microwave" | "vending" | "dessert" | "fruit"
  | "plant" | "pets" | "smoking" | "peel" | "ninja";

const KEY = "tangbirsil_found_v1";

/* 이미 다른 데서 남기고 있는 흔적은 그대로 읽는다 —
 * 같은 걸 두 군데 저장하면 언젠가 어긋난다 */
const DERIVED: Partial<Record<SpotId, () => boolean>> = {
  plant: () => num("tangbirsil_plant_fed") > 0,
  pets:  () => num("tangbirsil_pet_cat") > 0 || num("tangbirsil_pet_dog") > 0,
  peel:  () => num("tangbirsil_peel_best") > 0,
  ninja: () => num("tangbirsil_ninja_best") > 0,
};

function num(key: string): number {
  try { return Number(localStorage.getItem(key) ?? 0) || 0; } catch { return 0; }
}

function loadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

export function hasFound(id: SpotId): boolean {
  if (DERIVED[id]?.()) return true;
  return loadSet().has(id);
}

/** 해봤다고 기록한다. 이 지점에 대한 안내는 이제 영영 안 나온다. */
export function markFound(id: SpotId): void {
  if (DERIVED[id]) return;   // 파생 항목은 원본이 알아서 남긴다
  try {
    const s = loadSet();
    if (s.has(id)) return;
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}
