/**
 * NpcDialogue — 흡연실 NPC 대화 패널
 *
 * 기억은 이 브라우저에만 있다. 그 사실을 UI 에 명시한다 —
 * 사람들이 여기에 진짜 회사 얘기를 쓸 거라서, 어디에 남는지 알 권리가 있다.
 */
import { useState, useRef, useEffect } from "react";
import { useSmokingRoom, NPC_NAME } from "@/context/SmokingRoomContext";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { CRISIS_RESOURCES } from "@/lib/npcPrompt";

const INK = "hsl(150 10% 8%)";
const PANEL = "hsl(155 9% 17%)";
const PANEL_DARK = "hsl(155 10% 12%)";

/**
 * "다 잊어줘" 판정 — 부분 문자열로 매칭하면 안 된다.
 * "그걸 잊어버렸어요" 같은 평범한 문장이 기억 삭제를 트리거하면 되돌릴 수 없다.
 * 공백·문장부호를 지운 뒤 정확히 일치할 때만 삭제 흐름으로 보낸다.
 */
const FORGET_EXACT = new Set([
  "잊어", "잊어줘", "잊어라", "다잊어", "다잊어줘", "전부잊어", "전부잊어줘",
  "우리얘기다잊어", "우리얘기다잊어줘", "내얘기다잊어줘",
  "기억지워", "기억지워줘", "기억다지워", "기억다지워줘", "기억삭제", "기억삭제해줘",
]);
const CONFIRM_EXACT = new Set(["응", "어", "네", "예", "ㅇㅇ", "ㅇ", "그래", "확실해", "지워", "지워줘"]);

const normalize = (s: string) => s.replace(/[\s.,!?~…·"'()]/g, "");

/** heightPct — 흡연실 바닥선과 맞춘 패널 높이(%) */
export default function NpcDialogue({ heightPct }: { heightPct: number }) {
  const {
    messages, streaming, send, knowsName, metCount, turnsLeft, saving,
    requestForget, confirmForget, cancelForget, pendingForget,
  } = useSmokingRoom();
  // 탕비실에서 들고 온 물건 — Provider 가 두 방을 다 감싸고 있다
  const { heldItem, clearHeld } = useBreakRoom();
  const [draft, setDraft] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 오면 아래로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const outOfTurns = turnsLeft <= 0;

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming || outOfTurns) return;
    const norm = normalize(text);

    // 확인을 기다리는 중이면 여기서 갈린다
    if (pendingForget) {
      setDraft("");
      if (CONFIRM_EXACT.has(norm)) confirmForget();
      else { cancelForget(); send(text); }
      return;
    }

    // "다 잊어줘" 는 진짜 삭제로 연결된다 — 한 번 더 묻는다
    if (FORGET_EXACT.has(norm)) {
      setDraft("");
      requestForget();
      return;
    }

    send(text);
    setDraft("");
  };

  return (
    <div
      className="panel-up"
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        // 바닥선과 높이를 맞춘다 — 아저씨가 패널 위에 서 있는 것처럼 보이게
        height: `${heightPct}%`,
        display: "flex", flexDirection: "column",
        background: PANEL_DARK,
        borderTop: `4px solid ${INK}`,
        boxShadow: "0 -8px 24px rgba(0,0,0,0.5)",
        zIndex: 10,
        fontFamily: "'DotGothic16', monospace",
      }}
    >
      {/* ── 헤더 ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px",
        background: PANEL,
        borderBottom: `3px solid ${INK}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: "hsl(35 30% 78%)" }}>
          {knowsName ? NPC_NAME : "아저씨"}
        </span>
        <span style={{ fontSize: 8, color: "hsl(150 7% 45%)" }}>
          {metCount > 0 ? `${metCount + 1}번째 만남` : "처음 보는 사이"}
        </span>
        <button
          onClick={() => setShowInfo((v) => !v)}
          style={{
            marginLeft: "auto",
            background: "none", border: "none",
            color: "hsl(150 8% 50%)", fontSize: 9,
            cursor: "pointer", padding: 4,
            fontFamily: "'DotGothic16', monospace",
          }}
        >
          {saving ? "기억하는 중…" : "ⓘ 기억"}
        </button>
      </div>

      {/* ── 기억 안내 ── */}
      {showInfo && (
        <div style={{
          padding: "8px 10px",
          background: "hsl(155 12% 14%)",
          borderBottom: `2px solid ${INK}`,
          fontSize: 8, lineHeight: 1.7,
          color: "hsl(150 8% 58%)",
          flexShrink: 0,
        }}>
          이 대화는 <b style={{ color: "hsl(150 10% 74%)" }}>이 브라우저에만</b> 저장됩니다.
          서버에 남지 않고, 탕비실의 다른 사람에게도 보이지 않습니다.<br />
          아저씨에게 <b style={{ color: "hsl(150 10% 74%)" }}>"다 잊어줘"</b>라고 하면 실제로 지워집니다.
          <div style={{ marginTop: 6, color: "hsl(150 7% 44%)" }}>
            오늘 남은 대화 {turnsLeft}턴
          </div>
        </div>
      )}

      {/* ── 메시지 ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          padding: "10px 10px 4px",
          display: "flex", flexDirection: "column", gap: 9,
        }}
      >
        {messages.map((m) => (
          <div key={m.id}>
            <Bubble role={m.role} content={m.content} pending={m.pending} />
            {m.crisis && m.role === "assistant" && !m.pending && <CrisisCard />}
          </div>
        ))}
      </div>

      {/* ── 들고 온 물건 건네기 ── */}
      {heldItem && !outOfTurns && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px",
          background: "hsl(155 12% 15%)",
          borderTop: `2px solid ${INK}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{heldItem.emoji}</span>
          <span style={{ fontSize: 9, color: "hsl(150 8% 58%)" }}>
            {heldItem.label} 들고 있음
          </span>
          <button
            onClick={() => {
              if (streaming) return;
              clearHeld();
              send(`(${heldItem.label} 하나 건넸다)`);
            }}
            disabled={streaming}
            style={{
              marginLeft: "auto",
              padding: "5px 10px",
              background: streaming ? "hsl(155 6% 22%)" : "hsl(150 30% 28%)",
              color: streaming ? "hsl(150 6% 45%)" : "hsl(140 40% 84%)",
              border: `2px solid ${INK}`,
              fontFamily: "'DotGothic16', monospace", fontSize: 9,
              cursor: streaming ? "default" : "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            건네주기
          </button>
        </div>
      )}

      {/* ── 입력 ── */}
      <div style={{
        display: "flex", gap: 6, padding: 8,
        background: PANEL,
        borderTop: `3px solid ${INK}`,
        flexShrink: 0,
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(); }}
          placeholder={outOfTurns ? "오늘은 그만 하자." : streaming ? "…" : "무슨 일인데?"}
          disabled={outOfTurns}
          maxLength={500}
          style={{
            flex: 1, minWidth: 0,
            padding: "8px 9px",
            background: "hsl(150 8% 10%)",
            color: "hsl(150 10% 82%)",
            border: `3px solid ${INK}`,
            fontFamily: "'DotGothic16', monospace",
            fontSize: 11,
            outline: "none",
          }}
        />
        <button
          onClick={submit}
          disabled={streaming || outOfTurns || !draft.trim()}
          style={{
            padding: "8px 12px",
            background: streaming || outOfTurns || !draft.trim() ? "hsl(155 6% 22%)" : "hsl(18 55% 34%)",
            color: streaming || outOfTurns || !draft.trim() ? "hsl(150 6% 45%)" : "hsl(35 70% 84%)",
            border: `3px solid ${INK}`,
            fontFamily: "'DotGothic16', monospace",
            fontSize: 10,
            cursor: streaming || outOfTurns || !draft.trim() ? "default" : "pointer",
            flexShrink: 0,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          말하기
        </button>
      </div>
    </div>
  );
}

/* ── 말풍선 ── */
function Bubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  const mine = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%",
        padding: "7px 10px",
        background: mine ? "hsl(200 22% 26%)" : "hsl(155 9% 24%)",
        color: mine ? "hsl(200 20% 86%)" : "hsl(40 14% 84%)",
        border: `3px solid ${INK}`,
        fontSize: 11, lineHeight: 1.75,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {content}
        {pending && (
          <span style={{
            display: "inline-block", width: 7, height: 13,
            background: "hsl(40 14% 74%)", marginLeft: 2,
            verticalAlign: "text-bottom",
            animation: "caret 1s step-end infinite",
          }} />
        )}
      </div>
    </div>
  );
}

/* ── 위기 상담 자원 — 캐릭터 대사와 별개로 항상 누를 수 있게 ── */
function CrisisCard() {
  return (
    <div style={{
      marginTop: 7,
      padding: "9px 10px",
      background: "hsl(355 30% 20%)",
      border: `3px solid ${INK}`,
      fontSize: 9, lineHeight: 1.8,
      color: "hsl(355 20% 84%)",
    }}>
      <div style={{ marginBottom: 5, color: "hsl(355 30% 90%)" }}>
        혼자 감당하지 않아도 됩니다. 24시간 무료입니다.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CRISIS_RESOURCES.map((r) => (
          <a
            key={r.tel}
            href={`tel:${r.tel.replace(/-/g, "")}`}
            style={{
              padding: "5px 9px",
              background: "hsl(355 40% 32%)",
              color: "hsl(355 30% 94%)",
              border: `2px solid ${INK}`,
              textDecoration: "none",
              fontSize: 10,
            }}
          >
            {r.label} {r.tel}
          </a>
        ))}
      </div>
    </div>
  );
}
