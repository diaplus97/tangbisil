#!/usr/bin/env node
/**
 * 복도 레이싱 난이도 — 눈대중 대신 굴려서 맞춘다.
 *
 * 사람은 화면을 보자마자 움직이지 못한다. 반응 지연을 넣고,
 * "지금 내 앞에 오는 껍질을 피해 가장 가까운 빈 곳으로 간다" 는
 * 단순한 사람을 여러 명 굴린다.
 *
 *   node scripts/tune-race.mjs [반응지연ms ...]
 */
const VB_W = 300, VB_H = 420;
const CUP_Y = VB_H - 58, CUP_R = 17, LANE_PAD = 26;

const P = {
  SPEED_START: +(process.env.SPEED_START ?? 165),
  SPEED_MAX:   +(process.env.SPEED_MAX ?? 470),
  SPEED_RAMP:  +(process.env.SPEED_RAMP ?? 9),
  ROW_START:   +(process.env.ROW_START ?? 0.86),   // 줄 간격(초)
  ROW_MIN:     +(process.env.ROW_MIN ?? 0.40),
  ROW_RAMP:    +(process.env.ROW_RAMP ?? 0.020),
  BLOCK2_AT:   +(process.env.BLOCK2_AT ?? 9),      // 4칸 중 2칸 막기 시작
  BLOCK3_AT:   +(process.env.BLOCK3_AT ?? 26),     // 3칸 막기 시작
  CUP_SPEED:   +(process.env.CUP_SPEED ?? 400),
  PX_PER_M:    +(process.env.PX_PER_M ?? 14),
};
const SLIP_SEC = 0.85, SLIP_PUSH = 118, MERCY_SEC = 1.1;
const SUGAR_P = 0.16, LIVES = 3, LANES = 4;
/** 껍질 판정 반폭 — 레인 간격(62)보다 넓어야 무적 자리가 안 생긴다 */
const PEEL_HALF = +(process.env.PEEL_HALF ?? 34);

function run(reactMs, rng) {
  const g = { t: 0, dist: 0, speed: P.SPEED_START, spawnAt: 0.6,
    x: VB_W / 2, target: VB_W / 2, lives: LIVES, sugar: 0,
    slipUntil: 0, slipDir: 1, mercyUntil: 0, lastLane: -1, decideAt: 0,
    seenRow: -1, pending: false };
  let objs = [], id = 0;
  const dt = 1 / 60;

  while (g.lives > 0 && g.t < 400) {
    g.t += dt;
    g.speed = Math.min(P.SPEED_MAX, P.SPEED_START + g.t * P.SPEED_RAMP);
    g.dist += (g.speed * dt) / P.PX_PER_M;

    const slip = g.t < g.slipUntil;
    if (slip) {
      g.x += g.slipDir * SLIP_PUSH * dt;
      if (g.x <= LANE_PAD || g.x >= VB_W - LANE_PAD) g.slipDir *= -1;
      g.x = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD, g.x));
    } else {
      // 반응 지연 — 이 간격으로만 목표를 갱신한다
      // 사람은 화면 전체를 최적화하지 않는다. 제일 가까운 줄 하나만 보고,
      // 그것도 정확히 못 겨눈다. 이걸 빼면 시뮬이 무적이 되어 난이도를
      // 올릴수록 오래 사는 역전이 난다 (실제로 그렇게 나왔다).
      // 사람은 줄마다 한 번 판단하고 그대로 간다. 매 프레임 다시 재면
      // 흔들림을 계속 쫓게 되어, 반응이 빠를수록 오히려 더 헤매는
      // 이상한 결과가 나온다 (실제로 그렇게 나왔다).
      const ahead = objs.filter(o => !o.hit && o.kind === "peel" && o.y < CUP_Y - 10);
      if (ahead.length) {
        const nearestY = Math.min(...ahead.map(o => o.y));
        const row = ahead.filter(o => o.y - nearestY < 25);
        const rowId = Math.min(...row.map(o => o.id));
        if (rowId !== g.seenRow) {
          g.seenRow = rowId;
          g.decideAt = g.t + reactMs / 1000;   // 이만큼 늦게 반응한다
          g.pending = true;
        }
        if (g.pending && g.t >= g.decideAt) {
          g.pending = false;
          let bestX = g.x, bestScore = -1e9;
          for (let x = LANE_PAD; x <= VB_W - LANE_PAD; x += 6) {
            const near = Math.min(...row.map(o => Math.abs(o.x - x)));
            const score = Math.min(near, 62) * 3 - Math.abs(x - g.x) * 0.5;
            if (score > bestScore) { bestScore = score; bestX = x; }
          }
          // 조준 흔들림 — 줄마다 한 번만 (그 판단으로 끝까지 간다)
          g.target = Math.max(LANE_PAD, Math.min(VB_W - LANE_PAD,
            bestX + (rng() - 0.5) * 30));
        }
      }
      const d = g.target - g.x;
      g.x += Math.sign(d) * Math.min(Math.abs(d), P.CUP_SPEED * dt);
    }

    // 줄 단위로 깐다 — 4칸 중 몇 칸을 막을지가 난이도다.
    // 흩뿌리면 늘 빈 곳이 있어서 아무리 빨라도 안 어렵다 (재봤다).
    g.spawnAt -= dt;
    if (g.spawnAt <= 0) {
      g.spawnAt = Math.max(P.ROW_MIN, P.ROW_START - g.t * P.ROW_RAMP);
      const block = g.t >= P.BLOCK3_AT ? 3 : g.t >= P.BLOCK2_AT ? 2 : 1;
      const laneW = (VB_W - LANE_PAD * 2) / LANES;
      // 다음 빈 칸은 손이 닿는 데까지만 (게임과 같은 규칙)
      const jump = Math.max(1, Math.min(LANES - 1, Math.floor((g.spawnAt * P.CUP_SPEED) / laneW)));
      const lo = Math.max(0, g.lastLane - jump), hi = Math.min(LANES - 1, g.lastLane + jump);
      const gap = g.lastLane < 0 ? Math.floor(rng() * LANES) : lo + Math.floor(rng() * (hi - lo + 1));
      g.lastLane = gap;
      const others = [0,1,2,3].filter(l => l !== gap).sort(() => rng() - 0.5);
      for (const l of others.slice(0, Math.min(block, LANES - 1))) {
        objs.push({ id: id++, kind: "peel", x: LANE_PAD + laneW * l + laneW / 2, y: -30, hit: false });
      }
      if (rng() < SUGAR_P) {
        objs.push({ id: id++, kind: "sugar", x: LANE_PAD + laneW * gap + laneW / 2, y: -30, hit: false });
      }
    }

    const mercy = g.t < g.mercyUntil;
    for (const o of objs) {
      o.y += g.speed * dt;
      if (o.hit) continue;
      if (Math.abs(o.x - g.x) < (o.kind === "sugar" ? CUP_R + 11 : PEEL_HALF)
          && Math.abs(o.y - CUP_Y) < CUP_R + 8) {
        if (o.kind === "sugar") { o.hit = true; g.sugar++; }
        else if (!mercy && !slip) {
          o.hit = true; g.lives--;
          g.slipUntil = g.t + SLIP_SEC;
          g.mercyUntil = g.t + SLIP_SEC + MERCY_SEC;
          g.slipDir = g.x < VB_W / 2 ? 1 : -1;
        }
      }
    }
    objs = objs.filter(o => o.y < VB_H + 40);
  }
  return { m: Math.floor(g.dist) + g.sugar * 12, sec: g.t };
}

function seeded(s) { return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

const delays = process.argv.slice(2).map(Number);
const list = delays.length ? delays : [120, 200, 280, 360, 450];
const GOAL = +(process.env.GOAL ?? 120);
console.log(`반응지연   평균 m   중앙값   최고    한 판 길이   ${GOAL}m 달성률`);
for (const d of list) {
  const runs = [];
  for (let i = 0; i < 260; i++) runs.push(run(d, seeded(i * 7919 + 13)));
  const ms = runs.map(r => r.m).sort((a,b)=>a-b);
  const avg = Math.round(ms.reduce((a,b)=>a+b,0) / ms.length);
  const med = ms[Math.floor(ms.length/2)];
  const sec = (runs.reduce((a,r)=>a+r.sec,0)/runs.length).toFixed(1);
  const goal = +(process.env.GOAL ?? 120);
  const clear = Math.round(ms.filter(m=>m>=goal).length / ms.length * 100);
  console.log(`${String(d+"ms").padEnd(9)} ${String(avg).padStart(6)} ${String(med).padStart(8)} ${String(ms[ms.length-1]).padStart(7)} ${(sec+"s").padStart(11)} ${String(clear+"%").padStart(12)}`);
}
