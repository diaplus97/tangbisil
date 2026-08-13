import { useEffect, useState } from "react";
import { useClock } from "@/hooks/useClock";
import { useWeather } from "@/hooks/useWeather";
import { useBreakRoom } from "@/context/BreakRoomContext";

/** 폭발 후 소방차가 지나가기까지 / 지나가는 데 걸리는 시간 */
const TRUCK_DELAY_MS = 2000;
const TRUCK_RIDE_MS = 5000;

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(h: number): TimeOfDay {
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

const TIME_SKY: Record<TimeOfDay, [string, string]> = {
  morning:   ["#f4c67e","#f9e09e"],
  afternoon: ["#87CEEB","#b8e4ff"],
  evening:   ["#f4a460","#f08080"],
  night:     ["#1a2a4a","#2a3a5a"],
};

interface Props {
  compact?: boolean;
}

/** 창문 + 날씨 표시
 *  compact=true: 64×56px 창문 (모바일 좌측 68px 컬럼에 맞게)
 *  compact=false (default): 104×90px 창문 (데스크탑)
 */
export default function WindowWeather({ compact = false }: Props) {
  const now = useClock();
  const h = now.getHours();
  const tod = getTimeOfDay(h);
  const weather = useWeather();
  const { explosionAt } = useBreakRoom();
  const [truck, setTruck] = useState(false);

  // 전자레인지가 터지면 잠시 뒤 창밖으로 소방차가 지나간다
  useEffect(() => {
    if (!explosionAt) return;
    const show = setTimeout(() => setTruck(true), TRUCK_DELAY_MS);
    const hide = setTimeout(() => setTruck(false), TRUCK_DELAY_MS + TRUCK_RIDE_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [explosionAt]);

  const sky: [string, string] =
    tod === "night" || tod === "evening"
      ? TIME_SKY[tod]
      : weather.sky;

  const isNight = tod === "night";
  const isRainy = ["비","소나기","이슬비","폭우"].includes(weather.label);

  const W = compact ? 62 : 104;
  const H = compact ? 54 : 90;
  const borderW = compact ? 4 : 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 4 }}>
      {/* 창문 */}
      <div style={{
        width: W, height: H,
        background: `linear-gradient(to bottom, ${sky[0]}, ${sky[1]})`,
        border: `${borderW}px solid hsl(30 25% 25%)`,
        boxShadow: "3px 3px 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.3)",
        position: "relative", overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* 창살 */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: compact ? 3 : 4, background: "hsl(30 25% 25%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: compact ? 3 : 4, background: "hsl(30 25% 25%)" }} />

        {/* 빗줄기 */}
        {isRainy && !isNight && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.55 }}>
            {[15,35,55,75].map((l) => (
              <div key={l} style={{ position: "absolute", left: `${l}%`, top: 0, width: 1, height: "100%", background: "rgba(130,180,220,0.8)" }} />
            ))}
          </div>
        )}

        {/* 날씨 요소 */}
        {isNight ? (
          <>
            <div style={{ position: "absolute", top: compact ? 4 : 6, right: compact ? 5 : 7, fontSize: compact ? 11 : 15 }}>🌙</div>
            <div style={{ position: "absolute", top: 3, left: compact ? 5 : 8, fontSize: compact ? 5 : 7 }}>✦</div>
            {!compact && <div style={{ position: "absolute", top: 14, left: 24, fontSize: 6 }}>✦</div>}
          </>
        ) : tod === "evening" ? (
          <>
            <div style={{ position: "absolute", top: 3, right: compact ? 4 : 6, fontSize: compact ? 10 : 14 }}>🌆</div>
            {!compact && <div style={{ position: "absolute", bottom: 5, left: 7, fontSize: 10 }}>🌃</div>}
          </>
        ) : (
          <>
            <div style={{ position: "absolute", top: compact ? 3 : 5, right: compact ? 4 : 6, fontSize: compact ? 12 : 16 }}>{weather.icon}</div>
            {!isRainy && <div style={{ position: "absolute", top: compact ? 4 : 7, left: compact ? 4 : 7, fontSize: compact ? 8 : 11, opacity: 0.7 }}>☁</div>}
            {tod === "morning" && !isRainy && !compact && (
              <div style={{ position: "absolute", bottom: 5, left: 8, fontSize: 9, opacity: 0.6 }}>🌅</div>
            )}
          </>
        )}

        {/* 소방차 — 폭발 뒤에만 */}
        {truck && (
          <div className="fire-truck" style={{
            position: "absolute",
            bottom: compact ? 4 : 8,
            left: 0,
            width: compact ? 26 : 40,
            pointerEvents: "none",
            zIndex: 2,
          }}>
            <div className="beacon-light" style={{
              width: compact ? 3 : 4, height: compact ? 3 : 4,
              margin: "0 auto 1px",
            }} />
            <div style={{
              height: compact ? 8 : 12,
              background: "#c8241c",
              border: "1px solid #4a0c08",
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              padding: "0 1px",
            }}>
              <div style={{ width: compact ? 3 : 4, height: compact ? 3 : 4, background: "#221a16", borderRadius: "50%", marginBottom: -1 }} />
              <div style={{ width: compact ? 3 : 4, height: compact ? 3 : 4, background: "#221a16", borderRadius: "50%", marginBottom: -1 }} />
            </div>
          </div>
        )}

        {/* 반사광 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />

        {/* 실시간 표시 (우상단 작은 도트) */}
        {weather.isReal && (
          <div style={{ position: "absolute", top: 2, left: 3, width: compact ? 4 : 5, height: compact ? 4 : 5, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 4px #2ecc71" }} />
        )}
      </div>

      {/* 창틀 아래 */}
      <div style={{
        height: compact ? 5 : 7,
        width: W + (borderW * 2) - 2,
        marginLeft: -borderW + 2,
        background: "hsl(30 35% 50%)",
        border: `${compact ? 1 : 2}px solid hsl(30 25% 25%)`,
        marginTop: -4,
      }} />

      {/* 날씨 + 기온 */}
      <div style={{
        fontFamily: "'DotGothic16', monospace",
        fontSize: compact ? 9 : 8,
        background: "rgba(255,255,255,0.45)",
        border: `${compact ? 1 : 2}px solid hsl(30 25% 55%)`,
        padding: compact ? "2px 4px" : "3px 6px",
        display: "flex", alignItems: "center", gap: compact ? 3 : 4,
        // compact: column 폭에 맞게 fluid
        width: compact ? "100%" : undefined,
        maxWidth: compact ? "none" : W + borderW * 2,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>
        <span style={{ fontSize: compact ? 10 : 11 }}>{weather.icon}</span>
        <span style={{ color: "hsl(30 25% 28%)" }}>
          {compact
            ? (weather.temp !== null ? `${weather.temp}°C` : weather.label)
            : `${weather.label}${weather.temp !== null ? ` ${weather.temp}°C` : ""}`}
        </span>
      </div>
    </div>
  );
}
