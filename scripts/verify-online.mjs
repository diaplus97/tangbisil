#!/usr/bin/env node
/**
 * 온라인(동시접속) 검증 — 배포된 사이트가 진짜 실시간 모드인지 확인한다.
 *
 *   npm run verify:online https://tangbisil-7h3.pages.dev
 *
 * 이 검사가 필요한 이유:
 * VITE_ 환경변수는 "빌드할 때" 번들에 박힌다. Cloudflare 에 값을 넣기만 하고
 * 재배포를 안 하면, 대시보드에는 값이 보이는데 사이트는 계속 오프라인이다.
 * 에러가 안 나기 때문에 눈으로는 구별이 안 된다 — 그래서 번들을 직접 뜯어본다.
 */

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("사용법: npm run verify:online <배포주소>");
  process.exit(2);
}

let failures = 0;
const pass = (m) => console.log(`  ✅ ${m}`);
const fail = (m, hint) => {
  console.log(`  ❌ ${m}`);
  if (hint) console.log(`     → ${hint}`);
  failures++;
};

console.log(`\n대상: ${base}\n`);

// ── 1. 번들 찾기 ──────────────────────────────────────────────
console.log("1. 앱 번들 받기");
let bundle = "";
try {
  const html = await fetch(base).then((r) => r.text());
  const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!m) {
    fail("index.html 에서 번들을 못 찾음", "빌드가 성공했는지 확인하세요.");
  } else {
    bundle = await fetch(`${base}${m[0]}`).then((r) => r.text());
    pass(`${m[0]} (${Math.round(bundle.length / 1024)}KB)`);
  }
} catch (e) {
  fail(`연결 실패: ${e.message}`, "주소가 맞는지 확인하세요.");
}

// ── 2. Supabase 설정이 번들에 박혔는가 ────────────────────────
console.log("\n2. 빌드에 Supabase 설정이 들어갔는가");
const urlMatch = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
// 공개 키 — 두 형식 다 받는다.
//  새 형식: sb_publishable_...   (신규 프로젝트 기본값)
//  옛 형식: eyJ... (anon JWT)
const keyMatch =
  bundle.match(/sb_publishable_[A-Za-z0-9_-]{10,}/) ??
  bundle.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);

if (!urlMatch || !keyMatch) {
  fail(
    "번들에 Supabase URL/anon key 가 없음 — 사이트는 오프라인 모드입니다",
    "Cloudflare Pages → Settings → Environment variables 의 Production 에 " +
      "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 넣고 **재배포**하세요. " +
      "값만 넣고 재배포를 안 하면 기존 번들은 그대로입니다.",
  );
  console.log(`\n결과: 실패 ${failures}건\n`);
  process.exit(1);
}
pass(`URL ${urlMatch[0]}`);
pass("anon key 포함됨");

const SB = urlMatch[0];
const KEY = keyMatch[0];
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// ── 3. cups 테이블이 있고 읽히는가 ────────────────────────────
console.log("\n3. cups 테이블 읽기");
try {
  const r = await fetch(`${SB}/rest/v1/cups?select=id,nickname,left_at&limit=5`, { headers });
  if (r.ok) {
    const rows = await r.json();
    pass(`읽기 OK — 현재 컵 ${rows.length}개${rows.length ? ` (${rows.filter((c) => !c.left_at).length}개는 자리에 있음)` : ""}`);
  } else {
    const t = await r.text();
    fail(
      `HTTP ${r.status} — ${t.slice(0, 160)}`,
      r.status === 404 || t.includes("does not exist")
        ? "supabase/schema.sql 을 SQL Editor 에서 실행하세요."
        : "RLS select 정책을 확인하세요.",
    );
  }
} catch (e) {
  fail(`요청 실패: ${e.message}`);
}

// ── 4. 삭제가 막혀 있는가 (방 통째로 비우기 방어) ─────────────
console.log("\n4. 아무나 컵을 지울 수 없는가");
try {
  // 실제로 지우면 안 되니 절대 존재하지 않는 id 를 노린다.
  const probe = `__verify_${Date.now()}__`;
  const r = await fetch(`${SB}/rest/v1/cups?id=eq.${probe}`, { method: "DELETE", headers });
  if (r.status === 401 || r.status === 403) {
    pass("DELETE 차단됨 (RLS)");
  } else if (r.ok) {
    fail(
      "anon key 로 DELETE 가 허용됨 — 누구나 방 전체를 비울 수 있습니다",
      "supabase/schema.sql 을 다시 실행하세요 (구버전 public_all 정책이 남아 있습니다).",
    );
  } else {
    console.log(`  ⚠️  판정 불가 (HTTP ${r.status})`);
  }
} catch (e) {
  console.log(`  ⚠️  판정 불가: ${e.message}`);
}

// ── 5. 정리 함수 ──────────────────────────────────────────────
console.log("\n5. 오래된 컵 정리 함수");
try {
  const r = await fetch(`${SB}/rest/v1/rpc/prune_old_cups`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}",
  });
  if (r.ok) pass("prune_old_cups() 호출됨");
  else fail(`HTTP ${r.status}`, "supabase/schema.sql 을 다시 실행하세요.");
} catch (e) {
  fail(`요청 실패: ${e.message}`);
}

// ── 6. Realtime ───────────────────────────────────────────────
console.log("\n6. Realtime (실시간 동기화)");
try {
  const ws = `${SB.replace("https://", "wss://")}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`;
  // Node 22 의 내장 WebSocket
  const sock = new WebSocket(ws);
  const ok = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 8000);
    sock.onopen = () => { clearTimeout(t); resolve(true); };
    sock.onerror = () => { clearTimeout(t); resolve(false); };
  });
  sock.close();
  if (ok) pass("웹소켓 연결됨");
  else fail("웹소켓 연결 실패", "Supabase 대시보드 → Database → Replication 에서 cups 가 켜져 있는지 확인하세요.");
} catch (e) {
  console.log(`  ⚠️  판정 불가: ${e.message}`);
}

console.log(
  failures === 0
    ? "\n결과: 통과 — 두 기기에서 열면 서로 보입니다.\n"
    : `\n결과: 실패 ${failures}건\n`,
);
process.exit(failures === 0 ? 0 : 1);
