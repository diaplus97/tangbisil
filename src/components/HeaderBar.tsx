import { useBreakRoom, type LiveStatus } from "@/context/BreakRoomContext";
import { useClock } from "@/hooks/useClock";
import { useIsMobile } from "@/hooks/use-mobile";

const STATUS_LABEL: Record<LiveStatus, { dot: string; text: string }> = {
  demo:       { dot: "#8899aa", text: "오프라인" },
  connecting: { dot: "#f5a623", text: "연결 중" },
  connected:  { dot: "#5aff7a", text: "라이브" },
  error:      { dot: "#ff5a6a", text: "연결 오류" },
};

export default function HeaderBar() {
  const { nickname, myColor, rerollNickname, onlineCount, myCup, liveStatus } = useBreakRoom();
  const isMobile = useIsMobile();
  const now = useClock();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const status = STATUS_LABEL[liveStatus];

  return (
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

        {/* 라이브/데모 상태 표시 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          padding: "2px 6px",
          background: "rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.15)",
          fontFamily: "'DotGothic16', monospace",
          fontSize: 10, color: "rgba(255,255,255,0.8)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
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
        {/* 온라인 수 — live 모드만 표시 */}
        {liveStatus !== "demo" && (
          <Chip>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5aff7a", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.85)" }}>{onlineCount}명</span>
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
