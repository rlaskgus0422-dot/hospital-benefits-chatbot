import { createClient } from "@supabase/supabase-js";

// 서버에서만 쓰는 관리자 키(SUPABASE_SERVICE_ROLE_KEY)로 접속한다 — RLS를 우회하므로
// 절대 클라이언트(브라우저) 코드에 노출하면 안 된다. 이 파일은 Route Handler·서버 컴포넌트에서만 import한다.
export function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const DOCUMENTS_BUCKET = "regulation-documents";
