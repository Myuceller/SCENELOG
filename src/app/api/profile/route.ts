import { authenticate } from "@/server/auth/authenticate";
import { errorResponse } from "@/server/http/errors";
import { readOwnProfile } from "@/server/social/repository";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    return Response.json(await readOwnProfile(user), { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
  } catch (error) { return errorResponse(error); }
}
