import { useClock } from "@/hooks/useClock";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useBreakRoom, todayKey } from "@/context/BreakRoomContext";

const STATUS_CYCLE = [
  "탕비실 온도 쾌적",
  "커피 잔여량 충분",
  "눈에 피로 쌓이는 중",
  "쉬어가도 괜찮아요",
];

/** 디지털 시계 + 미세먼지 상태 (실시간 또는 데모) */
export default function StatusClock({ compact = false }: { compact?: boolean } = {}) {
  const now = useClock();
  const air = useAirQuality();
  const { stampDays, streak, restMinutes } = useBreakRoom();

  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const colon = now.getSeconds() % 2 === 0;

  // 기본 문구 + 개인 기록 (도장/스트릭/쉼 시간)을 섞어서 30초마다 로테이션
  const cycle = [...STATUS_CYCLE];
  if (stampDays.includes(todayKey())) cycle.push("오늘 출근 도장 ✓");
  if (streak >= 2) cycle.push(`${streak}일 연속 출근 중 🔥`);
  if (restMinutes > 0) cycle.push(`오늘 ${restMinutes}분 쉬는 중 ☕`);

  const statusIdx = Math.floor(now.getTime() / 30000) % cycle.length;
  const statusText = cycle[statusIdx];

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

      {/* 상태 스크롤 — 폰에서는 한 줄 줄인다 (벽 공간이 아깝다) */}
      {!compact && <div style={{
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
      </div>}
    </div>
  );
}
