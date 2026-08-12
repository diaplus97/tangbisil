/**
 * DessertShelf — 벽에 달린 나무 디저트 선반
 *
 * 쿠키 항아리 / 도넛 박스 / 초콜릿 더미가 놓여 있고, 집으면 하나 톡 튀어나온다.
 * rate limit: 2회 / 20초 → 25초 쿨다운 (기존 로직 유지)
 */
import { useState, useCallback } from "react";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";

const DESSERTS = [
  { id: "cookie", emoji: "🍪", label: "쿠키",  message: "쿠키 하나 집어감 🍪" },
  { id: "donut",  emoji: "🍩", label: "도넛",  message: "도넛 먹고 버틴다 🍩" },
  { id: "royce",  emoji: "🍫", label: "초콜릿", message: "초콜릿 하나 챙김 🍫" },
];
const DESSERT_LIMIT = 2;
const DESSERT_WINDOW_MS = 20_000;
const DESSERT_COOLDOWN_MS = 25_000;
const COOL_MSGS = ["아 혈당..", "아 식곤증...", "잠깐 참아봐요 🤚", "아직 소화 중..."];

// viewBox 기준 아이템 영역 (오버레이 버튼 위치)
const VB_W = 140;
const VB_H = 66;
const ITEM_ZONES = [
  { x: 8,  w: 36 },  // 쿠키 항아리
  { x: 50, w: 40 },  // 도넛 박스
  { x: 96, w: 36 },  // 초콜릿
];

export default function DessertShelf({ compact }: { compact: boolean }) {
  const { sendMessage, myCup } = useBreakRoom();
  const locked = !myCup;

  const [popItem, setPopItem]         = useState<{ emoji: string; x: number } | null>(null);
  const [grabCount, setGrabCount]     = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [coolMsg, setCoolMsg]         = useState("");

  const grab = useCallback((item: typeof DESSERTS[0], idx: number) => {
    const now = Date.now();
    if (locked || now < cooldownEnd) return;

    const inWindow = now - windowStart < DESSERT_WINDOW_MS;
    const newCount = inWindow ? grabCount + 1 : 1;

    if (!inWindow) { setWindowStart(now); }
    setGrabCount(newCount);

    sendMessage(item.message);
    sound.play("crunch");
    setPopItem({ emoji: item.emoji, x: ITEM_ZONES[idx].x + ITEM_ZONES[idx].w / 2 });
    setTimeout(() => setPopItem(null), 1400);

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
  const W = compact ? 84 : 140;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* 쿨다운 멘트 */}
      {isCooling && (
        <div style={{
          fontFamily: "'DotGothic16', monospace", fontSize: compact ? 9 : 8,
          color: "#e07040", textAlign: "center", marginBottom: 2,
        }}>
          {coolMsg}
        </div>
      )}

      <div style={{
        position: "relative", width: W, lineHeight: 0,
        filter: isLocked ? "grayscale(0.85) opacity(0.6)" : "none",
        transition: "filter 0.3s",
      }}>
        <ShelfSvg w={W} />

        {/* 집기 오버레이 버튼 */}
        {DESSERTS.map((item, i) => (
          <button
            key={item.id}
            onClick={() => grab(item, i)}
            disabled={isLocked}
            title={locked ? "커피를 먼저 내려주세요" : isCooling ? coolMsg : item.message}
            style={{
              position: "absolute",
              left: `${(ITEM_ZONES[i].x / VB_W) * 100}%`,
              top: 0,
              width: `${(ITEM_ZONES[i].w / VB_W) * 100}%`,
              height: `${(52 / VB_H) * 100}%`,
              background: "transparent", border: "none", padding: 0,
              cursor: isLocked ? "not-allowed" : "pointer",
              touchAction: "manipulation",
            }}
          />
        ))}

        {/* 집은 아이템 팝 */}
        {popItem && (
          <div style={{
            position: "absolute",
            left: `${(popItem.x / VB_W) * 100}%`,
            top: -4,
            transform: "translateX(-50%)",
            fontSize: compact ? 15 : 18,
            animation: "snackPop 1.4s ease-out forwards",
            pointerEvents: "none", zIndex: 5, lineHeight: 1,
          }}>
            {popItem.emoji}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 선반 SVG ───────────────────────────────────────────── */
function ShelfSvg({ w }: { w: number }) {
  return (
    <svg width={w} height={Math.round(w * VB_H / VB_W)} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ imageRendering: "pixelated", display: "block", overflow: "visible" }}>
      {/* 선반 판자 */}
      <rect x="2" y="46" width="136" height="8" fill="#8b5a2b" stroke="#3a2410" strokeWidth="2" />
      <rect x="4" y="48" width="132" height="2" fill="#a06a35" />
      {/* 받침 브래킷 */}
      <polygon points="16,54 28,54 16,64" fill="#6e451f" stroke="#3a2410" strokeWidth="1.5" />
      <polygon points="124,54 112,54 124,64" fill="#6e451f" stroke="#3a2410" strokeWidth="1.5" />

      {/* 쿠키 항아리 */}
      <rect x="13" y="16" width="28" height="30" rx="3" fill="rgba(215,232,248,0.32)" stroke="#2a1a0a" strokeWidth="2" />
      <rect x="16" y="11" width="22" height="7" rx="2" fill="#a0622a" stroke="#2a1a0a" strokeWidth="2" />
      <text x="27" y="34" textAnchor="middle" fontSize="10">🍪</text>
      <text x="32" y="42" textAnchor="middle" fontSize="8">🍪</text>
      <text x="21" y="42" textAnchor="middle" fontSize="8">🍪</text>
      {/* 유리 하이라이트 */}
      <rect x="16" y="19" width="2.5" height="16" fill="rgba(255,255,255,0.4)" />

      {/* 도넛 박스 (열린 상자) */}
      <rect x="52" y="24" width="38" height="7" fill="#c89058" stroke="#2a1a0a" strokeWidth="1.5" />
      <rect x="51" y="30" width="40" height="16" rx="1" fill="#e0b078" stroke="#2a1a0a" strokeWidth="2" />
      <text x="62" y="43" textAnchor="middle" fontSize="11">🍩</text>
      <text x="79" y="43" textAnchor="middle" fontSize="11">🍩</text>
      <text x="71" y="29" textAnchor="middle" fontSize="4.5" fill="#7a4a1a" fontFamily="monospace">DONUT</text>

      {/* 초콜릿 더미 */}
      <rect x="98" y="39" width="34" height="7" rx="1" fill="#4a2c12" stroke="#241408" strokeWidth="1.5" />
      <rect x="100" y="31" width="30" height="7" rx="1" fill="#5a3618" stroke="#241408" strokeWidth="1.5" />
      <rect x="102" y="23" width="26" height="7" rx="1" fill="#6a4020" stroke="#241408" strokeWidth="1.5" />
      {/* 금박 밴드 */}
      <rect x="112" y="23" width="7" height="7" fill="#d4a017" />
      <rect x="110" y="31" width="7" height="7" fill="#b8880f" />
    </svg>
  );
}
