/**
 * WindowWeather — 탕비실 창문
 *
 * 날씨만 보여주던 액자에서 "가끔 뭔가 지나가는 창"으로 바꿨다.
 * 소방차만 있으면 알고 있는 사람만 겨우 알아채니까,
 * 새·고양이·소나기·종이비행기가 랜덤하게 찾아온다.
 *
 * 사건은 브라우저마다 따로 돈다. 대신 창을 두드리면 방에 한 줄이 남아서
 * "어 나도 봤는데" 가 되게 했다.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useClock } from "@/hooks/useClock";
import { useWeather } from "@/hooks/useWeather";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { useRoomEvent } from "@/hooks/useRoomEvent";
import { sound } from "@/lib/sound";

/** 폭발 후 소방차가 지나가기까지 / 지나가는 데 걸리는 시간 */
const TRUCK_DELAY_MS = 2000;
const TRUCK_RIDE_MS = 5000;

/** 첫 손님까지 / 그 다음부터의 간격 */
const FIRST_VISIT_MS: [number, number] = [22_000, 45_000];
const NEXT_VISIT_MS: [number, number] = [50_000, 115_000];

type Visitor = "bird" | "cat" | "shower" | "plane";

const VISITS: Array<{ kind: Visitor; ms: number; tag: string; weight: number }> = [
  { kind: "bird",   ms: 15_000, tag: "새가 창틀에 앉았다",     weight: 3 },
  { kind: "cat",    ms: 12_000, tag: "고양이가 유리를 두드린다", weight: 2 },
  { kind: "shower", ms: 20_000, tag: "소나기가 지나간다",       weight: 2 },
  { kind: "plane",  ms:  6_500, tag: "종이비행기가 날아간다",   weight: 1 },
];

/** 창을 두드렸을 때 방에 남는 한 줄 */
const KNOCK_MESSAGE: Record<Visitor, string> = {
  bird:   "창문 두드렸더니 새 날아감 🐦",
  cat:    "창밖에 고양이 왔다 🐈 야옹",
  shower: "밖에 소나기 온다 🌧️",
  plane:  "창밖에 종이비행기 지나감 ✈️",
};

const rand = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);

function pickVisit() {
  const total = VISITS.reduce((s, v) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const v of VISITS) { r -= v.weight; if (r <= 0) return v; }
  return VISITS[0];
}

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

/** 창문 + 날씨 + 창밖 손님
 *  compact=true: 모바일 (중앙 컬럼 오른쪽 벽)
 *  compact=false: 데스크탑
 */
export default function WindowWeather({ compact = false }: Props) {
  const now = useClock();
  const h = now.getHours();
  const tod = getTimeOfDay(h);
  const weather = useWeather();
  const { explosionAt, sendMessage, myCup } = useBreakRoom();

  const [truck, setTruck] = useState(false);
  const [visit, setVisit] = useState<{ kind: Visitor; tag: string; key: number } | null>(null);
  const [fleeing, setFleeing] = useState(false);
  const timerRef = useRef<number | null>(null);

  // ── 창밖 손님 스케줄러 — 하나 끝나면 다음을 예약한다 ──
  useEffect(() => {
    let endTimer: number | null = null;

    const schedule = (delay: number) => {
      timerRef.current = window.setTimeout(() => {
        const v = pickVisit();
        setFleeing(false);
        setVisit({ kind: v.kind, tag: v.tag, key: Date.now() });
        if (v.kind === "bird") sound.play("chirp");
        if (v.kind === "cat") sound.play("knock");
        endTimer = window.setTimeout(() => {
          setVisit(null);
          schedule(rand(NEXT_VISIT_MS));
        }, v.ms);
      }, delay);
    };

    schedule(rand(FIRST_VISIT_MS));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (endTimer) clearTimeout(endTimer);
    };
  }, []);

  // 전자레인지가 터지면 잠시 뒤 창밖으로 소방차가 지나간다
  // (useRoomEvent — 흡연실 갔다 돌아올 때 지난 폭발이 다시 재생되면 안 된다)
  useRoomEvent(explosionAt, () => {
    const show = setTimeout(() => setTruck(true), TRUCK_DELAY_MS);
    const hide = setTimeout(() => setTruck(false), TRUCK_DELAY_MS + TRUCK_RIDE_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  });

  // ── 창 두드리기 ──
  const knock = useCallback(() => {
    sound.play("knock");
    if (!visit) return;
    if (visit.kind === "bird") {
      // 놀라서 날아간다
      if (fleeing) return;
      setFleeing(true);
      sound.play("chirp");
    } else if (visit.kind === "cat") {
      sound.play("purr");
    }
    if (myCup) sendMessage(KNOCK_MESSAGE[visit.kind]);
  }, [visit, fleeing, myCup, sendMessage]);

  const sky: [string, string] =
    tod === "night" || tod === "evening"
      ? TIME_SKY[tod]
      : weather.sky;

  const isNight = tod === "night";
  const isRainy = ["비","소나기","이슬비","폭우"].includes(weather.label);
  const raining = isRainy || visit?.kind === "shower";

  // 창문을 키웠다 — 벽의 주인공이 되게
  const W = compact ? 118 : 176;
  const H = compact ? 134 : 148;
  const borderW = compact ? 4 : 6;
  const px = (n: number) => Math.round(n * (compact ? 0.72 : 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 4, alignItems: "stretch" }}>
      {/* 창밖 사건 자막 — 창 위에 잠깐 */}
      <div style={{
        height: compact ? 11 : 14,
        fontFamily: "'DotGothic16', monospace",
        fontSize: compact ? 7 : 9,
        color: "hsl(30 25% 40%)",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        pointerEvents: "none",
      }}>
        {visit && !fleeing && (
          <span key={visit.key} className="event-tag" style={{ display: "inline-block" }}>
            {visit.tag}
          </span>
        )}
        {truck && <span className="event-tag" style={{ display: "inline-block", color: "hsl(2 55% 42%)" }}>🚒 삐뽀삐뽀</span>}
      </div>

      {/* 창문 */}
      <div
        onClick={knock}
        title={visit?.kind === "bird" ? "…쫓지 마" : "창문 두드리기"}
        style={{
          width: W, height: H,
          background: `linear-gradient(to bottom, ${sky[0]}, ${sky[1]})`,
          border: `${borderW}px solid hsl(30 25% 25%)`,
          boxShadow: truck
            ? "3px 3px 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.3), 0 0 14px 3px rgba(224,48,32,0.55)"
            : "3px 3px 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.3)",
          position: "relative", overflow: "hidden",
          flexShrink: 0,
          cursor: "pointer",
          transition: "box-shadow 0.3s",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* 먼 건물 실루엣 — 창에 깊이를 준다 */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", opacity: isNight ? 0.85 : 0.22, pointerEvents: "none" }}>
          {[[2, 46], [20, 66], [40, 38], [56, 58], [76, 48]].map(([x, hh], i) => (
            <div key={i} style={{
              position: "absolute", left: `${x}%`, bottom: 0,
              width: "17%", height: `${hh}%`,
              background: isNight ? "#0d1424" : "hsl(210 18% 38%)",
            }}>
              {isNight && [0, 1].map((r) => (
                <div key={r} style={{
                  position: "absolute", left: r ? "55%" : "18%", top: `${18 + r * 34}%`,
                  width: px(4), height: px(4),
                  background: (i + r) % 3 === 0 ? "#ffdd88" : "transparent",
                }} />
              ))}
            </div>
          ))}
        </div>

        {/* 빗줄기 — 실제 날씨 또는 소나기 이벤트 */}
        {raining && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.6, pointerEvents: "none" }}>
            {[8, 22, 34, 47, 58, 71, 84, 93].map((l, i) => (
              <div key={l} className="rain-line" style={{
                position: "absolute", left: `${l}%`, top: 0,
                width: 1, height: "38%",
                background: "linear-gradient(to bottom, transparent, rgba(150,195,235,0.95))",
                animationDelay: `${(i % 4) * 0.13}s`,
                animationDuration: `${0.48 + (i % 3) * 0.09}s`,
              }} />
            ))}
            {/* 유리에 맺혀 흐르는 물방울 */}
            {[18, 55, 79].map((l, i) => (
              <div key={`d${l}`} className="glass-drop" style={{
                position: "absolute", left: `${l}%`, top: `${8 + i * 12}%`,
                width: px(3), height: px(5),
                borderRadius: "50% 50% 60% 60%",
                background: "rgba(225,242,255,0.8)",
                animationDelay: `${i * 0.9}s`,
              }} />
            ))}
          </div>
        )}

        {/* 소나기가 지나가는 동안 살짝 어두워진다 */}
        {visit?.kind === "shower" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(40,55,80,0.28)", pointerEvents: "none" }} />
        )}

        {/* 날씨 요소 */}
        {isNight ? (
          <>
            <div style={{ position: "absolute", top: px(8), right: px(12), fontSize: px(24) }}>🌙</div>
            <div style={{ position: "absolute", top: px(6), left: px(14), fontSize: px(9) }}>✦</div>
            <div style={{ position: "absolute", top: px(26), left: px(38), fontSize: px(7) }}>✦</div>
            <div style={{ position: "absolute", top: px(44), left: px(18), fontSize: px(6) }}>✦</div>
          </>
        ) : tod === "evening" ? (
          <div style={{ position: "absolute", top: px(8), right: px(10), fontSize: px(24) }}>🌆</div>
        ) : (
          <>
            <div style={{ position: "absolute", top: px(8), right: px(10), fontSize: px(26) }}>{weather.icon}</div>
            {!raining && <div style={{ position: "absolute", top: px(14), left: px(12), fontSize: px(18), opacity: 0.7 }}>☁</div>}
          </>
        )}

        {/* ── 창밖 손님 ── */}
        {visit?.kind === "plane" && (
          <div className="paper-plane" style={{
            position: "absolute", top: "38%", left: 0,
            fontSize: px(15), pointerEvents: "none", zIndex: 3,
          }}>✈️</div>
        )}

        {visit?.kind === "bird" && (
          <Bird w={px(34)} fleeing={fleeing} night={isNight} />
        )}

        {visit?.kind === "cat" && (
          <CatPaw px={px} night={isNight} />
        )}

        {/* 소방차 — 폭발 뒤에만 */}
        {truck && (
          <div className="fire-truck" style={{
            position: "absolute",
            bottom: px(10),
            left: 0,
            width: px(58),
            pointerEvents: "none",
            zIndex: 4,
          }}>
            <div className="beacon-light" style={{
              width: px(6), height: px(6),
              margin: `0 auto ${px(2)}px`,
            }} />
            <div style={{
              height: px(18),
              background: "#c8241c",
              border: "2px solid #4a0c08",
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              padding: "0 2px",
              position: "relative",
            }}>
              {/* 사다리 */}
              <div style={{
                position: "absolute", left: "22%", right: "8%", top: px(3), height: px(3),
                background: "#e8d8b0", borderTop: "1px solid #4a0c08",
              }} />
              <div style={{ width: px(6), height: px(6), background: "#221a16", borderRadius: "50%", marginBottom: -2 }} />
              <div style={{ width: px(6), height: px(6), background: "#221a16", borderRadius: "50%", marginBottom: -2 }} />
            </div>
          </div>
        )}

        {/* 창살 — 창밖 요소 위에 그려야 진짜 유리 너머로 보인다 */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: compact ? 3 : 5, background: "hsl(30 25% 25%)", transform: "translateX(-50%)", zIndex: 5, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: compact ? 3 : 5, background: "hsl(30 25% 25%)", transform: "translateY(-50%)", zIndex: 5, pointerEvents: "none" }} />

        {/* 반사광 */}
        <div style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none", background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 55%)" }} />

        {/* 실시간 표시 (좌상단 작은 도트) */}
        {weather.isReal && (
          <div style={{ position: "absolute", top: 3, left: 4, zIndex: 7, width: compact ? 4 : 6, height: compact ? 4 : 6, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 4px #2ecc71" }} />
        )}
      </div>

      {/* 창틀 아래 — 창턱 */}
      <div style={{
        height: compact ? 6 : 10,
        width: W + borderW * 2 - 2,
        marginLeft: -borderW + 2,
        background: "hsl(30 35% 50%)",
        border: `${compact ? 1 : 2}px solid hsl(30 25% 25%)`,
        marginTop: -4,
        boxSizing: "border-box",
      }} />

      {/* 날씨 + 기온 — 폰에서는 상단 바가 이미 "현재 기온 29°C · 구름조금"
          을 띄우고 있어서 같은 말을 두 번 한다. 창턱만 남기고 뺀다 */}
      {!compact && <div style={{
        fontFamily: "'DotGothic16', monospace",
        fontSize: compact ? 8 : 9,
        background: "rgba(255,255,255,0.45)",
        border: `${compact ? 1 : 2}px solid hsl(30 25% 55%)`,
        padding: compact ? "2px 4px" : "3px 7px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 3 : 5,
        width: W + borderW * 2,
        marginLeft: -borderW,
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 12 }}>{weather.icon}</span>
        <span style={{ color: "hsl(30 25% 28%)" }}>
          {`${weather.label}${weather.temp !== null ? ` ${weather.temp}°C` : ""}`}
        </span>
      </div>}
    </div>
  );
}

/** 밤에는 실루엣이 밤하늘·건물에 묻힌다 — 테두리에 빛을 둘러 띄운다 */
const rimLight = (night: boolean) =>
  night
    ? "drop-shadow(0 0 2px rgba(230,240,255,0.95)) drop-shadow(0 0 5px rgba(180,210,255,0.55))"
    : "drop-shadow(1px 2px 0 rgba(0,0,0,0.28))";

/* ─── 창틀에 앉은 새 ──────────────────────────────────────── */
function Bird({ w, fleeing, night }: { w: number; fleeing: boolean; night: boolean }) {
  return (
    <div
      className={fleeing ? "bird-flee" : "bird-land"}
      style={{
        position: "absolute",
        // 창턱에 발을 붙인다
        bottom: 0, right: "16%",
        width: w, height: w,
        zIndex: 4, pointerEvents: "none",
        transformOrigin: "center bottom",
        filter: rimLight(night),
      }}
    >
      <svg viewBox="0 0 22 22" width={w} height={w} style={{ imageRendering: "pixelated", display: "block", overflow: "visible" }}>
        {/* 다리 */}
        <rect x="9" y="18" width="1.6" height="4" fill="#c8862a" />
        <rect x="12" y="18" width="1.6" height="4" fill="#c8862a" />
        {/* 몸통 */}
        <ellipse cx="11" cy="13" rx="7" ry="5.6" fill="#6a7f96" stroke="#2b3541" strokeWidth="1.6" />
        {/* 배 */}
        <ellipse cx="10" cy="15" rx="4" ry="3" fill="#d9e2ea" />
        {/* 날개 */}
        <path d="M12,10 Q17,11 16,15 Q13,15 12,10 Z" fill="#4e6076" stroke="#2b3541" strokeWidth="1.2" />
        {/* 머리 */}
        <circle cx="6" cy="8.5" r="4.4" fill="#6a7f96" stroke="#2b3541" strokeWidth="1.6" />
        {/* 눈 */}
        <circle cx="4.8" cy="7.8" r="1.15" fill="#151c24" />
        <circle cx="4.5" cy="7.5" r="0.4" fill="#fff" />
        {/* 부리 */}
        <path d="M1.6,9 L4.4,7.8 L4.4,10.2 Z" fill="#e8a12c" stroke="#2b3541" strokeWidth="0.9" strokeLinejoin="round" />
        {/* 꼬리 */}
        <path d="M17,12 L21.5,10.5 L21,14.5 Z" fill="#4e6076" stroke="#2b3541" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ─── 유리를 두드리는 고양이 ──────────────────────────────── */
function CatPaw({ px, night }: { px: (n: number) => number; night: boolean }) {
  const pawW = px(24);
  return (
    <>
      {/* 창턱 아래에서 올라온 머리 */}
      <div className="cat-peek" style={{
        position: "absolute", bottom: 0, left: "13%",
        zIndex: 4, pointerEvents: "none", lineHeight: 0,
        filter: rimLight(night),
      }}>
        <svg viewBox="0 0 40 26" width={px(44)} height={px(29)} style={{ imageRendering: "pixelated", display: "block" }}>
          {/* 귀 */}
          <path d="M6,14 L9,3 L16,11 Z"  fill="#3a3a42" stroke="#1d1d24" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M34,14 L31,3 L24,11 Z" fill="#3a3a42" stroke="#1d1d24" strokeWidth="1.6" strokeLinejoin="round" />
          {/* 머리 */}
          <ellipse cx="20" cy="19" rx="15" ry="12" fill="#4a4a54" stroke="#1d1d24" strokeWidth="2" />
          {/* 눈 */}
          <ellipse cx="14" cy="17" rx="3.4" ry="4" fill="#e8d44a" />
          <ellipse cx="26" cy="17" rx="3.4" ry="4" fill="#e8d44a" />
          <rect x="13.2" y="14" width="1.6" height="6.4" fill="#141418" />
          <rect x="25.2" y="14" width="1.6" height="6.4" fill="#141418" />
          {/* 코 */}
          <path d="M18.6,22 L21.4,22 L20,23.8 Z" fill="#e0919c" />
          {/* 수염 */}
          <rect x="2"  y="20" width="8" height="1" fill="#c8c8d0" opacity="0.75" />
          <rect x="30" y="20" width="8" height="1" fill="#c8c8d0" opacity="0.75" />
        </svg>
      </div>

      {/* 유리를 두드리는 앞발 */}
      <div className="paw-tap" style={{
        position: "absolute", bottom: px(16), left: "40%",
        zIndex: 4, pointerEvents: "none", lineHeight: 0,
        filter: rimLight(night),
      }}>
        <svg viewBox="0 0 24 22" width={pawW} height={Math.round(pawW * 22 / 24)} style={{ imageRendering: "pixelated", display: "block" }}>
          <ellipse cx="12" cy="14" rx="9" ry="7.5" fill="#4a4a54" stroke="#1d1d24" strokeWidth="2" />
          {/* 젤리 */}
          <ellipse cx="12" cy="16" rx="4.2" ry="3.4" fill="#e0919c" />
          <circle cx="6.5"  cy="8.5" r="2.4" fill="#e0919c" />
          <circle cx="12"   cy="6.8" r="2.4" fill="#e0919c" />
          <circle cx="17.5" cy="8.5" r="2.4" fill="#e0919c" />
        </svg>
      </div>
    </>
  );
}
