/**
 * npcClient.ts — /api/chat 호출 래퍼
 *
 * API 키는 서버 함수에만 있다. 여기서는 절대 다루지 않는다.
 * 대화는 SSE 스트리밍으로 받아 한 글자씩 흘려보낸다.
 */
import type { MemoryUpdate } from "./npcMemory";

export type Turn = { role: "user" | "assistant"; content: string };

/** 서버 함수가 없는 환경(정적 호스팅, vite dev)에서 안내할 문구 */
const OFFLINE_NOTICE =
  "…(아저씨가 입을 벙긋거리는데 소리가 안 들린다. AI 서버가 연결되지 않았다.)";

export type StreamResult =
  | { ok: true }
  | { ok: false; kind: "offline" | "budget" | "error"; message: string };

/**
 * NPC 와 한 턴 주고받는다. 텍스트 델타가 올 때마다 onDelta 가 불린다.
 */
export async function streamChat(opts: {
  memoryBlock: string;
  messages: Turn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "chat",
        memoryBlock: opts.memoryBlock,
        messages: opts.messages,
      }),
      signal: opts.signal,
    });
  } catch {
    return { ok: false, kind: "offline", message: OFFLINE_NOTICE };
  }

  // 정적 호스팅이면 /api/chat 이 index.html 을 돌려준다 — SSE 가 아니면 오프라인 취급
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("text/event-stream")) {
    if (res.status === 503) {
      const body = await res.json().catch(() => null) as { message?: string } | null;
      const message = body?.message ?? "오늘 아저씨 일찍 퇴근했다.";
      // 예산 소진과 미설정을 구분한다
      const kind = (body as { error?: string } | null)?.error === "budget_exhausted" ? "budget" : "offline";
      return { ok: false, kind, message: kind === "offline" ? OFFLINE_NOTICE : message };
    }
    if (!contentType.includes("application/json")) {
      return { ok: false, kind: "offline", message: OFFLINE_NOTICE };
    }
    return { ok: false, kind: "error", message: "…무슨 소린지 못 들었다. 다시 말해봐." };
  }

  if (!res.body) return { ok: false, kind: "offline", message: OFFLINE_NOTICE };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure: StreamResult | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 는 빈 줄로 이벤트를 구분한다
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        let event = "message";
        let data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;

        let payload: { text?: string; message?: string };
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }

        if (event === "delta" && payload.text) opts.onDelta(payload.text);
        else if (event === "error") {
          failure = { ok: false, kind: "error", message: payload.message ?? "…" };
        }
      }
    }
  } catch {
    // 사용자가 중단했거나 네트워크가 끊김 — 이미 받은 텍스트는 유효하다
    if (opts.signal?.aborted) return { ok: true };
    return { ok: false, kind: "error", message: "…연결이 끊겼다." };
  }

  return failure ?? { ok: true };
}

/**
 * 대화가 끝난 뒤 기억을 갱신한다.
 * 실패해도 조용히 넘긴다 — 요약이 없다고 게임이 멈추면 안 된다.
 */
export async function requestMemoryUpdate(opts: {
  memoryBlock: string;
  messages: Turn[];
}): Promise<MemoryUpdate | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "summarize",
        memoryBlock: opts.memoryBlock,
        messages: opts.messages,
      }),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) return null;

    const data = (await res.json()) as Partial<MemoryUpdate> & { error?: string };
    if (data.error || typeof data.profile !== "string" || typeof data.summary !== "string") {
      return null;
    }
    return {
      profile: data.profile,
      summary: data.summary,
      openLoops: Array.isArray(data.openLoops) ? data.openLoops : [],
      closedLoopIndexes: Array.isArray(data.closedLoopIndexes) ? data.closedLoopIndexes : [],
    };
  } catch {
    return null;
  }
}
