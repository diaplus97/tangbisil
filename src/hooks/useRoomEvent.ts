import { useEffect, useRef } from "react";

/**
 * 방을 나갔다 들어와도 지난 사건이 다시 터지지 않게 한다.
 *
 * Provider 가 탕비실/흡연실을 다 감싸고 있어서 explosionAt 같은 값은
 * 방을 옮겨도 살아남는다. 그런데 씬 컴포넌트는 언마운트/리마운트되니까
 * useEffect([explosionAt]) 는 돌아올 때마다 "새 사건"으로 착각하고 다시 실행된다.
 * (흡연실 갔다 오면 방이 계속 흔들리던 버그)
 *
 * 마운트 시점의 값은 이미 지나간 일로 보고 넘긴다.
 */
export function useRoomEvent(stamp: number | null, run: () => void | (() => void)) {
  // 첫 렌더의 값 = 내가 자리를 비운 사이에 (혹은 아까) 일어난 일
  const seenRef = useRef<number | null>(stamp);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!stamp || stamp === seenRef.current) return;
    seenRef.current = stamp;
    return runRef.current();
  }, [stamp]);
}
