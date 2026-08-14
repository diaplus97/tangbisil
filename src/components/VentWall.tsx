/**
 * VentWall — 흡연실 하소연 벽
 *
 * 냉장고가 "다음 사람에게 덕담" 이라면 이쪽은 그 반대편이다.
 * 회사 얘기를 한 줄 적고 가면 다음 사람이 읽고 "나도" 를 누른다.
 * 하소연은 공감을 받아야 의미가 생긴다 — 그 버튼이 이 기능의 전부다.
 *
 * 흡연실엔 이미 벽 낙서가 있으니 진짜 하소연도 그 사이에 붙는다.
 * 다만 남이 쓴 것과 원래 있던 것은 구분돼야 해서 색과 "나도" 수로 나눈다.
 */
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBreakRoom } from "@/context/BreakRoomContext";
import { sound } from "@/lib/sound";
import { CRISIS_RESOURCES } from "@/lib/npcPrompt";
import {
  listVents, listWallVents, agreeVent, reportVent, pruneVents,
  hasAgreed, hasReported, agoText, MAX_LEN, type Vent, type VentSort,
} from "@/lib/vents";

const INK = "hsl(30 25% 16%)";

/** 벽에 붙는 자리.
 *  피해야 할 것이 많다 — 문(왼쪽 3~26%), 창문(오른쪽 위), 원래 낙서(y 44~66%),
 *  재떨이(오른쪽 아래), 바닥선(y 78% 부터는 벽이 아니다).
 *  그래서 둘만 붙인다. 나머지는 패널에서 본다. */
/*  낙서 밭은 y 43~68 을 통째로 쓴다 (재봤다). 그 위와 아래로 나눠 붙인다.
 *  위치를 top 으로 잡으면 화면이 짧을 때(375x600) 쪽지 높이 비중이 커져서
 *  아래로 자라 낙서를 덮는다. bottom 기준이면 어느 화면에서든
 *  아래 끝이 고정되므로 낙서·바닥선을 안 넘는다. */
const SPOTS = [
  { x: 57, bottom: 58, rot: 3 },   // 아래 끝이 y42 — 낙서(43.5) 바로 위
  { x: 29, bottom: 23, rot: -3 },  // 아래 끝이 y77 — 바닥선(78) 바로 위
];

/** 쪽지 색 — 사무실 포스트잇처럼 몇 가지가 섞여 있어야 벽이 산다 */
const PAPER = ["hsl(48 72% 76%)", "hsl(150 40% 76%)", "hsl(340 45% 80%)", "hsl(200 45% 78%)"];

export default function VentWall() {
  const [vents, setVents] = useState<Vent[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    // 벽에는 방금 붙은 것 + 제일 공감받은 것. 최신만 걸면
    // 사람이 많아졌을 때 잘 쓴 글이 순식간에 사라진다
    listWallVents().then(setVents).catch(() => setVents([]));
  }, []);

  useEffect(() => {
    refresh();
    pruneVents();
  }, [refresh]);

  return (
    <>
      {/* 벽에 붙은 쪽지.
          원래 낙서는 벽에 직접 "긁은" 글씨다 — 배경 없이 흐릿한 글자만 있다.
          진짜 하소연은 누가 와서 "붙이고 간" 쪽지라 종이와 압정이 있다.
          같은 벽에 있어도 한눈에 갈린다. */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
        {vents.slice(0, SPOTS.length).map((v, i) => (
          <div
            key={v.id}
            data-vent-note
            style={{
              position: "absolute",
              left: `${SPOTS[i].x}%`, bottom: `${SPOTS[i].bottom}%`,
              transform: `rotate(${SPOTS[i].rot}deg)`,
              transformOrigin: "50% 100%",
              width: 118,
              padding: "8px 6px 5px",
              background: PAPER[i % PAPER.length],
              border: `2px solid ${INK}`,
              boxShadow: "2px 3px 0 rgba(0,0,0,0.45)",
              fontFamily: "'DotGothic16', monospace",
            }}
          >
            {/* 압정 — "붙였다" 는 걸 한 글자도 안 읽고 알 수 있다 */}
            <div style={{
              position: "absolute", left: "50%", top: -4,
              transform: "translateX(-50%)",
              width: 9, height: 9, borderRadius: "50%",
              background: "hsl(0 62% 48%)",
              border: `2px solid ${INK}`,
            }} />
            <div style={{
              fontSize: 9, lineHeight: 1.4,
              color: "hsl(30 35% 18%)", wordBreak: "keep-all",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {v.text}
            </div>
            {/* 공감 수는 구석에 겹쳐 놓는다 — 줄을 하나 더 쓰면
                짧은 화면에서 쪽지가 낙서를 덮는다 */}
            {v.agrees > 0 && (
              <div style={{
                position: "absolute", right: -5, bottom: -6,
                fontSize: 8, lineHeight: 1, padding: "2px 4px",
                background: "hsl(28 60% 46%)", color: "hsl(38 60% 96%)",
                border: `2px solid ${INK}`,
              }}>
                나도 {v.agrees}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 벽 열기 — 바닥선(78%) 위, 재떨이(오른쪽) 왼편.
          아래쪽에 두면 담배 바에 가려서 아예 안 보인다 */}
      <button
        onClick={() => { sound.play("blip"); setOpen(true); }}
        data-vent-open
        style={{
          // y 83 은 작은 화면(375x600)에서 담배 바와 겹친다 — 재보고 79 로 올렸다
          position: "absolute", left: "38%", top: "79%",
          transform: "translateX(-50%)",
          padding: "7px 12px",
          background: "hsl(150 8% 24%)",
          color: "hsl(150 10% 84%)",
          border: `3px solid ${INK}`,
          boxShadow: "2px 2px 0 rgba(0,0,0,0.45)",
          fontFamily: "'DotGothic16', monospace", fontSize: 11,
          cursor: "pointer", touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          zIndex: 6, whiteSpace: "nowrap",
        }}
      >
        🖊 벽에 한 줄 {vents.length > 0 && `(${vents.length})`}
      </button>

      {open && createPortal(
        <VentPanel onClose={() => { setOpen(false); refresh(); }} />,
        document.body,
      )}
    </>
  );
}

/* ─── 벽 전체 ────────────────────────────────────────────── */

function VentPanel({ onClose }: { onClose: () => void }) {
  const { writeVent } = useBreakRoom();
  const [vents, setVents] = useState<Vent[] | null>(null);
  const [sort, setSort] = useState<VentSort>("recent");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);   // 나도/신고 후 다시 그리기

  const load = useCallback(() => {
    listVents(sort)
      .then((v) => { setVents(v); setErr(null); })
      .catch((e) => {
        setVents([]);
        const m = e instanceof Error ? e.message : "벽을 못 읽었어요";
        setErr(/relation .*vents.* does not exist|schema cache/i.test(m)
          ? "하소연 벽 테이블이 아직 없어요 — supabase/schema.sql 을 실행해주세요"
          : m);
      });
  }, [sort]);
  useEffect(load, [load]);

  const post = async () => {
    if (busy) return;
    setBusy(true);
    const res = await writeVent(text);
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason ?? "못 붙였어요");
      setCrisis(!!res.crisis);
      return;
    }
    setText(""); setErr(null); setCrisis(false);
    load();
  };

  const agree = async (v: Vent) => {
    if (await agreeVent(v.id)) { sound.play("blip"); setTick((n) => n + 1); load(); }
  };
  const report = async (v: Vent) => {
    if (await reportVent(v.id)) { setTick((n) => n + 1); load(); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 92,
        background: "rgba(10,14,12,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, fontFamily: "'DotGothic16', monospace",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-up"
        style={{
          width: "100%", maxWidth: 340, maxHeight: "86vh",
          display: "flex", flexDirection: "column",
          background: "hsl(150 6% 88%)",
          border: `4px solid ${INK}`,
          boxShadow: "5px 5px 0 rgba(0,0,0,0.45)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", background: "hsl(150 8% 78%)",
          borderBottom: `3px solid ${INK}`,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>🚬</span>
          <b style={{ fontSize: 13, color: "hsl(150 15% 22%)" }}>흡연실 벽</b>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: "auto", width: 32, height: 32, lineHeight: 1,
              background: "hsl(150 6% 72%)", border: `3px solid ${INK}`,
              fontFamily: "'DotGothic16', monospace", fontSize: 14,
              cursor: "pointer", touchAction: "manipulation",
            }}
          >✕</button>
        </div>

        {/* 최신순 / 공감순 — 공감받은 건 밀려나지 않고 며칠 남는다 */}
        <div style={{
          display: "flex", gap: 0,
          borderBottom: `3px solid ${INK}`, background: "hsl(150 8% 84%)",
        }}>
          {([["recent", "최근에 붙은 것"], ["top", "공감 많은 것"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              style={{
                flex: 1, padding: "8px 6px",
                fontFamily: "'DotGothic16', monospace", fontSize: 11,
                background: sort === k ? "hsl(45 22% 95%)" : "transparent",
                color: sort === k ? "hsl(30 35% 20%)" : "hsl(150 5% 45%)",
                border: "none",
                borderBottom: sort === k ? "3px solid hsl(28 60% 46%)" : "3px solid transparent",
                cursor: "pointer", touchAction: "manipulation",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 붙어 있는 것들 */}
        <div data-vent-list style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          {vents === null && (
            <div style={{ fontSize: 12, color: "hsl(150 6% 45%)", textAlign: "center", padding: "18px 0" }}>
              읽는 중...
            </div>
          )}
          {vents?.length === 0 && (
            <div style={{
              fontSize: 12, color: "hsl(150 6% 42%)", textAlign: "center",
              padding: "16px 8px", lineHeight: 1.8,
            }}>
              아직 아무도 안 적었어요.<br />
              <span style={{ fontSize: 11, color: "hsl(150 6% 52%)" }}>
                한 줄 적어두면 다음 사람이 읽어요
              </span>
            </div>
          )}
          {vents?.map((v, idx) => {
            const mine = hasAgreed(v.id);
            return (
              <div key={`${v.id}-${tick}`} style={{
                position: "relative",
                padding: "12px 9px 8px",
                background: PAPER[idx % PAPER.length],
                border: `3px solid ${INK}`,
                boxShadow: "2px 3px 0 rgba(0,0,0,0.3)",
              }}>
                <div style={{
                  position: "absolute", left: "50%", top: -5,
                  transform: "translateX(-50%)",
                  width: 10, height: 10, borderRadius: "50%",
                  background: "hsl(0 62% 48%)", border: `2px solid ${INK}`,
                }} />
                <div style={{ fontSize: 13, color: "hsl(30 35% 18%)", lineHeight: 1.5, wordBreak: "keep-all" }}>
                  {v.text}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "hsl(150 5% 48%)" }}>
                    <b style={{ color: v.color }}>{v.nick.replace("Anonymous", "A")}</b>
                    {" · "}{agoText(v.createdAt)}
                  </span>
                  <button
                    onClick={() => agree(v)}
                    disabled={mine}
                    title={mine ? "이미 눌렀어요" : "나도 그래요"}
                    style={{
                      marginLeft: "auto",
                      padding: "5px 9px", fontSize: 11,
                      fontFamily: "'DotGothic16', monospace",
                      background: mine ? "hsl(28 45% 62%)" : "hsl(38 30% 84%)",
                      color: mine ? "hsl(38 55% 97%)" : "hsl(30 25% 28%)",
                      border: `2px solid ${INK}`,
                      cursor: mine ? "default" : "pointer",
                      touchAction: "manipulation",
                    }}
                  >
                    나도 {v.agrees > 0 ? v.agrees : ""}
                  </button>
                  <button
                    onClick={() => report(v)}
                    disabled={hasReported(v.id)}
                    title="보기 불편한 글이면 눌러주세요"
                    aria-label="신고"
                    style={{
                      padding: "5px 7px", fontSize: 10,
                      fontFamily: "'DotGothic16', monospace",
                      background: "none", border: "none",
                      color: hasReported(v.id) ? "hsl(0 30% 55%)" : "hsl(150 5% 55%)",
                      cursor: hasReported(v.id) ? "default" : "pointer",
                      touchAction: "manipulation",
                    }}
                  >⚑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 쓰기 */}
        <div style={{
          borderTop: `3px solid ${INK}`, background: "hsl(150 8% 82%)", padding: "9px 10px",
        }}>
          {crisis ? (
            // 힘든 얘기를 하러 온 사람에게 "저장했습니다" 하고 끝내면 안 된다
            <div style={{
              background: "hsl(45 30% 95%)", border: `3px solid ${INK}`, padding: "10px 11px",
            }}>
              <div style={{ fontSize: 12, color: "hsl(30 30% 20%)", lineHeight: 1.8 }}>
                혼자 두기 어려운 얘기 같아요.<br />
                벽에 붙이는 대신 지금 통화할 수 있는 곳을 남겨둘게요.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {CRISIS_RESOURCES.map((r) => (
                  <a
                    key={r.tel}
                    href={`tel:${r.tel}`}
                    style={{
                      display: "block", textAlign: "center",
                      padding: "9px 10px", fontSize: 13,
                      background: "hsl(200 55% 44%)", color: "hsl(200 40% 97%)",
                      border: `3px solid ${INK}`, textDecoration: "none",
                      fontFamily: "'DotGothic16', monospace",
                    }}
                  >
                    {r.label} {r.tel}
                  </a>
                ))}
              </div>
              <button
                onClick={() => { setCrisis(false); setErr(null); }}
                style={{
                  marginTop: 8, width: "100%", padding: "7px 10px", fontSize: 11,
                  fontFamily: "'DotGothic16', monospace",
                  background: "hsl(150 6% 74%)", color: "hsl(150 15% 26%)",
                  border: `3px solid ${INK}`, cursor: "pointer", touchAction: "manipulation",
                }}
              >
                다른 얘기 적을게요
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={text}
                  onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); setErr(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); post(); } }}
                  placeholder="오늘 회사 어땠어요?"
                  style={{
                    flex: 1, minWidth: 0, padding: "9px 10px",
                    background: "hsl(45 25% 96%)",
                    border: `3px solid ${INK}`, outline: "none",
                    fontFamily: "'DotGothic16', monospace", fontSize: 13,
                    color: "hsl(30 25% 20%)",
                  }}
                />
                <button
                  onClick={post}
                  disabled={busy || !text.trim()}
                  aria-label="벽에 붙이기"
                  style={{
                    padding: "9px 13px", fontSize: 13,
                    fontFamily: "'DotGothic16', monospace",
                    background: busy || !text.trim() ? "hsl(150 5% 66%)" : "hsl(28 55% 50%)",
                    color: "hsl(38 40% 97%)",
                    border: `3px solid ${INK}`,
                    cursor: busy || !text.trim() ? "not-allowed" : "pointer",
                    touchAction: "manipulation", whiteSpace: "nowrap",
                  }}
                >
                  붙이기
                </button>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginTop: 5,
                fontSize: 10, color: err ? "hsl(0 50% 38%)" : "hsl(150 5% 48%)",
              }}>
                <span>{err ?? `한 사람당 하나 · ${MAX_LEN}자까지`}</span>
                <span style={{ marginLeft: "auto" }}>{text.length}/{MAX_LEN}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
