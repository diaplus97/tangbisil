import { useBreakRoom, type LiveStatus } from "@/context/BreakRoomContext";
import { useClock } from "@/hooks/useClock";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSound } from "@/hooks/useSound";

const STATUS_LABEL: Record<LiveStatus, { dot: string; text: string }> = {
  demo:       { dot: "#8899aa", text: "오프라인" },
  connecting: { dot: "#f5a623", text: "연결 중" },
  connected:  { dot: "#5aff7a", text: "라이브" },
  error:      { dot: "#ff5a6a", text: "연결 오류" },
};

export default function HeaderBar() {
  const { nickname, myColor, rerollNickname, onlineCount, myCup, liveStatus, liveError, coldCups, streak } = useBreakRoom();
  const isMobile = useIsMobile();
  const now = useClock();
  const { enabled: soundOn, toggle: toggleSound } = useSound();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const status = STATUS_LABEL[liveStatus];

  return (
    <>
    <header style={{
      background: "hsl(28 70% 48%)",
      borderBottom: "3px solid hsl(28 40% 28%)",
      padding: "5px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      minHeight: 36,
      gap: 6,
    }}>
      {/* 왼쪽: 타이틀 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{
          fontSize: 14, color: "white",
          fontFamily: "'DotGothic16', monospace",
          textShadow: "2px 2px 0 rgba(0,0,0,0.35)",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          ☕ 온라인 탕비실
        </span>

        {/* 라이브/데모 상태 표시 — 문제가 있으면 서버가 한 말을 그대로 물고 있는다 */}
        <div
          title={liveError ?? undefined}
          style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px",
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontFamily: "'DotGothic16', monospace",
            fontSize: 10, color: "rgba(255,255,255,0.8)",
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: liveError ? "help" : "default",
          }}
        >
          <span style={{
            display: "inline-block",
            width: 6, height: 6,
            borderRadius: "50%",
            background: status.dot,
            boxShadow: liveStatus === "connected" ? `0 0 4px ${status.dot}` : "none",
            flexShrink: 0,
          }} />
          {status.text}
        </div>
      </div>

      {/* 오른쪽: 상태 */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {/* 사운드 토글 */}
        <button
          onClick={toggleSound}
          title={soundOn ? "소리 끄기" : "소리 켜기 (탕비실 ASMR)"}
          style={{
            padding: "2px 6px",
            background: soundOn ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.22)",
            border: `2px solid ${soundOn ? "rgba(120,255,160,0.5)" : "rgba(255,255,255,0.18)"}`,
            color: "white", fontSize: 10, lineHeight: 1.4,
            cursor: "pointer",
            fontFamily: "'DotGothic16', monospace",
            touchAction: "manipulation",
          }}
        >
          {soundOn ? "🔊" : "🔇"}
        </button>

        {/* 연속 출근 스트릭 */}
        {streak >= 2 && (
          <Chip>
            <span style={{ color: "#ffd27a" }}>🔥{streak}일</span>
          </Chip>
        )}

        {/* 온라인 수 — live 모드만 표시 */}
        {liveStatus !== "demo" && (
          <Chip>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5aff7a", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.85)" }}>{onlineCount}명</span>
          </Chip>
        )}

        {/* 다녀간 사람 (식은 컵) — 데스크탑만 */}
        {!isMobile && coldCups.length > 0 && (
          <Chip>
            <span style={{ color: "rgba(255,255,255,0.65)" }}>다녀감 {coldCups.length}</span>
          </Chip>
        )}

        {/* 닉네임 */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Chip>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>나:</span>
            <span style={{
              color: myColor, fontWeight: "bold",
              textShadow: "1px 1px 0 rgba(0,0,0,0.4)",
              maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {nickname}
            </span>
          </Chip>
          {!myCup && (
            <button
              onClick={rerollNickname}
              title="닉네임 다시 뽑기"
              style={{
                marginLeft: 2, padding: "2px 5px",
                background: "rgba(0,0,0,0.28)",
                border: "2px solid rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.75)",
                fontFamily: "'DotGothic16', monospace",
                fontSize: 9, cursor: "pointer",
              }}
            >🎲</button>
          )}
        </div>

        {/* 시간 — 데스크탑만 */}
        {!isMobile && <Chip>{timeStr}</Chip>}
      </div>
    </header>

    {/* 연결이 깨졌으면 이유를 화면에 그대로 띄운다.
        툴팁은 폰에서 못 보고, "연결 오류" 네 글자로는 아무것도 알 수 없다. */}
    {liveStatus === "error" && liveError && (
      <div style={{
        background: "hsl(355 55% 32%)",
        borderBottom: "2px solid hsl(355 40% 20%)",
        color: "hsl(355 25% 92%)",
        fontFamily: "'DotGothic16', monospace",
        fontSize: 9, lineHeight: 1.6,
        padding: "4px 10px",
        flexShrink: 0,
        wordBreak: "break-word",
      }}>
        실시간 연결 실패 — {liveError}
      </div>
    )}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 3,
      padding: "2px 7px",
      background: "rgba(0,0,0,0.22)",
      border: "2px solid rgba(255,255,255,0.18)",
      fontFamily: "'DotGothic16', monospace",
      fontSize: 10, color: "white",
      whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}
