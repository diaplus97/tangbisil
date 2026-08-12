import { useState, useEffect } from "react";

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.9780;

export type AirLevel = "좋음" | "보통" | "나쁨" | "매우나쁨";

export type AirQualityStatus = {
  pm25: number | null;
  level: AirLevel;
  color: string;
  advice: string;
  isReal: boolean;
};

function classify(pm25: number): Omit<AirQualityStatus, "pm25" | "isReal"> {
  if (pm25 < 15)  return { level: "좋음",   color: "#27ae60", advice: "공기 맑음 👌" };
  if (pm25 < 35)  return { level: "보통",   color: "#d4ac0d", advice: "환기 적당히" };
  if (pm25 < 75)  return { level: "나쁨",   color: "#e67e22", advice: "마스크 챙기세요" };
  return             { level: "매우나쁨", color: "#c0392b", advice: "외출 자제 권장" };
}

function demoAirQuality(): AirQualityStatus {
  const h = new Date().getHours();
  const pm25 = [8, 8, 12, 20, 14, 9, 6, 7, 18, 22, 28, 30, 35, 25, 18, 15, 22, 28, 18, 12, 9, 8, 7, 7][h] ?? 12;
  return { pm25, ...classify(pm25), isReal: false };
}

// ── 모듈 레벨 캐시 ──────────────────────────────────────────────
let _cached: AirQualityStatus | null = null;
let _listeners: Array<(s: AirQualityStatus) => void> = [];
let _fetching = false;

function notifyAll(s: AirQualityStatus) {
  _cached = s;
  _listeners.forEach((fn) => fn(s));
}

async function ensureFetch() {
  if (_fetching) return;
  _fetching = true;
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&current=pm2_5&timezone=auto`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("air quality api failed");
    const data = await res.json();
    const pm25: number = Math.round(data.current.pm2_5 ?? 0);
    notifyAll({ pm25, ...classify(pm25), isReal: true });
  } catch {
    // keep demo
  } finally {
    _fetching = false;
  }
}

export function useAirQuality(): AirQualityStatus {
  const [status, setStatus] = useState<AirQualityStatus>(() => _cached ?? demoAirQuality());

  useEffect(() => {
    _listeners.push(setStatus);
    if (_cached) setStatus(_cached);
    ensureFetch();
    const t = setInterval(ensureFetch, 15 * 60_000);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== setStatus);
      clearInterval(t);
    };
  }, []);

  return status;
}
