/**
 * BreakRoomScene — 온라인 탕비실 방 씬
 *
 * 데스크탑 + 모바일 모두 동일한 3열 공간감 유지.
 * 모바일에서는 컬럼 폭을 줄이고 컴팩트 컴포넌트로 대체.
 * 원두/설탕/우유 소품 및 중앙 "탕비실" 사인 제거.
 */
import { useState, useCallback, useRef } from "react";
import CoffeeMachine from "./CoffeeMachine";
import SharedCounter from "./SharedCounter";
import WindowWeather from "./WindowWeather";
import StatusClock from "./StatusClock";
import PlantCorner from "./PlantCorner";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { useIsMobile } from "@/hooks/use-mobile";

export default function BreakRoomScene() {
  const isMobile = useIsMobile();
  const { myCup } = useBreakRoom();

  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: "hsl(38 25% 80%)",
      display: "flex", flexDirection: "column",
      alignItems: "stretch",
      overflow: "hidden",
    }}>
      <RoomLayout compact={isMobile} showHint={!myCup} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RoomLayout — 3열 방 구조 (데스크탑 / 모바일 공통)
   ═══════════════════════════════════════════════════════════════ */
function RoomLayout({ compact, showHint }: { compact: boolean; showHint: boolean }) {
  // 모바일: vw 기반 + 최솟값 보장 → 어떤 폰 너비에서도 content 보호
  const leftW  = compact ? "clamp(72px, 18vw, 90px)"  : "clamp(110px, 17%, 190px)";
  const rightW = compact ? "clamp(92px, 27vw, 112px)" : "clamp(105px, 16%, 182px)";

  return (
    <div style={{
      flex: 1, minHeight: 0,
      maxWidth: compact ? "100%" : 1100, width: "100%",
      margin: "0 auto",
      display: "flex", flexDirection: "column",
      position: "relative",
      boxShadow: compact ? "none" : "0 0 0 3px hsl(30 25% 20%), 5px 0 0 rgba(0,0,0,0.18), -5px 0 0 rgba(0,0,0,0.18)",
    }}>
      {/* 벽 배경 */}
      <WallBackground compact={compact} />

      {/* 3열 그리드 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: `${leftW} 1fr ${rightW}`,
        position: "relative", zIndex: 1,
        overflow: "hidden",
      }}>
        <LeftZone compact={compact} />
        <CenterZone compact={compact} showHint={showHint} />
        <RightZone compact={compact} />
      </div>

      {/* 공유 카운터 */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <SharedCounter />
      </div>
    </div>
  );
}

/* ─── 벽 배경 ────────────────────────────────────────────────── */
function WallBackground({ compact }: { compact: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "hsl(38 26% 86%)", zIndex: 0 }}>
      {/* 벽 세로 줄무늬 (장식) */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${i * 7.14}%`, width: 1, background: "rgba(0,0,0,0.022)" }} />
      ))}
      {/* 상단 몰딩 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: compact ? 5 : 8, background: "hsl(30 35% 68%)", borderBottom: "2px solid hsl(30 25% 52%)" }} />
      {/* 하단 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "hsl(30 35% 62%)" }} />
      {/* 날짜 칩 (데스크탑에만) */}
      {!compact && (
        <div style={{
          position: "absolute", top: 13, right: 12,
          fontFamily: "'DotGothic16', monospace", fontSize: 8,
          color: "hsl(30 25% 40%)", background: "rgba(255,255,255,0.38)",
          border: "2px solid hsl(30 25% 56%)", padding: "2px 5px",
          zIndex: 1,
        }}>
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
        </div>
      )}
    </div>
  );
}

/* ─── 왼쪽 영역 ──────────────────────────────────────────────── */
function LeftZone({ compact }: { compact: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      // 모바일: 수평 패딩 0 → column 폭 전체를 content에 활용
      padding: compact ? "8px 0" : "12px 8px",
      gap: compact ? 6 : 10,
      borderRight: "2px solid rgba(0,0,0,0.06)",
      overflow: "hidden",
      minWidth: 0,
      boxSizing: "border-box",
    }}>
      {/* 창문 — compact 시 실제 작은 크기로 렌더링 */}
      <WindowWeather compact={compact} />

      {/* 디지털 시계 + 먼지 — 데스크탑만 */}
      {!compact && <StatusClock />}

      {/* 화분 — 하단 */}
      <div style={{ marginTop: "auto", flexShrink: 0 }}>
        <PlantCorner compact={compact} />
      </div>
    </div>
  );
}

/* ─── 중앙 영역 ──────────────────────────────────────────────── */
function CenterZone({ compact, showHint }: { compact: boolean; showHint: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center",
      /* justifyContent 제거 — flex spacer로 machine을 아래에 고정 */
      padding: compact ? "6px 4px 4px" : "8px 8px 6px",
      gap: compact ? 4 : 6,
      position: "relative",
      minWidth: 0,
      overflow: "visible",
    }}>
      {/* 전자레인지 — 절대 위치, 레이아웃에 영향 없음 */}
      <MicrowaveStation compact={compact} />

      {/* 빈 벽 공간 — machine을 아래로 밀기 */}
      <div style={{ flex: 1 }} />

      {/* 안내 문구 — 자연스러운 흐름으로 machine 바로 위에 렌더링 */}
      {showHint && (
        <div style={{
          textAlign: "center",
          fontFamily: "'DotGothic16', monospace",
          lineHeight: compact ? 2.0 : 2.4,
          pointerEvents: "none",
          paddingBottom: compact ? 4 : 6,
          zIndex: 0,
        }}>
          <div style={{ fontSize: compact ? 12 : 13, color: "hsl(28 58% 36%)" }}>
            커피를 내려 자리를 잡으세요
          </div>
          {!compact && (
            <div style={{ fontSize: 10, color: "hsl(30 20% 52%)" }}>
              아메리카노 · 믹스커피 · 라떼 중 선택하세요
            </div>
          )}
        </div>
      )}

      {/* 커피 머신 */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <CoffeeMachine compact={compact} />
      </div>
    </div>
  );
}

/* ─── 오른쪽 영역 ────────────────────────────────────────────── */
function RightZone({ compact }: { compact: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-end",
      // 모바일: 수평 패딩 0 → column 폭 전체를 content에 활용
      padding: compact ? "6px 0 6px" : "12px 14px 12px 8px",
      borderLeft: "2px solid rgba(0,0,0,0.06)",
      gap: compact ? 5 : 8,
      minWidth: 0,
      overflow: "hidden",
      boxSizing: "border-box",
    }}>
      <DessertShelf compact={compact} />
      <VendingMachine compact={compact} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MicrowaveStation — 전자레인지 + 냉동만두 드래그/탭 기믹
   데스크탑: 만두 드래그 → 전자레인지에 드롭 → 꺼내기
   모바일  : 만두 탭 → 전자레인지 탭 → 꺼내기
   ═══════════════════════════════════════════════════════════════ */
type MwState = "idle" | "heating" | "done";
const HEAT_MS = 8000;

function MicrowaveStation({ compact }: { compact: boolean }) {
  const { sendMessage, myCup } = useBreakRoom();
  const locked = !myCup;

  const [mwState, setMwState]     = useState<MwState>("idle");
  const [heatPct, setHeatPct]     = useState(0);
  const [selected, setSelected]   = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [popAnim, setPopAnim]     = useState(false);
  const rafRef = useRef<number | null>(null);

  const startHeating = useCallback(() => {
    if (locked || mwState !== "idle") return;
    setSelected(false);
    setPopAnim(true);
    setTimeout(() => setPopAnim(false), 600);
    setMwState("heating");
    setHeatPct(0);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / HEAT_MS) * 100);
      setHeatPct(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setMwState("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [locked, mwState]);

  const takeOut = useCallback(() => {
    if (mwState !== "done") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    sendMessage("냉동만두 꺼냄 🥟 후후~ 식혀야지");
    setMwState("idle");
    setHeatPct(0);
  }, [mwState, sendMessage]);

  const handleMicrowaveClick = () => {
    if (mwState === "done") { takeOut(); return; }
    if (mwState === "idle" && selected) { startHeating(); return; }
  };

  /* ── compact (모바일) ── */
  if (compact) {
    return (
      <div style={{
        position: "absolute", top: 6, left: 4,
        display: "flex", alignItems: "center", gap: 3,
        zIndex: 3,
      }}>
        {/* 냉동만두 — 탭하면 선택, 선택 후 전자레인지 탭 */}
        <button
          onClick={() => {
            if (locked || mwState !== "idle") return;
            setSelected(s => !s);
          }}
          draggable={!locked && mwState === "idle"}
          onDragStart={(e) => {
            if (locked || mwState !== "idle") { e.preventDefault(); return; }
            e.dataTransfer.setData("text/plain", "mandu");
          }}
          disabled={locked || mwState !== "idle"}
          title={locked ? "커피 먼저 내려주세요" : mwState !== "idle" ? "가열 중..." : "만두 탭/드래그"}
          style={{
            fontSize: 17, lineHeight: 1,
            background: selected ? "rgba(255,210,60,0.35)" : "rgba(255,255,255,0.22)",
            border: `2px solid ${selected ? "#ddaa22" : "rgba(110,80,40,0.35)"}`,
            padding: "3px 4px",
            cursor: locked || mwState !== "idle" ? "not-allowed" : "pointer",
            opacity: mwState !== "idle" ? 0.3 : locked ? 0.45 : 1,
            touchAction: "manipulation",
            transition: "all 0.18s",
            boxShadow: selected ? "0 0 7px rgba(255,200,40,0.55)" : "none",
          }}>
          🥟
        </button>

        {/* 상태 화살표 */}
        <span style={{
          fontSize: 8, color: "hsl(30 25% 50%)",
          opacity: selected || mwState !== "idle" ? 1 : 0.3,
          transition: "opacity 0.2s",
        }}>→</span>

        {/* 전자레인지 버튼 */}
        <button
          onClick={handleMicrowaveClick}
          onDragOver={(e) => { if (mwState === "idle" && !locked) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            if (e.dataTransfer.getData("text/plain") === "mandu") startHeating();
          }}
          disabled={mwState === "heating"}
          title={mwState === "done" ? "꺼내기!" : mwState === "heating" ? "가열 중..." : selected ? "투입!" : "만두를 먼저 선택"}
          style={{
            display: "flex", alignItems: "center", gap: 3,
            background: dragOver ? "rgba(180,240,180,0.3)"
              : mwState === "heating" ? "rgba(90,50,220,0.13)"
              : mwState === "done"    ? "rgba(80,200,80,0.22)"
              : "rgba(255,255,255,0.18)",
            border: `2px solid ${
              dragOver         ? "#66bb66"
              : mwState === "heating" ? "#7755cc"
              : mwState === "done"    ? "#44bb44"
              : selected              ? "#ddaa22"
              : "rgba(80,60,40,0.45)"
            }`,
            padding: "3px 5px",
            minWidth: 54,
            cursor: mwState === "done" || (mwState === "idle" && selected) ? "pointer" : "default",
            touchAction: "manipulation",
            transition: "all 0.2s",
          }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>
            {mwState === "done" ? "✨" : mwState === "heating" ? "🔄" : "📦"}
          </span>
          {mwState === "heating" ? (
            <div style={{ width: 26, height: 5, background: "rgba(0,0,0,0.18)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${heatPct}%`, background: "linear-gradient(90deg,#8855ee,#bb88ff)", borderRadius: 3 }} />
            </div>
          ) : mwState === "done" ? (
            <span style={{ fontFamily: "'DotGothic16',monospace", fontSize: 9, color: "#33aa33" }}>꺼내기</span>
          ) : (
            <span style={{ fontFamily: "'DotGothic16',monospace", fontSize: 8, color: "hsl(30 25% 44%)" }}>레인지</span>
          )}
        </button>
      </div>
    );
  }

  /* ── 데스크탑 ── */
  return (
    <div style={{
      position: "absolute", top: 10, left: 8,
      display: "flex", flexDirection: "column", gap: 3,
      zIndex: 3,
    }}>
      <div style={{ fontFamily: "'DotGothic16',monospace", fontSize: 8, color: "hsl(30 25% 44%)" }}>
        ── 전자레인지 ──
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* 냉동만두 아이콘 — draggable */}
        <button
          draggable={!locked && mwState === "idle"}
          onDragStart={(e) => {
            if (locked || mwState !== "idle") { e.preventDefault(); return; }
            e.dataTransfer.setData("text/plain", "mandu");
          }}
          onClick={() => {
            if (locked || mwState !== "idle") return;
            setSelected(s => !s);
          }}
          disabled={locked || mwState !== "idle"}
          title={locked ? "커피를 먼저 내려주세요" : "전자레인지로 드래그하세요"}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            background: selected ? "rgba(255,210,60,0.3)" : "rgba(255,255,255,0.28)",
            border: `2px solid ${selected ? "#ddaa22" : "hsl(30 35% 50%)"}`,
            padding: "4px 6px",
            cursor: locked || mwState !== "idle" ? "not-allowed" : "grab",
            opacity: mwState !== "idle" ? 0.28 : locked ? 0.45 : 1,
            transition: "all 0.15s",
            boxShadow: selected ? "0 0 9px rgba(255,200,40,0.5)" : "none",
          }}>
          <span style={{
            fontSize: 18, lineHeight: 1,
            display: "inline-block",
            transform: popAnim ? "translateX(14px) scale(0.5)" : "none",
            opacity: popAnim ? 0 : 1,
            transition: popAnim ? "all 0.5s ease-in" : "none",
          }}>🥟</span>
          <span style={{ fontFamily: "'DotGothic16',monospace", fontSize: 7, color: "hsl(30 25% 38%)" }}>냉동만두</span>
        </button>

        <span style={{ fontSize: 10, color: "hsl(30 25% 52%)", opacity: selected || mwState !== "idle" ? 1 : 0.3, transition: "opacity 0.2s" }}>→</span>

        {/* 전자레인지 본체 */}
        <div
          onDragOver={(e) => { if (mwState === "idle" && !locked) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            if (e.dataTransfer.getData("text/plain") === "mandu") startHeating();
          }}
          onClick={handleMicrowaveClick}
          title={mwState === "done" ? "꺼내기!" : mwState === "heating" ? "가열 중..." : "만두를 드래그해서 넣어주세요"}
          style={{
            background: dragOver ? "rgba(180,240,180,0.28)"
              : mwState === "heating" ? "rgba(70,40,180,0.11)"
              : mwState === "done"    ? "rgba(70,190,70,0.18)"
              : "rgba(40,40,60,0.09)",
            border: `2px solid ${
              dragOver         ? "#66aa66"
              : mwState === "heating" ? "#8855ee"
              : mwState === "done"    ? "#44bb44"
              : selected              ? "#ddaa22"
              : "hsl(30 20% 50%)"
            }`,
            padding: "5px 8px",
            minWidth: 96,
            cursor: mwState === "done" || selected ? "pointer" : dragOver ? "copy" : "default",
            transition: "all 0.2s",
            display: "flex", flexDirection: "column", gap: 3, alignItems: "center",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 16 }}>
              {mwState === "done" ? "✨" : mwState === "heating" ? "🔄" : "📦"}
            </span>
            <span style={{
              fontFamily: "'DotGothic16',monospace", fontSize: 8,
              color: mwState === "done" ? "#44bb44" : mwState === "heating" ? "#9966ff" : dragOver ? "#55aa55" : "hsl(30 25% 42%)",
            }}>
              {mwState === "done"    ? "완성! 꺼내기"
               : mwState === "heating" ? "가열 중..."
               : dragOver            ? "놓으세요!"
               : selected            ? "투입하기"
               : "드래그 / 탭"}
            </span>
          </div>
          {mwState === "heating" && (
            <div style={{ width: "100%", height: 5, background: "rgba(0,0,0,0.14)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${heatPct}%`,
                background: "linear-gradient(90deg,#7744cc,#bb88ff)",
                borderRadius: 3,
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DessertShelf — 쿠키/도넛/초코 선반
   rate limit: 2회 / 20초 → 25초 쿨다운
   ═══════════════════════════════════════════════════════════════ */
const DESSERTS = [
  { id: "cookie", emoji: "🍪", label: "쿠키",  message: "쿠키 하나 집어감 🍪" },
  { id: "donut",  emoji: "🍩", label: "도넛",  message: "도넛 먹고 버틴다 🍩" },
  { id: "royce",  emoji: "🍫", label: "로이스", message: "로이스 초콜릿 하나 챙김 🍫" },
];
const DESSERT_LIMIT = 2;
const DESSERT_WINDOW_MS = 20_000;
const DESSERT_COOLDOWN_MS = 25_000;
const COOL_MSGS = ["아 혈당..", "아 식곤증...", "잠깐 참아봐요 🤚", "아직 소화 중..."];

function DessertShelf({ compact }: { compact: boolean }) {
  const { sendMessage, myCup } = useBreakRoom();
  const locked = !myCup;

  const [popEmoji, setPopEmoji]       = useState<string | null>(null);
  const [grabCount, setGrabCount]     = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [coolMsg, setCoolMsg]         = useState("");

  const grab = useCallback((item: typeof DESSERTS[0]) => {
    const now = Date.now();
    if (locked || now < cooldownEnd) return;

    const inWindow = now - windowStart < DESSERT_WINDOW_MS;
    const newCount = inWindow ? grabCount + 1 : 1;

    if (!inWindow) { setWindowStart(now); }
    setGrabCount(newCount);

    sendMessage(item.message);
    setPopEmoji(item.emoji);
    setTimeout(() => setPopEmoji(null), 1400);

    if (newCount >= DESSERT_LIMIT) {
      const msg = COOL_MSGS[Math.floor(Math.random() * COOL_MSGS.length)];
      setCoolMsg(msg);
      const end = now + DESSERT_COOLDOWN_MS;
      setCooldownEnd(end);
      setTimeout(() => { setCoolMsg(""); setCooldownEnd(0); setGrabCount(0); setWindowStart(0); }, DESSERT_COOLDOWN_MS);
    }
  }, [locked, cooldownEnd, windowStart, grabCount, sendMessage]);

  const isCooling = Date.now() < cooldownEnd;
  const isLocked  = locked || isCooling;

  if (compact) {
    /* 모바일: 이모지만, 3개 가로 배치 */
    return (
      <div>
        <div style={{ fontFamily: "'DotGothic16', monospace", fontSize: 11, color: "hsl(30 25% 50%)", textAlign: "center", marginBottom: 4 }}>
          ── 디저트 ──
        </div>
        {isCooling && (
          <div style={{ fontFamily: "'DotGothic16', monospace", fontSize: 10, color: "#e07040", textAlign: "center", marginBottom: 3 }}>
            {coolMsg}
          </div>
        )}
        <div style={{ display: "flex", gap: 3, justifyContent: "center", position: "relative" }}>
          {popEmoji && (
            <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 16, animation: "snackPop 1.4s ease-out forwards", pointerEvents: "none", zIndex: 5 }}>
              {popEmoji}
            </div>
          )}
          {DESSERTS.map((d) => (
            <button key={d.id} onClick={() => grab(d)} disabled={isLocked}
              title={locked ? "커피 먼저" : isCooling ? coolMsg : d.message}
              style={{
                background: isLocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.28)",
                border: `2px solid ${isLocked ? "hsl(30 20% 60%)" : "hsl(30 38% 46%)"}`,
                padding: "6px 4px",
                cursor: isLocked ? "not-allowed" : "pointer",
                opacity: isLocked ? 0.45 : 1,
                fontSize: 18, lineHeight: 1,
                touchAction: "manipulation",
                flex: 1,
              }}>
              <span style={{ filter: isLocked ? "grayscale(1)" : "none" }}>{d.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* 데스크탑 */
  return (
    <div style={{ position: "relative" }}>
      {popEmoji && (
        <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", fontSize: 20, animation: "snackPop 1.4s ease-out forwards", zIndex: 10, pointerEvents: "none" }}>
          {popEmoji}
        </div>
      )}
      <div style={{ textAlign: "center", fontFamily: "'DotGothic16', monospace", fontSize: 8, color: "hsl(30 25% 44%)", marginBottom: 4 }}>── 디저트 선반 ──</div>
      {isCooling && (
        <div style={{ fontFamily: "'DotGothic16', monospace", fontSize: 8, color: "#e07040", textAlign: "center", marginBottom: 4 }}>
          {coolMsg}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {DESSERTS.map((d) => (
          <button key={d.id} onClick={() => grab(d)} disabled={isLocked}
            title={locked ? "커피를 먼저 내려주세요" : isCooling ? coolMsg : d.message}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: isLocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)",
              border: `2px solid ${isLocked ? "hsl(30 20% 60%)" : "hsl(30 38% 46%)"}`,
              padding: "5px 6px", cursor: isLocked ? "not-allowed" : "pointer",
              opacity: isLocked ? 0.45 : 1,
            }}>
            <span style={{ fontSize: 18, lineHeight: 1, filter: isLocked ? "grayscale(1)" : "none" }}>{d.emoji}</span>
            <span style={{ fontFamily: "'DotGothic16', monospace", fontSize: 7, color: "hsl(30 25% 32%)" }}>{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VendingMachine — 자판기
   idle → ready(8s) → 선택 → dispensing(1.8s) → idle
   ═══════════════════════════════════════════════════════════════ */
const VEND_ITEMS = [
  { id: "drink",  emoji: "🥤", label: "음료",     message: "자판기 음료 뽑음 🥤" },
  { id: "candy",  emoji: "🍬", label: "사탕",     message: "사탕 쏙 집어감 🍬" },
  { id: "juice",  emoji: "🍹", label: "생과일주스", message: "생과일주스 꺼내감 🍹" },
];
type VendState = "idle" | "ready" | "dispensing";

function VendingMachine({ compact }: { compact: boolean }) {
  const { sendMessage, myCup } = useBreakRoom();
  const locked = !myCup;
  const [state, setState] = useState<VendState>("idle");
  const [dropping, setDropping] = useState<string | null>(null);

  const insertCoin = () => {
    if (locked || state !== "idle") return;
    setState("ready");
    setTimeout(() => setState((s) => s === "ready" ? "idle" : s), 8000);
  };

  const vend = (item: typeof VEND_ITEMS[0]) => {
    if (state !== "ready" || locked) return;
    setState("dispensing");
    setDropping(item.emoji);
    sendMessage(item.message);
    setTimeout(() => { setState("idle"); setDropping(null); }, 1800);
  };

  const isReady      = state === "ready";
  const isDispensing = state === "dispensing";

  if (compact) {
    /* 모바일: 이모지만, 3개 가로 배치 + 동전 버튼 */
    return (
      <div>
        <div style={{ fontFamily: "'DotGothic16', monospace", fontSize: 11, color: "#6699aa", textAlign: "center", marginBottom: 4 }}>── 자판기 ──</div>
        {/* 아이템 */}
        <div style={{ background: "#0e1e2e", border: "2px solid #3a4a5a", padding: "5px 3px", display: "flex", gap: 3, justifyContent: "center", marginBottom: 5, position: "relative", minHeight: 42 }}>
          {VEND_ITEMS.map((item) => (
            <button key={item.id} onClick={() => vend(item)} disabled={!isReady}
              style={{
                flex: 1, background: isReady ? "rgba(100,200,160,0.14)" : "transparent",
                border: `2px solid ${isReady ? "#44aa80" : "#2a3a4a"}`,
                padding: "5px 2px", cursor: isReady ? "pointer" : "default",
                opacity: isDispensing ? 0.4 : isReady ? 1 : 0.3,
                fontSize: 18, lineHeight: 1,
                touchAction: "manipulation",
              }}>
              <span>{item.emoji}</span>
            </button>
          ))}
          {dropping && (
            <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontSize: 18, animation: "vendDrop 1.6s ease-in forwards", zIndex: 5, pointerEvents: "none" }}>
              {dropping}
            </div>
          )}
        </div>
        {/* 동전 버튼 */}
        <button onClick={insertCoin} disabled={locked || state !== "idle"}
          style={{
            display: "block", width: "100%",
            fontFamily: "'DotGothic16', monospace", fontSize: 11,
            background: locked ? "#1a2838" : isReady ? "#1a4a38" : "#1e3850",
            color: locked ? "#3a4a5a" : isReady ? "#44dd88" : "#66aacc",
            border: `2px solid ${isReady ? "#2a6a48" : "#2a4a6a"}`,
            padding: "7px 2px", cursor: locked || state !== "idle" ? "not-allowed" : "pointer",
            touchAction: "manipulation",
            minHeight: 34,
          }}>
          {locked ? "☕먼저" : isReady ? "✓투입" : "🪙동전"}
        </button>
      </div>
    );
  }

  /* 데스크탑 */
  return (
    <div style={{ background: "#0e1e2e", border: "3px solid #3a4a5a", padding: "6px", position: "relative" }}>
      <div style={{ textAlign: "center", fontFamily: "'DotGothic16', monospace", fontSize: 7, color: "#6699aa", marginBottom: 4 }}>── 자판기 ──</div>
      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 6, position: "relative", minHeight: 54 }}>
        {VEND_ITEMS.map((item) => (
          <button key={item.id} onClick={() => vend(item)} disabled={!isReady}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: isReady ? "rgba(100,200,160,0.14)" : "transparent",
              border: `1.5px solid ${isReady ? "#44aa80" : "#2a3a4a"}`,
              padding: "4px 5px", cursor: isReady ? "pointer" : "default",
              opacity: isDispensing ? 0.4 : isReady ? 1 : 0.3,
            }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontFamily: "'DotGothic16', monospace", fontSize: 7, color: isReady ? "#88ddbb" : "#445566" }}>{item.label}</span>
          </button>
        ))}
        {dropping && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", fontSize: 20, animation: "vendDrop 1.6s ease-in forwards", zIndex: 5, pointerEvents: "none" }}>
            {dropping}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", fontFamily: "'DotGothic16', monospace", fontSize: 7, color: isReady ? "#88ffcc" : "#445566", marginBottom: 4 }}>
        {isDispensing ? "배출 중..." : isReady ? "✦ 선택하세요 ✦" : "동전을 넣어주세요"}
      </div>
      <button onClick={insertCoin} disabled={locked || state !== "idle"}
        style={{
          display: "block", width: "100%",
          fontFamily: "'DotGothic16', monospace", fontSize: 8,
          background: locked ? "#1a2838" : isReady ? "#1a4a38" : "#1e3850",
          color: locked ? "#3a4a5a" : isReady ? "#44dd88" : "#66aacc",
          border: `2px solid ${isReady ? "#2a6a48" : "#2a4a6a"}`,
          padding: "5px 0", cursor: locked || state !== "idle" ? "not-allowed" : "pointer",
        }}>
        {locked ? "☕ 커피 먼저" : isReady ? "✓ 동전 투입됨" : "🪙 동전 넣기"}
      </button>
    </div>
  );
}
