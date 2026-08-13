/**
 * BlastFx — 전자레인지가 터지는 순간
 *
 * 예전엔 방이 한 번 흔들리고 끝이라 "터졌다"는 걸 알아채기 어려웠다.
 * 화염구 → 충격파 링 → 파편 → 연기 순으로 겹쳐서 보여준다.
 * 부모에 absolute 로 얹히므로 부모는 position: relative 여야 한다.
 */
import { useMemo } from "react";

/** 파편 하나 */
type Bit = { emoji: string; dx: number; dy: number; spin: number; delay: number; size: number };

const BIT_FACES = ["🥟", "⚙️", "🔩", "💨", "🥟", "◾", "◽", "🔥"];

export default function BlastFx({ scale = 1 }: { scale?: number }) {
  // 매번 다른 방향으로 튄다 — 마운트 때 한 번만 뽑는다
  const bits = useMemo<Bit[]>(() => {
    const n = 14;
    return Array.from({ length: n }, (_, i) => {
      // 위쪽으로 더 많이 튀게 각도를 살짝 위로 편향
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (44 + Math.random() * 62) * scale;
      return {
        emoji: BIT_FACES[i % BIT_FACES.length],
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 26 * scale,
        spin: (Math.random() > 0.5 ? 1 : -1) * (220 + Math.random() * 380),
        delay: Math.random() * 0.08,
        size: (9 + Math.random() * 7) * scale,
      };
    });
  }, [scale]);

  const core = 92 * scale;

  return (
    <div style={{
      position: "absolute", inset: 0,
      pointerEvents: "none", zIndex: 6,
      overflow: "visible",
    }}>
      {/* 충격파 링 — 두 겹으로 시차를 준다 */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className="blast-ring"
          style={{
            position: "absolute", left: "38%", top: "50%",
            width: core, height: core,
            border: `9px solid ${i === 0 ? "rgba(255,236,190,0.95)" : "rgba(255,150,40,0.7)"}`,
            borderRadius: "50%",
            animationDelay: `${i * 0.11}s`,
          }}
        />
      ))}

      {/* 화염구 */}
      <div
        className="blast-core"
        style={{
          position: "absolute", left: "38%", top: "50%",
          width: core * 1.15, height: core * 1.15,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #fffdf4 0%, #ffe9a8 22%, #ffab2e 46%, #e8541a 68%, rgba(150,40,10,0.35) 82%, transparent 92%)",
        }}
      />

      {/* 💥 — 한 번 크게 */}
      <div
        className="blast-core"
        style={{
          position: "absolute", left: "38%", top: "50%",
          fontSize: 46 * scale, lineHeight: 1,
          animationDelay: "0.05s",
          filter: "drop-shadow(0 0 6px rgba(255,180,60,0.9))",
        }}
      >
        💥
      </div>

      {/* 파편 */}
      {bits.map((b, i) => (
        <span
          key={i}
          className="debris"
          style={{
            position: "absolute", left: "38%", top: "50%",
            fontSize: b.size, lineHeight: 1,
            ["--dx" as string]: `${b.dx}px`,
            ["--dy" as string]: `${b.dy}px`,
            ["--spin" as string]: `${b.spin}deg`,
            animationDelay: `${b.delay}s`,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
