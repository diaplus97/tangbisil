import { useState } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";

// ─── 디저트 선반 ──────────────────────────────────────────────

const DESSERTS = [
  { id: "cookie", emoji: "🍪", label: "쿠키",  message: "쿠키 하나 집어감 🍪" },
  { id: "donut",  emoji: "🍩", label: "도넛",  message: "도넛 먹고 버틴다 🍩" },
  { id: "choco",  emoji: "🍫", label: "초코",  message: "초코 당충전 완료 🍫" },
];

function DessertShelf({ locked }: { locked: boolean }) {
  const { sendMessage } = useBreakRoom();
  const [popEmoji, setPopEmoji] = useState<string | null>(null);

  const grab = (item: typeof DESSERTS[0]) => {
    if (locked) return;
    setPopEmoji(item.emoji);
    sendMessage(item.message);
    setTimeout(() => setPopEmoji(null), 1400);
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* 팝 효과 */}
      {popEmoji && (
        <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", fontSize: 22, animation: "snackPop 1.4s ease-out forwards", zIndex: 10, pointerEvents: "none" }}>
          {popEmoji}
        </div>
      )}

      {/* 선반 제목 */}
      <div style={{
        fontFamily: "'DotGothic16', monospace", fontSize: 8,
        color: "hsl(30 35% 36%)",
        background: "hsl(38 42% 82%)",
        border: "2px solid hsl(30 30% 52%)",
        textAlign: "center",
        padding: "1px 6px",
        marginBottom: 3,
      }}>
        🍰 디저트 선반
      </div>

      {/* 아이템 영역 */}
      <div style={{
        background: "hsl(38 55% 93%)",
        border: "3px solid hsl(30 28% 46%)",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.25)",
        padding: "6px 6px 8px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-around", gap: 4 }}>
          {DESSERTS.map((d) => (
            <button
              key={d.id}
              onClick={() => grab(d)}
              disabled={locked}
              title={locked ? "커피를 먼저 내려주세요" : d.message}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                background: "none", border: "none",
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.45 : 1,
                padding: "3px",
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) => { if (!locked) (e.currentTarget.style.transform = "scale(1.18)"); }}
              onMouseLeave={(e) => { (e.currentTarget.style.transform = "scale(1)"); }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, filter: locked ? "grayscale(1)" : "none" }}>{d.emoji}</span>
              <span style={{ fontFamily: "'DotGothic16', monospace", fontSize: 7, color: "hsl(30 25% 38%)" }}>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* 선반 판자 */}
      <div style={{ height: 7, background: "hsl(28 45% 38%)", borderTop: "3px solid hsl(28 35% 22%)", boxShadow: "0 2px 0 rgba(0,0,0,0.25)" }} />
    </div>
  );
}

// ─── 자판기 ───────────────────────────────────────────────────

const VEND_ITEMS = [
  { id: "drink",  emoji: "🥤", label: "음료",   message: "자판기 음료 뽑음 🥤" },
  { id: "candy",  emoji: "🍬", label: "사탕",   message: "사탕 쏙 집어감 🍬" },
  { id: "canned", emoji: "🧃", label: "캔음료", message: "캔 음료 꺼내감 🧃" },
];

type VendState = "idle" | "ready" | "dispensing";

function VendingMachine({ locked }: { locked: boolean }) {
  const { sendMessage } = useBreakRoom();
  const [state, setState] = useState<VendState>("idle");
  const [dropping, setDropping] = useState<string | null>(null);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const insertCoin = () => {
    if (locked || state !== "idle") return;
    setState("ready");
    const t = setTimeout(() => setState("idle"), 8000);
    setAutoTimer(t);
  };

  const vend = (item: typeof VEND_ITEMS[0]) => {
    if (state !== "ready" || locked) return;
    if (autoTimer) { clearTimeout(autoTimer); setAutoTimer(null); }
    setState("dispensing");
    setDropping(item.emoji);
    sendMessage(item.message);
    setTimeout(() => {
      setState("idle");
      setDropping(null);
    }, 1800);
  };

  const isReady = state === "ready";
  const isDispensing = state === "dispensing";

  return (
    <div style={{
      background: "#2a3540",
      border: "4px solid #1a2530",
      boxShadow: "4px 4px 0 rgba(0,0,0,0.5)",
      padding: "8px 6px 6px",
      display: "flex",
      flexDirection: "column",
      gap: 5,
      width: "100%",
    }}>
      {/* 자판기 제목 */}
      <div style={{
        fontFamily: "'DotGothic16', monospace", fontSize: 8,
        color: isReady ? "#88ffcc" : "#6699aa",
        textAlign: "center",
        letterSpacing: "0.04em",
      }}>
        {isDispensing ? "배출 중..." : isReady ? "✦ 선택하세요 ✦" : "🏧 자판기"}
      </div>

      {/* 디스플레이 창 + 아이템들 */}
      <div style={{
        background: "#0e1e2e",
        border: "2px solid #3a4a5a",
        padding: "5px 4px",
        display: "flex",
        justifyContent: "space-around",
        gap: 3,
        position: "relative",
        overflow: "hidden",
      }}>
        {VEND_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => vend(item)}
            disabled={!isReady}
            title={!isReady ? "동전을 먼저 넣어주세요" : item.message}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: isReady ? "rgba(100,200,160,0.12)" : "transparent",
              border: isReady ? "1px solid #44aa80" : "1px solid #2a3a4a",
              borderRadius: 2,
              padding: "4px 3px",
              cursor: isReady ? "pointer" : "default",
              opacity: isDispensing ? 0.4 : isReady ? 1 : 0.35,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (isReady) (e.currentTarget.style.background = "rgba(100,200,160,0.25)"); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = isReady ? "rgba(100,200,160,0.12)" : "transparent"); }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontFamily: "'DotGothic16', monospace", fontSize: 7, color: isReady ? "#88ddbb" : "#445566" }}>
              {item.label}
            </span>
          </button>
        ))}

        {/* 배출 애니메이션 */}
        {dropping && (
          <div style={{
            position: "absolute", top: 4, left: "50%",
            transform: "translateX(-50%)",
            fontSize: 20,
            animation: "vendDrop 1.6s ease-in forwards",
            zIndex: 5, pointerEvents: "none",
          }}>
            {dropping}
          </div>
        )}
      </div>

      {/* 배출구 */}
      <div style={{
        background: "#0e1828",
        border: "2px solid #3a4a5a",
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ width: 40, height: 8, background: "#1a2838", border: "1px solid #2a3848", borderRadius: 2 }} />
      </div>

      {/* 동전 넣기 버튼 */}
      <button
        onClick={insertCoin}
        disabled={locked || state !== "idle"}
        style={{
          fontFamily: "'DotGothic16', monospace", fontSize: 8,
          background: locked ? "#1a2838" : isReady ? "#1a4a38" : "#1e3850",
          color: locked ? "#3a4a5a" : isReady ? "#44dd88" : "#66aacc",
          border: `2px solid ${isReady ? "#2a6a48" : "#2a4a6a"}`,
          padding: "4px 6px",
          cursor: locked || state !== "idle" ? "not-allowed" : "pointer",
          textAlign: "center",
          letterSpacing: "0.03em",
        }}
      >
        {locked ? "커피 먼저 ☕" : isReady ? "동전 투입됨 ✓" : "동전 넣기 🪙"}
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────

/** 오른쪽: 디저트 선반 + 자판기 (분리된 두 구역) */
export default function SnackCorner() {
  const { myCup } = useBreakRoom();
  const locked = !myCup;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <DessertShelf locked={locked} />
      <VendingMachine locked={locked} />
    </div>
  );
}
