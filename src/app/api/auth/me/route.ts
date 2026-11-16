import { authenticate } from "@/server/auth/authenticate";
import { errorResponse } from "@/server/http/errors";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    return Response.json({ user: { id: user.id, email: user.email ?? null, displayName: user.user_metadata?.full_name ?? null } }, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
  } catch (error) { return errorResponse(error); }
}
