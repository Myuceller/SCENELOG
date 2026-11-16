import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";
import type { ArchiveResponse, ArchiveWrite } from "@/types/archive";

export async function requestArchive(userId: string, signal: AbortSignal, body?: ArchiveWrite): Promise<ArchiveResponse> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw new Error(authMessage(error));
  if (!data.session || data.session.user.id !== userId) throw new Error("다시 로그인해 주세요.");
  const token = data.session.access_token;
  const response = await fetch("/api/archive", {
    method: body ? "PUT" : "GET", cache: "no-store", signal,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "기록 저장소에 연결하지 못했습니다.");
  }
  return response.json();
}
