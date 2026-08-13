import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 대시보드에서 주소를 복사할 때 `/rest/v1/` 까지 딸려오는 일이 잦다.
 * 그대로 두면 supabase-js 가 뒤에 `/rest/v1` 을 또 붙여서
 * `/rest/v1//rest/v1/cups` 로 나가고, 게이트웨이가
 * "Invalid path specified in request URL" 을 돌려준다.
 * 원인을 알아채기 어려운 에러라 여기서 미리 잘라낸다.
 */
function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  // .../rest/v1, .../auth/v1 처럼 서비스 경로가 붙어 온 경우 잘라낸다
  const cleaned = trimmed.replace(/\/(rest|auth|realtime|storage|functions)\/v\d+$/, "");
  if (cleaned !== trimmed) {
    console.warn(
      `[탕비실] VITE_SUPABASE_URL 에 경로가 붙어 있어 잘라냈습니다: ${raw} → ${cleaned}`,
    );
  }
  return cleaned;
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** true when Supabase is not configured — app runs with local demo data */
export const isDemoMode = !url || !key;

export let supabase: SupabaseClient | null = null;

if (!isDemoMode) {
  supabase = createClient(url!, key!);
}
