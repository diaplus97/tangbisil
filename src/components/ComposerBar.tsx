import { useState } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";
import ApplePeelGame from "./ApplePeelGame";

/** 칼로 깎을 수 있는 것 */
const PEELABLE = new Set(["apple"]);

function SmallBtn({ children, onClick, tone, disabled, title }: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "eat" | "give" | "cancel" | "peel";
  disabled?: boolean;
  title?: string;
}) {
  const bg = disabled ? "hsl(38 15% 80%)"
    : tone === "eat" ? "hsl(28 60% 62%)"
    : tone === "give" ? "hsl(150 40% 46%)"
    : tone === "peel" ? "hsl(205 45% 52%)"
    : "hsl(30 12% 70%)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "4px 9px",
        background: bg,
        color: disabled ? "hsl(30 10% 55%)" : "hsl(38 60% 96%)",
        border: "2px solid hsl(30 25% 26%)",
        boxShadow: disabled ? "none" : "1px 1px 0 rgba(0,0,0,0.28)",
        fontFamily: "'DotGothic16', monospace", fontSize: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** 메시지 입력 + 최근 메시지 3개 */
export default function ComposerBar() {
  const { sendMessage, myCup, recentMessages, heldItem, eatHeld, cups, giftMode, setGiftMode } = useBreakRoom();
  const [text, setText] = useState("");
  const [peeling, setPeeling] = useState(false);

  const send = (msg?: string) => {
    const t = (msg ?? text).trim();
    if (!t) return;
    sendMessage(t);
    sound.play("blip");
    setText("");
  };

  const locked = !myCup;

  return (
    <div style={{
      borderTop: "3px solid hsl(30 25% 20%)",
      background: "hsl(38 42% 91%)",
      flexShrink: 0,
      maxWidth: 1100,
      width: "100%",
      alignSelf: "center",
      boxShadow: "0 0 0 3px hsl(30 25% 20%)",
    }}>
      {/* 최근 메시지 (subtle strip) */}
      {recentMessages.length > 0 && (
        <div style={{
          display: "flex", gap: 6, alignItems: "center",
          padding: "3px 10px",
          borderBottom: "1px solid hsl(30 25% 75%)",
          background: "hsl(38 35% 88%)",
          overflowX: "auto",
        }}>
          <span style={{ fontFamily: "'DotGothic16', monospace", fontSize: 8, color: "hsl(30 20% 55%)", whiteSpace: "nowrap" }}>최근:</span>
          {recentMessages.slice(0, 3).map((msg) => (
            <span key={msg.id} style={{ fontFamily: "'DotGothic16', monospace", fontSize: 9, whiteSpace: "nowrap" }}>
              <span style={{ color: msg.color }}>{msg.nickname.replace("Anonymous","A")}</span>
              <span style={{ color: "hsl(30 20% 55%)" }}> › </span>
              <span style={{ color: "hsl(30 25% 22%)" }}>{msg.text}</span>
            </span>
          ))}
        </div>
      )}

      {/* 손에 든 물건 — 먹거나 / 옆 사람 주거나 / 흡연실로 가져가거나 */}
      {heldItem && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 10px",
          background: giftMode ? "hsl(140 40% 82%)" : "hsl(38 50% 86%)",
          borderBottom: "2px solid hsl(30 25% 62%)",
          fontFamily: "'DotGothic16', monospace",
          transition: "background 0.2s",
        }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>{heldItem.emoji}</span>
          <span style={{ fontSize: 10, color: "hsl(30 28% 28%)", whiteSpace: "nowrap" }}>
            {giftMode ? "누구한테 줄까요? 컵을 탭하세요" : `${heldItem.label} 들고 있음`}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
            {giftMode ? (
              <SmallBtn onClick={() => setGiftMode(false)} tone="cancel">취소</SmallBtn>
            ) : (
              <>
                <SmallBtn onClick={eatHeld} tone="eat">먹기</SmallBtn>
                {PEELABLE.has(heldItem.id) && (
                  <SmallBtn onClick={() => setPeeling(true)} tone="peel" title="껍질 안 끊고 얼마나 길게?">
                    깎기 🔪
                  </SmallBtn>
                )}
                <SmallBtn
                  onClick={() => setGiftMode(true)}
                  tone="give"
                  disabled={cups.filter((c) => !c.isMe).length === 0}
                  title={cups.filter((c) => !c.isMe).length === 0 ? "지금은 아무도 없어요" : undefined}
                >
                  건네주기
                </SmallBtn>
              </>
            )}
          </div>
        </div>
      )}

      {/* 텍스트 입력 */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 30))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          disabled={locked}
          placeholder={locked ? "먼저 커피를 내려주세요 ☕" : "한 줄 메시지... (최대 30자)"}
          style={{
            flex: 1, padding: "8px 12px",
            background: locked ? "hsl(38 28% 90%)" : "hsl(38 60% 97%)",
            border: "none", outline: "none",
            fontFamily: "'DotGothic16', monospace", fontSize: 13,
            color: "hsl(30 25% 20%)",
          }}
        />
        <button
          onClick={() => send()}
          disabled={locked || !text.trim()}
          style={{
            padding: "8px 16px",
            background: locked || !text.trim() ? "hsl(25 38% 58%)" : "hsl(25 80% 52%)",
            color: "white", border: "none",
            borderLeft: "3px solid hsl(30 25% 20%)",
            fontFamily: "'DotGothic16', monospace", fontSize: 12,
            cursor: locked || !text.trim() ? "not-allowed" : "pointer",
            touchAction: "manipulation",
          }}
        >
          보내기
        </button>
      </div>

      {/* 사과 깎기 — 결과물이 다시 손에 들린다 */}
      {peeling && <ApplePeelGame onClose={() => setPeeling(false)} />}
    </div>
  );
}
