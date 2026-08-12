#!/usr/bin/env node
/**
 * 배포 검증 — 흡연실 NPC 가 실제로 동작하는지 한 번에 확인한다.
 *
 *   node scripts/verify-deploy.mjs https://tangbisil.pages.dev
 *   node scripts/verify-deploy.mjs http://localhost:8788     (wrangler pages dev)
 *
 * 이 검사가 필요한 이유:
 * 정적 파일이 함수를 가리면 /api/chat 이 index.html 을 돌려주고,
 * 클라이언트는 그걸 "AI 서버 없음" 으로 판단해 조용히 폴백한다.
 * 즉 아저씨가 등장은 하는데 말을 못 하는 상태가 에러 없이 만들어진다.
 */

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("사용법: node scripts/verify-deploy.mjs <배포주소>");
  process.exit(2);
}

const pass = (m) => console.log(`  ✅ ${m}`);
const fail = (m, hint) => {
  console.log(`  ❌ ${m}`);
  if (hint) console.log(`     → ${hint}`);
  failures++;
};
let failures = 0;

const body = {
  mode: "chat",
  memoryBlock: "<기억>\n비어 있음. 이 사용자와는 초면이다.\n</기억>",
  messages: [{ role: "user", content: "안녕하세요" }],
};

console.log(`\n대상: ${base}\n`);

// ── 1. 정적 페이지 ────────────────────────────────────────────
console.log("1. 앱이 떠 있는가");
try {
  const res = await fetch(base);
  if (res.ok) pass(`HTTP ${res.status}`);
  else fail(`HTTP ${res.status}`, "Pages 빌드가 성공했는지 확인하세요.");
} catch (e) {
  fail(`연결 실패: ${e.message}`, "주소가 맞는지 확인하세요.");
}

// ── 2. 함수가 잡히는가 ────────────────────────────────────────
console.log("\n2. /api/chat 이 함수로 라우팅되는가");
let res;
try {
  res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
} catch (e) {
  fail(`요청 실패: ${e.message}`);
  process.exit(1);
}

const ct = res.headers.get("content-type") ?? "";

if (ct.includes("text/html")) {
  fail("HTML 이 돌아옴 — 정적 파일이 함수를 가리고 있습니다",
    "functions/ 디렉터리가 배포에 포함됐는지, _redirects 의 /* 규칙이 /api 를 삼키는지 확인하세요.");
  process.exit(1);
}

if (res.status === 503) {
  const j = await res.json().catch(() => ({}));
  if (j.error === "budget_exhausted") {
    pass("함수는 정상 — 다만 오늘 예산이 소진됐습니다");
    console.log(`     서버 응답: "${j.message}"`);
    console.log("     DAILY_BUDGET_USD 를 올리거나 내일 다시 확인하세요.");
    process.exit(0);
  }
  fail("503 — ANTHROPIC_API_KEY 가 등록되지 않았습니다",
    "Cloudflare Pages → Settings → Environment variables 에 Secret 으로 등록하세요.");
  process.exit(1);
}

if (!ct.includes("text/event-stream")) {
  fail(`예상치 못한 content-type: ${ct || "(없음)"}`, `HTTP ${res.status}`);
  process.exit(1);
}
pass("SSE 스트림 응답");

// ── 3. 실제로 말을 하는가 ─────────────────────────────────────
console.log("\n3. 아저씨가 실제로 대답하는가");
let reply = "";
let streamError = null;

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = "";
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const chunks = buf.split("\n\n");
  buf = chunks.pop() ?? "";
  for (const chunk of chunks) {
    let event = "message", data = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;
    let p;
    try { p = JSON.parse(data); } catch { continue; }
    if (event === "delta" && p.text) reply += p.text;
    else if (event === "error") streamError = p.message;
  }
}

if (streamError) {
  fail(`스트림 오류: ${streamError}`, "Cloudflare 실시간 로그(Functions → Real-time logs)를 확인하세요.");
} else if (!reply.trim()) {
  fail("응답이 비어 있음", "API 키가 유효한지, 크레딧이 남아 있는지 확인하세요.");
} else {
  pass(`응답 ${reply.length}자 수신`);
  console.log(`\n     ┌─ 아저씨 ─────────────────`);
  reply.trim().split("\n").forEach((l) => console.log(`     │ ${l}`));
  console.log(`     └──────────────────────────`);

  // 캐릭터가 유지되는지 — 프롬프트가 먹히는지 눈으로 볼 수 있게
  const notes = [];
  if (reply.length > 200) notes.push("응답이 깁니다 (아저씨는 1~3문장이어야 함)");
  if (/[#*`]|^- /m.test(reply)) notes.push("마크다운이 섞였습니다");
  if (/힘내|화이팅|파이팅/.test(reply)) notes.push("상투적 위로가 나왔습니다");
  if (notes.length) {
    console.log("\n  ⚠️  말투 점검:");
    notes.forEach((n) => console.log(`     - ${n}`));
    console.log("     → src/lib/npcPrompt.ts 의 말투 규칙을 조이거나 모델을 바꿔보세요.");
  }
}

// ── 4. 예산 차단기 ────────────────────────────────────────────
console.log("\n4. 일일 예산 차단기");
console.log("     KV 바인딩 여부는 외부에서 알 수 없습니다.");
console.log("     Cloudflare → Functions → Real-time logs 에서");
console.log('     "BUDGET_KV 미바인딩" 경고가 뜨는지 확인하세요.');
console.log("     경고가 뜨면 상한이 걸려 있지 않은 상태입니다.");

console.log(failures ? `\n실패 ${failures}건\n` : "\n통과 — 배포 정상\n");
process.exit(failures ? 1 : 0);
