/**
 * roomHints — 방이 알아채고 한 줄 흘리는 것
 *
 * 규칙 (이걸 어기면 바로 조잡해진다):
 *   1. 한 번에 하나만. 두 개 이상 절대 안 띄운다.
 *   2. 아직 안 해본 것만. 해봤으면 영영 안 나온다.
 *   3. 지금 실제로 사실인 것만. "냉장고에 뭐가 있다" 는 정말 있을 때만.
 *      팁 목록이면 설명서가 되고, 관찰이면 방이 된다.
 *   4. 방 안에는 아무것도 안 붙인다. 상단 띠 한 줄이 전부다.
 *   5. 다 찾으면 사라지고 원래 앰비언트 문구로 돌아간다.
 */
import { hasFound, type SpotId } from "./discovery";

/** 안내를 고를 때 참고하는 지금 방 상태 */
export type RoomFacts = {
  /** 내가 자리에 있나 (커피를 내렸나) */
  seated: boolean;
  /** 냉장고에 든 개수 (모르면 null) */
  fridgeCount: number | null;
  /** 화분이 목마른가 */
  plantDry: boolean;
  /** 손에 든 것의 id */
  heldId: string | null;
  /** 이 방에 지금 나 말고 누가 있나 */
  others: number;
};

type Hint = {
  id: SpotId;
  text: string;
  /** 지금 이 말을 해도 되는가 — 사실일 때만 true */
  when: (f: RoomFacts) => boolean;
};

/** 위에서부터 우선순위. 앞의 것이 먼저 나온다. */
const HINTS: Hint[] = [
  {
    id: "fridge",
    // 진짜 뭔가 들어 있을 때만. 빈 냉장고를 가리키면 그냥 거짓말이다
    text: "냉장고에 누가 뭘 넣어뒀네요 🧊",
    when: (f) => f.seated && (f.fridgeCount ?? 0) > 0,
  },
  {
    id: "plant",
    text: "화분이 목말라 보여요 💧",
    when: (f) => f.plantDry,
  },
  {
    id: "peel",
    // 사과를 손에 들고 있을 때만 — 그때가 아니면 무슨 말인지 모른다
    text: "사과는 깎아 먹는 재미가 있죠 🔪",
    when: (f) => f.heldId === "apple",
  },
  {
    id: "ninja",
    text: "오렌지는 썰어야 손이 안 끈적해요 🔪",
    when: (f) => f.heldId === "orange",
  },
  {
    id: "microwave",
    text: "냉동실에 만두랑 소세지가 있어요 🥟",
    when: (f) => f.seated,
  },
  {
    id: "smoking",
    text: "복도 끝에서 담배 냄새가 나요 🚬",
    when: (f) => f.seated,
  },
  {
    id: "pets",
    text: "고양이가 카운터를 어슬렁거려요 🐈",
    when: (f) => f.seated,
  },
  {
    id: "vending",
    text: "자판기에 시원한 게 들어와 있어요 🥤",
    when: (f) => f.seated,
  },
  {
    id: "dessert",
    text: "선반에 쿠키가 남아 있네요 🍪",
    when: (f) => f.seated,
  },
  {
    id: "fruit",
    text: "과일 바구니가 채워져 있어요 🍎",
    when: (f) => f.seated,
  },
];

/**
 * 지금 흘릴 한 줄. 없으면 null —
 * 그러면 띠는 평소 문구만 돌린다.
 */
export function pickHint(facts: RoomFacts): string | null {
  for (const h of HINTS) {
    if (hasFound(h.id)) continue;
    if (!h.when(facts)) continue;
    return h.text;
  }
  return null;
}

/** 아직 안 찾은 게 몇 개 남았나 (테스트·디버그용) */
export function remainingCount(): number {
  return HINTS.filter((h) => !hasFound(h.id)).length;
}
