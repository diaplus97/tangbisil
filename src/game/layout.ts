/**
 * layout.ts — 탕비실 방의 좌표계
 *
 * 방은 고정 논리 해상도(ROOM_W × ROOM_H)로 그리고, 화면 크기에 맞춰 통째로
 * 스케일한다. 픽셀 게임의 방식으로, 폰에서도 요소가 작아지지 않는다.
 *
 * 좌표는 전부 논리 픽셀. 캐릭터의 (x, y)는 "발이 닿는 바닥 지점"이다.
 */

export const ROOM_W = 340;
export const ROOM_H = 540;

/** 벽과 바닥의 경계 (바닥 시작 y) */
export const FLOOR_TOP = 330;
/** 카운터 상판 높이 */
export const COUNTER_TOP = 280;
/** 카운터가 차지하는 가로 범위 */
export const COUNTER_RIGHT = 244;

/** 캐릭터가 걸어다닐 수 있는 범위 (발 기준) */
export const WALK = {
  minX: 16,
  maxX: 324,
  minY: 356,
  maxY: 512,
} as const;

/** 깊이감 — 뒤(작은 y)일수록 살짝 작게 그린다 */
export function depthScale(y: number): number {
  const t = (y - WALK.minY) / (WALK.maxY - WALK.minY);
  return 0.86 + Math.max(0, Math.min(1, t)) * 0.28;
}

export type InteractableId = "coffee" | "microwave" | "shelf" | "vending" | "plant";

export type Interactable = {
  id: InteractableId;
  /** 액션 버튼에 뜨는 이름 */
  label: string;
  icon: string;
  /** 다가가서 서는 지점 (발 기준) */
  stand: { x: number; y: number };
};

/** 상호작용 대상 — 이 지점 근처로 걸어가면 액션 버튼이 뜬다 */
export const INTERACTABLES: Interactable[] = [
  { id: "coffee",    label: "커피 내리기",   icon: "☕", stand: { x: 58,  y: 366 } },
  { id: "microwave", label: "전자레인지",    icon: "🥟", stand: { x: 150, y: 366 } },
  { id: "shelf",     label: "디저트 집기",   icon: "🍪", stand: { x: 200, y: 370 } },
  { id: "vending",   label: "자판기",        icon: "🥤", stand: { x: 292, y: 372 } },
  { id: "plant",     label: "화분에 물 주기", icon: "💧", stand: { x: 300, y: 470 } },
];

/** 이 거리 안에 들어오면 상호작용 가능 */
export const REACH = 42;

/** 발 위치에서 가장 가까운 상호작용 대상 (없으면 null) */
export function nearestInteractable(x: number, y: number): Interactable | null {
  let best: Interactable | null = null;
  let bestD = REACH;
  for (const it of INTERACTABLES) {
    const d = Math.hypot(it.stand.x - x, it.stand.y - y);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

/** 걷기 목표를 바닥 범위 안으로 가둔다 */
export function clampToFloor(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(WALK.minX, Math.min(WALK.maxX, x)),
    y: Math.max(WALK.minY, Math.min(WALK.maxY, y)),
  };
}

/** 캐릭터 걷는 속도 (논리 px / 초) */
export const WALK_SPEED = 78;
