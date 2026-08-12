/**
 * /api/chat — 흡연실 NPC AI 프록시 (Cloudflare Pages Function)
 *
 * API 키는 절대 브라우저로 나가지 않는다. 이 함수만 Anthropic 을 호출한다.
 *
 * 무상태 설계 —
 *   기억은 브라우저 localStorage 가 소유한다. 클라이언트가 매 요청마다
 *   기억 블록을 통째로 올려보내고, 이 함수는 그걸 프롬프트에 끼워 전달만 한다.
 *   따라서 서버에 DB 가 없다. (프로토타입 범위)
 *
 * 두 가지 모드:
 *   chat      — NPC 대화. SSE 스트리밍으로 텍스트 델타를 흘려보낸다.
 *   summarize — 대화 종료 후 기억 갱신. JSON 한 번에 반환 (싼 모델).
 *
 * 비용 안전장치:
 *   1. 일일 예산 차단기 — 오늘 누적 사용액이 상한을 넘으면 503 을 던진다.
 *      (BUDGET_KV 바인딩이 있을 때만 동작. 없으면 경고 후 통과)
 *   2. 요청당 입력 길이 상한 — 거대한 페이로드로 비용을 태우는 걸 막는다.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  CHARACTER_PROMPT,
  SUMMARIZE_PROMPT,
  MEMORY_SCHEMA,
  CRISIS_DIRECTIVE,
  looksLikeCrisis,
} from "../../src/lib/npcPrompt";

// ─── 환경 ────────────────────────────────────────────────────

interface Env {
  ANTHROPIC_API_KEY: string;
  /** 대화 모델 — 미설정 시 claude-sonnet-5 */
  NPC_MODEL?: string;
  /** 요약/기억갱신 모델 — 미설정 시 claude-haiku-4-5 */
  NPC_SUMMARY_MODEL?: string;
  /** 하루 총 사용액 상한 (USD). 미설정 시 5달러 */
  DAILY_BUDGET_USD?: string;
  /** 예산 카운터용 KV. 미바인딩이면 차단기 비활성 */
  BUDGET_KV?: KVNamespace;
}

// Pages Functions 타입 (@cloudflare/workers-types 없이 최소 정의)
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface PagesContext {
  request: Request;
  env: Env;
}

const DEFAULT_CHAT_MODEL = "claude-sonnet-5";
const DEFAULT_SUMMARY_MODEL = "claude-haiku-4-5";
const DEFAULT_DAILY_BUDGET_USD = 5;

/** 백만 토큰당 단가 (USD). 예산 차단기 계산용 — 정확한 청구액이 아니라 추정치다. */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

/** 한 요청에 실릴 수 있는 최대 문자 수 — 페이로드 폭탄 방지 */
const MAX_PAYLOAD_CHARS = 24_000;
/** 대화에 실어보낼 수 있는 최대 턴 수 */
const MAX_TURNS = 60;

// ─── 요청 타입 ───────────────────────────────────────────────

type Turn = { role: "user" | "assistant"; content: string };

type ChatBody = {
  mode: "chat";
  /** 브라우저가 보관 중인 기억 블록 (이미 텍스트로 조립된 상태) */
  memoryBlock: string;
  messages: Turn[];
};

type SummarizeBody = {
  mode: "summarize";
  memoryBlock: string;
  messages: Turn[];
};

type Body = ChatBody | SummarizeBody;

// ─── 유틸 ────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** 오늘 누적 사용액을 읽는다. KV 미바인딩이면 null */
async function readSpend(env: Env): Promise<number | null> {
  if (!env.BUDGET_KV) return null;
  const raw = await env.BUDGET_KV.get(`spend:${todayKey()}`);
  return raw ? Number(raw) || 0 : 0;
}

/** 사용량을 누적한다. 실패해도 응답을 막지 않는다. */
async function addSpend(env: Env, model: string, usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): Promise<void> {
  if (!env.BUDGET_KV) return;
  const p = PRICING[model] ?? PRICING[DEFAULT_CHAT_MODEL];
  const cost =
    ((usage.input_tokens ?? 0) * p.in +
      (usage.cache_read_input_tokens ?? 0) * p.in * 0.1 +
      (usage.cache_creation_input_tokens ?? 0) * p.in * 1.25 +
      (usage.output_tokens ?? 0) * p.out) /
    1_000_000;

  try {
    const key = `spend:${todayKey()}`;
    const prev = Number((await env.BUDGET_KV.get(key)) ?? 0) || 0;
    // 이틀치 TTL — 날짜가 바뀌면 새 키라서 자연히 리셋된다
    await env.BUDGET_KV.put(key, String(prev + cost), { expirationTtl: 60 * 60 * 48 });
  } catch (e) {
    console.warn("[탕비실] 예산 누적 실패:", e);
  }
}

function validate(body: unknown): { ok: true; body: Body } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "본문이 없습니다." };
  const b = body as Partial<Body>;
  if (b.mode !== "chat" && b.mode !== "summarize") return { ok: false, reason: "mode 가 잘못됐습니다." };
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, reason: "messages 가 비어 있습니다." };
  }
  if (b.messages.length > MAX_TURNS) return { ok: false, reason: "대화가 너무 깁니다." };
  for (const m of b.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return { ok: false, reason: "messages 형식이 잘못됐습니다." };
    }
  }
  const size = JSON.stringify(body).length;
  if (size > MAX_PAYLOAD_CHARS) return { ok: false, reason: "요청이 너무 큽니다." };
  return { ok: true, body: body as Body };
}

// ─── 핸들러 ──────────────────────────────────────────────────

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "server_unconfigured", message: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }, 503);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const v = validate(parsed);
  if (!v.ok) return json({ error: "bad_request", message: v.reason }, 400);
  const body = v.body;

  // ── 일일 예산 차단기 ──
  const budget = Number(env.DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD);
  const spent = await readSpend(env);
  if (spent === null) {
    console.warn("[탕비실] BUDGET_KV 미바인딩 — 일일 예산 차단기가 꺼져 있습니다.");
  } else if (spent >= budget) {
    // 세계관을 안 깨는 품절 응답
    return json(
      {
        error: "budget_exhausted",
        message: "오늘 아저씨 일찍 퇴근했다.",
      },
      503,
    );
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  return body.mode === "chat"
    ? handleChat(client, env, body)
    : handleSummarize(client, env, body);
}

// ─── 대화 (SSE 스트리밍) ─────────────────────────────────────

async function handleChat(client: Anthropic, env: Env, body: ChatBody): Promise<Response> {
  const model = env.NPC_MODEL ?? DEFAULT_CHAT_MODEL;

  // 위기 신호는 프롬프트 지시에만 맡기지 않는다 — 서버에서도 감지해서
  // 직전 턴에 시스템 지시를 덧붙인다 (2중 안전장치).
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const crisis = lastUser ? looksLikeCrisis(lastUser.content) : false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // 위기 감지 시 이번 턴에만 지시를 주입한다.
        // 시스템 프롬프트를 고쳐 쓰면 캐시된 접두부가 통째로 날아가므로,
        // 마지막 사용자 턴 끝에 붙인다. (role:"system" 메시지는 Sonnet 5 미지원)
        if (crisis) {
          const last = messages[messages.length - 1];
          if (last?.role === "user" && typeof last.content === "string") {
            last.content = `${last.content}\n\n<system-reminder>\n${CRISIS_DIRECTIVE}\n</system-reminder>`;
          }
        }

        const ms = client.messages.stream({
          model,
          max_tokens: 2048,
          // 캐릭터 프롬프트는 모든 유저에게 동일 → 캐시 대상.
          // 기억 블록은 유저마다 다르므로 캐시 경계 뒤에 둔다.
          system: [
            { type: "text", text: CHARACTER_PROMPT, cache_control: { type: "ephemeral" } },
            { type: "text", text: body.memoryBlock },
          ],
          // 잡담 상대라 깊은 추론이 필요 없다. effort 를 낮춰 지연·비용을 줄인다.
          // (thinking 을 끄는 대신 effort 를 내리는 쪽이 안전하다)
          output_config: { effort: "low" },
          messages,
        });

        ms.on("text", (delta) => send("delta", { text: delta }));

        const final = await ms.finalMessage();

        if (final.stop_reason === "refusal") {
          send("error", { message: "그 얘긴 하기 좀 그렇다." });
        }

        send("done", { stop_reason: final.stop_reason });
        await addSpend(env, model, final.usage);
      } catch (e) {
        const err = e as { status?: number; message?: string };
        console.error("[탕비실] chat 실패:", err.status, err.message);
        const message =
          err.status === 429
            ? "잠깐. 한 대 피우고 얘기하자."
            : "…무슨 소린지 못 들었다. 다시 말해봐.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

// ─── 기억 갱신 (구조화 출력) ─────────────────────────────────

async function handleSummarize(client: Anthropic, env: Env, body: SummarizeBody): Promise<Response> {
  const model = env.NPC_SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL;

  const transcript = body.messages
    .map((m) => `${m.role === "user" ? "사용자" : "아저씨"}: ${m.content}`)
    .join("\n");

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SUMMARIZE_PROMPT,
      output_config: { format: { type: "json_schema", schema: MEMORY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `<기존_기억>\n${body.memoryBlock}\n</기존_기억>\n\n<이번_대화>\n${transcript}\n</이번_대화>`,
        },
      ],
    });

    await addSpend(env, model, res.usage);

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return json({ error: "empty_response" }, 502);
    }
    return json(JSON.parse(block.text));
  } catch (e) {
    const err = e as { status?: number; message?: string };
    console.error("[탕비실] summarize 실패:", err.status, err.message);
    // 요약 실패는 치명적이지 않다 — 클라이언트가 기존 기억을 유지하면 된다.
    return json({ error: "summarize_failed" }, 502);
  }
}
