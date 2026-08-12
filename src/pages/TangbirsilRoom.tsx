import { BreakRoomProvider } from "@/context/BreakRoomContext";
import HeaderBar from "@/components/HeaderBar";
import BreakRoomScene from "@/components/BreakRoomScene";
import ComposerBar from "@/components/ComposerBar";
import AmbientTicker from "@/components/AmbientTicker";

export default function TangbirsilRoom() {
  return (
    <BreakRoomProvider>
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
