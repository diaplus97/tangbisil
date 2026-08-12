import { useEffect, useState } from "react";
import { BreakRoomProvider } from "@/context/BreakRoomContext";
import { SmokingRoomProvider } from "@/context/SmokingRoomContext";
import HeaderBar from "@/components/HeaderBar";
import BreakRoomScene from "@/components/BreakRoomScene";
import SmokingRoom from "@/components/SmokingRoom";
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

type Room = "breakroom" | "smoking";

export default function TangbirsilRoom() {
  const [room, setRoom] = useState<Room>("breakroom");

  const goSmoking = () => {
    sound.play("door");
    setRoom("smoking");
  };

  return (
    <BreakRoomProvider>
      {/* 흡연실에서는 빗소리를 끈다 — 실내 복도 안쪽이라 */}
      {room === "breakroom" && <RainAmbience />}
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        fontFamily: "'DotGothic16', monospace",
        background: room === "smoking" ? "hsl(150 6% 12%)" : "hsl(38 22% 78%)",
      }}>
        {/* 헤더 */}
        <HeaderBar />

        {room === "breakroom" ? (
          <>
            {/* 앰비언트 티커 — 방 씬 외부에 배치하여 말풍선 겹침 방지 */}
            <AmbientTicker />

            {/* 방 씬 (데스크탑: 3열 / 모바일: 수직 스택) */}
            <BreakRoomScene />

            {/* 컴포저 */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "hsl(38 22% 78%)", flexShrink: 0 }}>
              <ComposerBar />
              <SmokingDoor onEnter={goSmoking} />
            </div>
          </>
        ) : (
          <SmokingRoomProvider>
            <SmokingRoom onExit={() => setRoom("breakroom")} />
          </SmokingRoomProvider>
        )}
      </div>
    </BreakRoomProvider>
  );
}

/** 탕비실 구석의 문 — 복도 지나 흡연실로 */
function SmokingDoor({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{
      width: "100%", maxWidth: 1100,
      display: "flex", justifyContent: "flex-end",
      padding: "0 10px 8px",
      flexShrink: 0,
    }}>
      <button
        onClick={onEnter}
        title="복도 끝 흡연실"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px",
          background: "hsl(30 18% 34%)",
          color: "hsl(38 35% 82%)",
          border: "3px solid hsl(30 25% 14%)",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.35)",
          fontFamily: "'DotGothic16', monospace",
          fontSize: 9, letterSpacing: "0.03em",
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <DoorIcon />
        복도 → 흡연실
      </button>
    </div>
  );
}

function DoorIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x="1" y="1" width="10" height="14" fill="hsl(30 22% 26%)" stroke="hsl(30 25% 10%)" strokeWidth="2" />
      <circle cx="8.5" cy="8" r="1.2" fill="hsl(45 40% 70%)" />
    </svg>
  );
}
