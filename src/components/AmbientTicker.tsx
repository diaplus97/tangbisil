/**
 * AmbientTicker — 레이아웃 최상위에 배치되는 얇은 뉴스/앰비언트 띠
 * - props 없이 자체적으로 훅 사용 (방 씬 외부에 배치 가능)
 * - 미세먼지 정보는 표시 안 함 (StatusClock 에서만 표시)
 * - 뉴스: 한국 뉴스 헤드라인 / 없으면 앰비언트 문구로 대체
 */
import { useState, useEffect, useRef } from "react";
import { useClock } from "@/hooks/useClock";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWeather } from "@/hooks/useWeather";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useNews } from "@/hooks/useNews";

const AMBIENT: string[] = [
  "잠깐의 여유, 탕비실에서 ☕",
  "물 한 잔 마시는 것도 좋아요 💧",
  "커피 한 잔이 위로가 되는 시간",
  "지금 이 순간, 잠깐 숨 고르기",
  "바쁜 일상 속 작은 쉼표 🌱",
  "오늘도 천천히 버텨봅시다",
  "잠깐 쉬어가도 괜찮아요",
  "오늘 하루도 파이팅입니다",
  "커피 향이 좋은 하루 되세요 ☕",
];

function timePhrase(): string {
  const h = new Date().getHours();
  if (h < 7)  return "이른 새벽, 수고 많으세요 ⭐";
  if (h < 9)  return "좋은 아침이에요 ☀️ 커피 한 잔으로 시작해요";
  if (h < 12) return "커피 한잔 하기 좋은 오전이에요 ☕";
  if (h < 14) return "점심 시간, 잠깐 쉬어가세요";
  if (h < 18) return "오후의 짧은 쉬는 시간 ☕";
  if (h < 22) return "오늘 하루도 수고 많으셨습니다 🌙";
  return "야근 중이시군요, 수고 많으세요 ⭐";
}

type TickerItem =
  | { kind: "text"; text: string }
  | { kind: "news"; text: string; url: string };

function buildItems(
  weather: ReturnType<typeof useWeather>,
  news: ReturnType<typeof useNews>
): TickerItem[] {
  const items: TickerItem[] = [];

  // 날씨 (기온만, 미세먼지 제외)
  if (weather.isReal && weather.temp !== null) {
    items.push({ kind: "text", text: `현재 기온 ${weather.temp}°C · ${weather.label} ${weather.icon}` });
    if (weather.temp < 3)  items.push({ kind: "text", text: "오늘 날씨가 많이 춥네요 🧥 따뜻하게 입으세요" });
    if (weather.temp > 30) items.push({ kind: "text", text: "폭염 주의! 수분 보충 자주 해주세요 💦" });
    if (["비","소나기","이슬비","폭우"].includes(weather.label)) {
      items.push({ kind: "text", text: "오늘 우산 챙기셨나요? ☂️" });
    }
  }

  // 시간대 문구
  items.push({ kind: "text", text: timePhrase() });

  // 요일 기반 앰비언트
  const dayIdx = new Date().getDay();
  items.push({ kind: "text", text: AMBIENT[dayIdx % AMBIENT.length] });

  // 뉴스 헤드라인
  for (const n of news.slice(0, 5)) {
    items.push({ kind: "news", text: n.title, url: n.url });
  }

  // 뉴스 없을 때 앰비언트 추가
  if (news.length === 0) {
    items.push({ kind: "text", text: AMBIENT[(dayIdx + 3) % AMBIENT.length] });
    items.push({ kind: "text", text: AMBIENT[(dayIdx + 6) % AMBIENT.length] });
  }

  return items;
}

export default function AmbientTicker() {
  const weather = useWeather();
  const air = useAirQuality();  // isReal 여부만 사용 (실시간 표시 dot)
  const news = useNews();

  const items = buildItems(weather, news);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const idxRef = useRef(0);

  useEffect(() => {
    if (idxRef.current >= items.length) {
      idxRef.current = 0;
      setIdx(0);
    }
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % items.length;
        setIdx(idxRef.current);
        setVisible(true);
      }, 500);
    }, 11000);
    return () => clearInterval(t);
  }, [items.length]);

  const isMobile = useIsMobile();
  const now = useClock();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const current = items[idx] ?? items[0];
  if (!current) return null;

  const isNews = current.kind === "news";

  return (
    <div style={{
      width: "100%",
      height: 26,
      background: "hsl(30 30% 22%)",
      borderTop: "2px solid hsl(30 25% 14%)",
      borderBottom: "2px solid hsl(30 25% 14%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{
        position: "absolute", left: 10,
        fontFamily: "'DotGothic16', monospace", fontSize: 8,
        color: "hsl(30 25% 48%)", whiteSpace: "nowrap", pointerEvents: "none",
      }}>
        {isNews ? "◈ 뉴스" : "◈ 탕비실"}
      </div>

      {/* 시계 + 실시간 표시 — 여기 두면 벽에서 시계 한 줄을 통째로 뺄 수 있다.
          그만큼 방이 세로로 넓어지고, 방 안의 모든 게 더 크게 그려진다. */}
      <div style={{
        position: "absolute", right: 9,
        display: "flex", alignItems: "center", gap: 5,
        fontFamily: "'DotGothic16', monospace",
        whiteSpace: "nowrap", pointerEvents: "none",
      }}>
        {air.isReal && (
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ec94e", display: "inline-block" }} />
        )}
        <span style={{ fontSize: 8, color: air.color }}>{air.level}</span>
        {/* 데스크탑은 헤더와 벽시계에 이미 시간이 있다 — 폰에서만 */}
        {isMobile && <span style={{ fontSize: 11, color: "hsl(140 60% 72%)", letterSpacing: "0.04em" }}>{timeStr}</span>}
      </div>

      <div
        onClick={isNews ? () => window.open((current as Extract<TickerItem, { kind: "news" }>).url, "_blank", "noopener,noreferrer") : undefined}
        style={{
          fontFamily: "'DotGothic16', monospace",
          fontSize: 9,
          color: isNews ? "hsl(200 62% 78%)" : "hsl(38 55% 80%)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.48s ease",
          letterSpacing: "0.03em",
          maxWidth: "60%",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          cursor: isNews ? "pointer" : "default",
          textDecoration: isNews ? "underline dotted" : "none",
          userSelect: "none",
        }}
        title={isNews ? current.text : undefined}
      >
        {isNews ? `◆ ${current.text}` : current.text}
      </div>
    </div>
  );
}
