import { useState, useEffect } from "react";

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.9780;

const WMO: Record<number, { label: string; icon: string; sky: [string, string] }> = {
  0:  { label: "맑음",    icon: "☀️",  sky: ["#87CEEB","#b8e4ff"] },
  1:  { label: "구름조금", icon: "🌤️",  sky: ["#90d0f0","#c0e8ff"] },
  2:  { label: "구름많음", icon: "🌥️",  sky: ["#b0b8c8","#d0d8e8"] },
  3:  { label: "흐림",    icon: "☁️",  sky: ["#a0a8b8","#c0c8d8"] },
  45: { label: "안개",    icon: "🌫️", sky: ["#b8b8b8","#d0d0d0"] },
  48: { label: "안개",    icon: "🌫️", sky: ["#b8b8b8","#d0d0d0"] },
  51: { label: "이슬비",  icon: "🌦️",  sky: ["#8898a8","#b0b8c8"] },
  53: { label: "이슬비",  icon: "🌦️",  sky: ["#8898a8","#b0b8c8"] },
  55: { label: "이슬비",  icon: "🌦️",  sky: ["#8898a8","#b0b8c8"] },
  61: { label: "비",      icon: "🌧️",  sky: ["#7888a0","#a0a8b8"] },
  63: { label: "비",      icon: "🌧️",  sky: ["#7888a0","#a0a8b8"] },
  65: { label: "폭우",    icon: "🌧️",  sky: ["#6878a0","#9098b0"] },
  71: { label: "눈",      icon: "❄️",  sky: ["#d0d8e8","#e8f0f8"] },
  73: { label: "눈",      icon: "❄️",  sky: ["#d0d8e8","#e8f0f8"] },
  75: { label: "폭설",    icon: "❄️",  sky: ["#c8d8e8","#e0e8f0"] },
  80: { label: "소나기",  icon: "🌦️",  sky: ["#8898a8","#b0b8c8"] },
  81: { label: "소나기",  icon: "🌦️",  sky: ["#8898a8","#b0b8c8"] },
  82: { label: "강한 소나기", icon: "🌧️", sky: ["#7888a0","#a0a8b8"] },
  95: { label: "천둥번개", icon: "⛈️", sky: ["#6070a0","#8090b8"] },
  96: { label: "천둥번개", icon: "⛈️", sky: ["#6070a0","#8090b8"] },
  99: { label: "천둥번개", icon: "⛈️", sky: ["#6070a0","#8090b8"] },
};

function wmoInfo(code: number) {
  const keys = Object.keys(WMO).map(Number).sort((a, b) => b - a);
  const match = keys.find((k) => k <= code);
  return WMO[match ?? 0] ?? { label: "기타", icon: "🌡️", sky: ["#87CEEB","#b8e4ff"] as [string, string] };
}

export type WeatherStatus = {
  temp: number | null;
  label: string;
  icon: string;
  sky: [string, string];
  isReal: boolean;
};

function demoWeather(): WeatherStatus {
  const day = new Date().getDay();
  const table: WeatherStatus[] = [
    { temp: null, label: "맑음",    icon: "☀️", sky: ["#87CEEB","#b8e4ff"], isReal: false },
    { temp: null, label: "흐림",    icon: "🌥️", sky: ["#b0b8c8","#d0d8e8"], isReal: false },
    { temp: null, label: "비",      icon: "🌧️", sky: ["#7888a0","#a0a8b8"], isReal: false },
    { temp: null, label: "흐림",    icon: "🌥️", sky: ["#a0a8b8","#c0c8d8"], isReal: false },
    { temp: null, label: "맑음",    icon: "☀️", sky: ["#87CEEB","#b8e4ff"], isReal: false },
    { temp: null, label: "맑음",    icon: "🌤️", sky: ["#90d0f0","#c0e8ff"], isReal: false },
    { temp: null, label: "구름",    icon: "⛅", sky: ["#98a8b8","#c0ccd8"], isReal: false },
  ];
  return table[day];
}

// ── 모듈 레벨 캐시 (여러 컴포넌트에서 같은 훅을 안전하게 공유) ──
let _cached: WeatherStatus | null = null;
let _listeners: Array<(s: WeatherStatus) => void> = [];
let _fetching = false;

function notifyAll(s: WeatherStatus) {
  _cached = s;
  _listeners.forEach((fn) => fn(s));
}

async function ensureFetch() {
  if (_fetching) return;
  _fetching = true;
  try {
    let lat = DEFAULT_LAT, lon = DEFAULT_LON;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, maximumAge: 300_000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch { /* use Seoul */ }
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("weather api failed");
    const data = await res.json();
    const code: number = data.current.weather_code;
    const temp: number = Math.round(data.current.temperature_2m);
    const info = wmoInfo(code);
    notifyAll({ temp, ...info, isReal: true });
  } catch {
    // keep demo
  } finally {
    _fetching = false;
  }
}

export function useWeather(): WeatherStatus {
  const [status, setStatus] = useState<WeatherStatus>(() => _cached ?? demoWeather());

  useEffect(() => {
    _listeners.push(setStatus);
    // If we already have real data, apply immediately
    if (_cached) setStatus(_cached);
    // Trigger fetch if not yet fetched
    ensureFetch();
    // Refresh every 10 min
    const t = setInterval(ensureFetch, 10 * 60_000);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== setStatus);
      clearInterval(t);
    };
  }, []);

  return status;
}
