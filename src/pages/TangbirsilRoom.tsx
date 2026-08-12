import { useEffect } from "react";
import { BreakRoomProvider } from "@/context/BreakRoomContext";
import HeaderBar from "@/components/HeaderBar";
import BreakRoomScene from "@/components/BreakRoomScene";
import ComposerBar from "@/components/ComposerBar";
import AmbientTicker from "@/components/AmbientTicker";
import { useWeather } from "@/hooks/useWeather";
import { useSound } from "@/hooks/useSound";
import { sound } from "@/lib/sound";

const RAINY_LABELS = ["비", "소나기", "이슬비", "폭우", "강한 소나기", "천둥번개"];

/** 비 오는 날 + 사운드 ON 이면 빗소리 앰비언트 재생 */
function RainAmbience() {
  const weather = useWeather();
  const { enabled } = useSound();
  useEffect(() => {
    sound.setRain(enabled && RAINY_LABELS.includes(weather.label));
    return () => sound.setRain(false);
  }, [weather.label, enabled]);
  return null;
}

export default function TangbirsilRoom() {
  return (
    <BreakRoomProvider>
      <RainAmbience />
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        fontFamily: "'DotGothic16', monospace",
        background: "hsl(38 22% 78%)",
      }}>
        {/* 헤더 */}
        <HeaderBar />

        {/* 앰비언트 티커 — 방 씬 외부에 배치하여 말풍선 겹침 방지 */}
        <AmbientTicker />

        {/* 방 씬 (데스크탑: 3열 / 모바일: 수직 스택) */}
        <BreakRoomScene />

        {/* 컴포저 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "hsl(38 22% 78%)", flexShrink: 0 }}>
          <ComposerBar />
        </div>
      </div>
    </BreakRoomProvider>
  );
}
