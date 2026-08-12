import { useClock } from "@/hooks/useClock";
import { useAirQuality } from "@/hooks/useAirQuality";

const STATUS_CYCLE = [
  "탕비실 온도 쾌적",
  "커피 잔여량 충분",
  "오늘 방문 +1",
  "눈에 피로 쌓이는 중",
  "쉬어가도 괜찮아요",
];

/** 디지털 시계 + 미세먼지 상태 (실시간 또는 데모) */
export default function StatusClock() {
  const now = useClock();
  const air = useAirQuality();

  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const colon = now.getSeconds() % 2 === 0;

  // 30초마다 상태 텍스트 변경
  const statusIdx = Math.floor(now.getTime() / 30000) % STATUS_CYCLE.length;
  const statusText = STATUS_CYCLE[statusIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* 디지털 시계 */}
      <div style={{
        background: "#1a1a2e",
        border: "4px solid hsl(30 25% 20%)",
        boxShadow: "3px 3px 0 rgba(0,0,0,0.45)",
        padding: "5px 8px",
        fontFamily: "monospace",
        fontSize: 20, letterSpacing: "0.04em",
        color: "#44ff88",
        textShadow: "0 0 8px #44ff88",
        textAlign: "center",
        minWidth: 80,
      }}>
        {h}<span style={{ opacity: colon ? 1 : 0.15 }}>:</span>{m}
      </div>

      {/* 미세먼지 실시간 */}
      <div style={{
        background: "#1a1a2e",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.4)",
        padding: "3px 5px",
        fontFamily: "'DotGothic16', monospace",
        fontSize: 8,
        color: air.color,
        textAlign: "center",
        overflow: "hidden",
        minWidth: 80,
        whiteSpace: "nowrap",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {air.isReal && (
          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: air.color, boxShadow: `0 0 4px ${air.color}`, flexShrink: 0 }} />
        )}
        미세먼지 {air.level}
        {air.pm25 !== null && air.isReal && ` ${air.pm25}㎍`}
      </div>

      {/* 상태 스크롤 */}
      <div style={{
        background: "#1a1a2e",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.4)",
        padding: "3px 5px",
        fontFamily: "'DotGothic16', monospace",
        fontSize: 8,
        color: "#88ccff",
        textAlign: "center",
        overflow: "hidden",
        minWidth: 80,
        whiteSpace: "nowrap",
      }}>
        {statusText}
      </div>
    </div>
  );
}
