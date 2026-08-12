/**
 * StampWidget — 출근 도장판 + 오늘 쉰 시간
 *
 * 하루 첫 커피를 내리면 도장이 찍힌다 (BreakRoomContext.brew 에서 기록).
 * 최근 7일 도장 + 연속 출근 스트릭 + 오늘 쉰 시간을 보여준다.
 */
import { useBreakRoom } from "@/context/BreakRoomContext";

const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function lastNDays(n: number): { key: string; label: string; isToday: boolean }[] {
  const out: { key: string; label: string; isToday: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push({
      key: `${d.getFullYear()}-${mm}-${dd}`,
      label: DAY_LABEL[d.getDay()],
      isToday: i === 0,
    });
  }
  return out;
}

export default function StampWidget() {
  const { stampDays, streak, restMinutes } = useBreakRoom();
  const days = lastNDays(7);
  const stamped = new Set(stampDays);

  return (
    <div style={{
      background: "rgba(255,255,255,0.5)",
      border: "2px solid hsl(30 25% 55%)",
      boxShadow: "2px 2px 0 rgba(0,0,0,0.25)",
      padding: "4px 6px 5px",
      fontFamily: "'DotGothic16', monospace",
      minWidth: 80,
    }}>
      <div style={{ fontSize: 7, color: "hsl(30 25% 44%)", textAlign: "center", marginBottom: 3 }}>
        ── 출근 도장 ──
      </div>

      {/* 최근 7일 */}
      <div style={{ display: "flex", justifyContent: "center", gap: 3 }}>
        {days.map((d) => (
          <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 6, color: d.isToday ? "hsl(25 80% 42%)" : "hsl(30 20% 55%)" }}>
              {d.label}
            </span>
            <span style={{
              fontSize: 8,
              color: stamped.has(d.key) ? "#c0392b" : "hsl(30 15% 70%)",
            }}>
              {stamped.has(d.key) ? "●" : "○"}
            </span>
          </div>
        ))}
      </div>

      {/* 스트릭 + 쉰 시간 */}
      <div style={{
        marginTop: 3, textAlign: "center", fontSize: 7,
        color: "hsl(30 25% 38%)", lineHeight: 1.6,
      }}>
        {streak >= 2 ? (
          <div style={{ color: "#d35400" }}>🔥 {streak}일 연속 출근</div>
        ) : stamped.has(days[6].key) ? (
          <div style={{ color: "#c0392b" }}>오늘 출근 도장 ✓</div>
        ) : (
          <div>커피 내리면 도장 쾅</div>
        )}
        {restMinutes > 0 && <div>오늘 {restMinutes}분 쉼 ☕</div>}
      </div>
    </div>
  );
}
