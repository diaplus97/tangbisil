export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "hsl(38 22% 78%)",
      fontFamily: "'DotGothic16', monospace",
    }}>
      <div style={{
        background: "hsl(38 42% 91%)",
        border: "3px solid hsl(30 25% 20%)",
        boxShadow: "5px 5px 0 rgba(0,0,0,0.22)",
        padding: "26px 30px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>☕</div>
        <div style={{ fontSize: 16, color: "hsl(30 25% 22%)", marginBottom: 6 }}>
          404 — 없는 방이에요
        </div>
        <div style={{ fontSize: 11, color: "hsl(30 20% 48%)", marginBottom: 16 }}>
          탕비실은 저쪽입니다
        </div>
        <a href={import.meta.env.BASE_URL} style={{
          display: "inline-block",
          padding: "7px 16px",
          background: "hsl(25 80% 52%)",
          color: "white",
          textDecoration: "none",
          border: "2px solid hsl(30 25% 20%)",
          boxShadow: "2px 2px 0 rgba(0,0,0,0.22)",
          fontSize: 12,
          fontFamily: "inherit",
        }}>
          탕비실로 가기
        </a>
      </div>
    </div>
  );
}
