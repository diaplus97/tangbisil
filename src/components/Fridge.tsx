/**
 * Fridge — 냉동고 아래에 붙은 냉장실
 *
 * "온라인 탕비실" 인데 정작 동접이 0~1명인 시간이 대부분이다.
 * 혼자 들어와도 빈 방이 아니게 하려면, 같은 시간에 없는 사람과도
 * 뭔가 주고받을 수 있어야 한다. 냉장고가 그 자리다 —
 * 먹을 걸 하나 넣어두고 가면 다음 사람이 꺼내 먹는다.
 *
 * 배치: 선반단은 187 높이인데 과일 바구니가 78 밖에 안 써서 그 아래가
 * 비어 있었다. 바구니를 냉장고 위에 올려둔 모양이 되는데, 실제 탕비실도
 * 대개 그렇게 생겼다. 남는 자리를 쓰는 것이라 방 배치는 안 바뀐다.
 */
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";
import {
  listFridge, pruneFridge, isSpoiled, agoText, canStore, NOTES, MY_LIMIT,
  type FridgeItem,
} from "@/lib/fridge";

const INK = "hsl(30 25% 16%)";
/** 과일 바구니와 폭을 맞춘다 — 바구니를 올려둔 냉장고처럼 보이게 */
const VB_W = 84;
const VB_H = 104;

export default function Fridge({ width = 84 }: { width?: number }) {
  const { myCup, heldItem } = useBreakRoom();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const w = width;
  const h = Math.round((VB_H * w) / VB_W);
  const scale = w / VB_W;
  const locked = !myCup;

  // 문에 붙는 숫자 — 열어보기 전에도 뭐가 들었는지 알려준다.
  // 이게 없으면 아무도 냉장고를 안 연다.
  const refresh = useCallback(() => {
    listFridge()
      .then((rows) => setCount(rows.length))
      .catch(() => setCount(null));
  }, []);

  useEffect(() => {
    refresh();
    pruneFridge();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <button
        onClick={() => { if (locked) return; sound.play("door"); setOpen(true); }}
        disabled={locked}
        title={locked ? "커피를 먼저 내려주세요" : "냉장고 — 누가 넣어둔 게 있을지도"}
        aria-label="냉장고 열기"
        style={{
          position: "relative", padding: 0, background: "none", border: "none",
          lineHeight: 0, cursor: locked ? "not-allowed" : "pointer",
          opacity: locked ? 0.55 : 1,
          touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
        }}
      >
        <FridgeSvg w={w} h={h} />
        {/* 안에 든 개수 — 0 이어도 보여준다. 비어 있다는 것도 정보다 */}
        {count !== null && !locked && (
          <span style={{
            position: "absolute", top: "58%", left: "50%", transform: "translateX(-50%)",
            fontFamily: "'DotGothic16', monospace", fontSize: Math.max(9, Math.round(11 * scale)),
            lineHeight: 1, padding: "1px 4px",
            background: count > 0 ? "hsl(45 88% 58%)" : "hsl(210 12% 62%)",
            color: count > 0 ? "hsl(30 40% 18%)" : "hsl(210 15% 96%)",
            border: `2px solid ${INK}`, whiteSpace: "nowrap", pointerEvents: "none",
          }}>
            {count > 0 ? `${count}개` : "빔"}
          </span>
        )}
      </button>

      {/* 방 안은 scale 이 걸려 있어 position:fixed 가 갇힌다 — body 에 붙인다 */}
      {open && createPortal(
        <FridgePanel
          heldLabel={heldItem?.label ?? null}
          heldEmoji={heldItem?.emoji ?? null}
          heldStorable={heldItem ? canStore(heldItem.id) : false}
          onClose={() => { setOpen(false); refresh(); }}
        />,
        document.body,
      )}
    </>
  );
}

/* ─── 열었을 때 ──────────────────────────────────────────── */

function FridgePanel({ heldLabel, heldEmoji, heldStorable, onClose }: {
  heldLabel: string | null;
  heldEmoji: string | null;
  heldStorable: boolean;
  onClose: () => void;
}) {
  const { storeInFridge, takeOutOfFridge } = useBreakRoom();
  const [items, setItems] = useState<FridgeItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteIdx, setNoteIdx] = useState(0);
  const [putting, setPutting] = useState(false);

  const load = useCallback(() => {
    listFridge()
      .then((rows) => { setItems(rows); setErr(null); })
      .catch((e) => {
        setItems([]);
        const msg = e instanceof Error ? e.message : "냉장고를 못 열었어요";
        // 테이블이 아직 없는 배포에서 원인을 숨기면 며칠을 헤맨다 (Invalid API key 때 겪었다)
        setErr(/relation .*fridge.* does not exist|schema cache/i.test(msg)
          ? "냉장고 테이블이 아직 없어요 — supabase/schema.sql 을 실행해주세요"
          : msg);
      });
  }, []);

  useEffect(load, [load]);

  const take = async (item: FridgeItem) => {
    if (busy) return;
    // 손이 차 있으면 못 꺼낸다 — 꺼내면 들고 있던 게 조용히 사라진다
    if (heldLabel) { setErr(`${heldLabel} 부터 처리하고 오세요`); return; }
    setBusy(true);
    const got = await takeOutOfFridge(item);
    setBusy(false);
    if (!got) { setErr("누가 먼저 꺼내 갔어요"); load(); return; }
    onClose();
  };

  const put = async () => {
    if (busy) return;
    setBusy(true);
    const res = await storeInFridge(NOTES[noteIdx]);
    setBusy(false);
    if (!res.ok) { setErr(res.reason ?? "못 넣었어요"); return; }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(20,12,6,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-up"
        style={{
          width: "100%", maxWidth: 340, maxHeight: "84vh",
          display: "flex", flexDirection: "column",
          background: "hsl(200 18% 92%)",
          border: `4px solid ${INK}`,
          boxShadow: "5px 5px 0 rgba(0,0,0,0.4)",
          fontFamily: "'DotGothic16', monospace",
        }}
      >
        {/* 머리 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", background: "hsl(200 22% 82%)",
          borderBottom: `3px solid ${INK}`,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🧊</span>
          <b style={{ fontSize: 14, color: "hsl(210 30% 22%)" }}>탕비실 냉장고</b>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: "auto", width: 32, height: 32, lineHeight: 1,
              background: "hsl(200 14% 74%)", border: `3px solid ${INK}`,
              fontFamily: "'DotGothic16', monospace", fontSize: 14,
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            ✕
          </button>
        </div>

        {/* 안 */}
        <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          {items === null && (
            <div style={{ fontSize: 12, color: "hsl(210 12% 45%)", textAlign: "center", padding: "18px 0" }}>
              여는 중...
            </div>
          )}

          {items?.length === 0 && (
            <div style={{
              fontSize: 12, color: "hsl(210 12% 42%)", textAlign: "center",
              padding: "16px 8px", lineHeight: 1.7,
            }}>
              비어 있어요.<br />
              <span style={{ color: "hsl(210 14% 52%)", fontSize: 11 }}>
                뭐 하나 넣어두면 다음 사람이 꺼내 먹어요
              </span>
            </div>
          )}

          {items?.map((it) => {
            const bad = isSpoiled(it);
            return (
              <button
                key={it.id}
                onClick={() => take(it)}
                disabled={busy}
                title={
                  heldLabel ? `${heldLabel} 을(를) 들고 있어서 못 꺼내요`
                  : bad ? "오래됐어요..." : `${it.label} 꺼내기`
                }
                style={{
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                  padding: "8px 9px", width: "100%",
                  background: bad ? "hsl(80 12% 84%)" : "hsl(38 40% 95%)",
                  border: `3px solid ${bad ? "hsl(80 10% 52%)" : INK}`,
                  boxShadow: "2px 2px 0 rgba(0,0,0,0.25)",
                  fontFamily: "'DotGothic16', monospace",
                  cursor: busy ? "wait" : heldLabel ? "not-allowed" : "pointer",
                  touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
                  opacity: heldLabel ? 0.5 : bad ? 0.8 : 1,
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, filter: bad ? "grayscale(0.55)" : "none" }}>
                  {it.emoji}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, color: "hsl(30 30% 20%)" }}>
                    {bad ? `${it.label} — 오래됐다` : it.label}
                  </span>
                  <span style={{
                    display: "block", fontSize: 10, color: "hsl(210 10% 45%)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    <b style={{ color: it.fromColor }}>{it.fromNick.replace("Anonymous", "A")}</b>
                    {" · "}{agoText(it.createdAt)}
                    {it.note && ` · "${it.note}"`}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: "hsl(210 14% 42%)", whiteSpace: "nowrap" }}>
                  {heldLabel ? "손이 참" : "꺼내기"}
                </span>
              </button>
            );
          })}

          {err && (
            <div style={{
              fontSize: 11, color: "hsl(0 55% 38%)", background: "hsl(0 50% 93%)",
              border: "2px solid hsl(0 40% 65%)", padding: "5px 8px", textAlign: "center",
            }}>
              {err}
            </div>
          )}
        </div>

        {/* 넣기 */}
        <div style={{
          borderTop: `3px solid ${INK}`, background: "hsl(200 20% 87%)",
          padding: "9px 10px",
        }}>
          {!heldLabel ? (
            <div style={{ fontSize: 11, color: "hsl(210 12% 45%)", textAlign: "center" }}>
              손에 뭘 들고 오면 여기 넣어둘 수 있어요 (한 사람당 {MY_LIMIT}개)
            </div>
          ) : !heldStorable ? (
            <div style={{ fontSize: 11, color: "hsl(210 12% 45%)", textAlign: "center" }}>
              {heldEmoji} {heldLabel} — 이건 넣어둬도 아무도 안 먹어요
            </div>
          ) : putting ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 11, color: "hsl(210 18% 32%)" }}>한 마디 골라주세요</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {NOTES.map((n, i) => (
                  <button
                    key={n}
                    onClick={() => setNoteIdx(i)}
                    style={{
                      padding: "6px 8px", fontSize: 11,
                      fontFamily: "'DotGothic16', monospace",
                      background: i === noteIdx ? "hsl(150 40% 46%)" : "hsl(200 12% 78%)",
                      color: i === noteIdx ? "hsl(150 40% 96%)" : "hsl(210 18% 30%)",
                      border: `2px solid ${INK}`, cursor: "pointer",
                      touchAction: "manipulation",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={put}
                  disabled={busy}
                  style={{
                    flex: 1, padding: "10px 12px", fontSize: 13,
                    fontFamily: "'DotGothic16', monospace",
                    background: "hsl(150 40% 46%)", color: "hsl(150 40% 97%)",
                    border: `3px solid ${INK}`, boxShadow: "2px 2px 0 rgba(0,0,0,0.35)",
                    cursor: busy ? "wait" : "pointer", touchAction: "manipulation",
                  }}
                >
                  {heldEmoji} 넣어두기
                </button>
                <button
                  onClick={() => setPutting(false)}
                  style={{
                    padding: "10px 12px", fontSize: 13,
                    fontFamily: "'DotGothic16', monospace",
                    background: "hsl(200 12% 74%)", color: "hsl(210 18% 28%)",
                    border: `3px solid ${INK}`, cursor: "pointer", touchAction: "manipulation",
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPutting(true)}
              style={{
                width: "100%", padding: "11px 12px", fontSize: 13,
                fontFamily: "'DotGothic16', monospace",
                background: "hsl(150 40% 46%)", color: "hsl(150 40% 97%)",
                border: `3px solid ${INK}`, boxShadow: "2px 2px 0 rgba(0,0,0,0.35)",
                cursor: "pointer", touchAction: "manipulation",
              }}
            >
              {heldEmoji} {heldLabel} 넣어두기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 냉장고 ─────────────────────────────────────────────── */

function FridgeSvg({ w, h }: { w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ imageRendering: "pixelated", display: "block" }}>
      {/* 몸통 */}
      <rect x="3" y="2" width="78" height="100" rx="3" fill="hsl(205 20% 74%)" stroke={INK} strokeWidth="3" />
      {/* 위 칸 (냉동실 문) */}
      <rect x="8" y="7" width="68" height="27" rx="2" fill="hsl(205 26% 85%)" stroke={INK} strokeWidth="2" />
      {/* 아래 칸 (냉장실 문) */}
      <rect x="8" y="38" width="68" height="59" rx="2" fill="hsl(205 28% 88%)" stroke={INK} strokeWidth="2" />
      {/* 손잡이 두 개 */}
      <rect x="66" y="13" width="4" height="15" rx="2" fill="hsl(205 12% 50%)" stroke={INK} strokeWidth="1.5" />
      <rect x="66" y="46" width="4" height="26" rx="2" fill="hsl(205 12% 50%)" stroke={INK} strokeWidth="1.5" />
      {/* 문에 붙은 자석 메모 — 아무도 안 떼는 그거 */}
      <rect x="14" y="44" width="15" height="11" rx="1" fill="hsl(48 70% 78%)" stroke={INK} strokeWidth="1.5"
        transform="rotate(-6 21 49)" />
      <rect x="33" y="46" width="12" height="9" rx="1" fill="hsl(150 35% 76%)" stroke={INK} strokeWidth="1.5"
        transform="rotate(4 39 50)" />
      {/* 라벨 */}
      <rect x="20" y="80" width="44" height="12" rx="1.5" fill="hsl(38 42% 90%)" stroke={INK} strokeWidth="2" />
      <text x="42" y="89" textAnchor="middle" fontSize="8"
        fontFamily="\'DotGothic16\', monospace" fill="hsl(210 25% 28%)">냉장고</text>
    </svg>
  );
}
