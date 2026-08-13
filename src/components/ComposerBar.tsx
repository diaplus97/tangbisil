import { useState } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";
import { createPortal } from "react-dom";
import ApplePeelGame from "./ApplePeelGame";
import OrangeNinjaGame from "./OrangeNinjaGame";

/** 칼로 깎을 수 있는 것 */
const PEELABLE = new Set(["apple"]);
/** 도마에 올릴 수 있는 것 */
const SLICEABLE = new Set(["orange"]);

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
        padding: "8px 13px",
        background: bg,
        color: disabled ? "hsl(30 10% 55%)" : "hsl(38 60% 96%)",
        border: "3px solid hsl(30 25% 22%)",
        boxShadow: disabled ? "none" : "2px 2px 0 rgba(0,0,0,0.35)",
        fontFamily: "'DotGothic16', monospace", fontSize: 13,
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
  const [slicing, setSlicing] = useState(false);

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
        <div
          key={heldItem.id}
          className="held-bar"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px",
            background: giftMode ? "hsl(140 40% 82%)" : "hsl(45 85% 82%)",
            borderTop: "3px solid hsl(38 65% 55%)",
            borderBottom: "3px solid hsl(30 25% 55%)",
            fontFamily: "'DotGothic16', monospace",
            transition: "background 0.2s",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>{heldItem.emoji}</span>
          <span style={{ fontSize: 12, color: "hsl(30 30% 24%)", whiteSpace: "nowrap", fontWeight: "bold" }}>
            {giftMode ? "누구한테 줄까요? 컵을 탭!" : heldItem.label}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
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
                {SLICEABLE.has(heldItem.id) && (
                  <SmallBtn onClick={() => setSlicing(true)} tone="peel" title="던져지는 과일을 그어서 자르기">
                    썰기 🔪
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

      {/* 미니게임 — 결과물이 다시 손에 들린다.
          portal 로 body 에 붙인다: 이 바는 transform 밖이라 지금은 없어도 되지만,
          위치가 바뀌어도 안 깨지게 (방 안은 scale 이 걸려 fixed 가 갇힌다) */}
      {peeling && createPortal(<ApplePeelGame onClose={() => setPeeling(false)} />, document.body)}
      {slicing && createPortal(<OrangeNinjaGame onClose={() => setSlicing(false)} />, document.body)}
    </div>
  );
}
