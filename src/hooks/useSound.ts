import { useEffect, useState } from "react";
import { sound } from "@/lib/sound";

/** 사운드 ON/OFF 상태 구독 + 토글 */
export function useSound() {
  const [enabled, setEnabled] = useState(sound.enabled);
  useEffect(() => sound.subscribe(() => setEnabled(sound.enabled)), []);
  return { enabled, toggle: () => sound.setEnabled(!sound.enabled) };
}
