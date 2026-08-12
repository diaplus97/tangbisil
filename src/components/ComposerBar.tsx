import { useState } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const QUICK_PHRASES = [
  "커피 한잔 하고 갑니다 ☕",
  "점심 뭐 먹지 🍱",
  "오늘도 버틴다 💪",
  "잠깐 숨 좀 돌리자 🌿",
  "퇴근은 언제지 🏃",
  "쿠키 하나 집어감 🍪",
  "화분에 물 줌 💧",
];

/** 메시지 입력 + 빠른 문구 + 최근 메시지 3개 */
export default function ComposerBar() {
  const { sendMessage, myCup, recentMessages } = useBreakRoom();
  const [text, setText] = useState("");

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

      {/* 빠른 문구 */}
      <div style={{ display: "flex", gap: 5, padding: "6px 10px 5px", flexWrap: "wrap", borderBottom: "2px solid hsl(30 25% 75%)" }}>
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            onClick={() => send(phrase)}
            disabled={locked}
            title={locked ? "먼저 커피를 내려주세요" : undefined}
            style={{
              padding: "4px 9px",
              background: locked ? "hsl(38 20% 86%)" : "hsl(38 52% 87%)",
              color: locked ? "hsl(30 15% 55%)" : "hsl(30 25% 22%)",
              border: "2px solid hsl(30 25% 52%)",
              boxShadow: locked ? "none" : "1px 1px 0 rgba(0,0,0,0.22)",
              fontFamily: "'DotGothic16', monospace",
              fontSize: 12,
              cursor: locked ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              touchAction: "manipulation",
            }}
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* 텍스트 입력 */}
      <div style={{ display: "flex" }}>
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
    </div>
  );
}
