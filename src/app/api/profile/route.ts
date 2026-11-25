import { authenticate } from "@/server/auth/authenticate";
import { errorResponse } from "@/server/http/errors";
import { readOwnProfile } from "@/server/social/repository";
import { ServerTiming } from "@/server/http/server-timing";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const timing = new ServerTiming();
  try {
    const user = await timing.measure("auth", () => authenticate(request));
    const profile = await timing.measure("profile", () => readOwnProfile(user, timing));
    return timing.finish(timing.measureSync("serialize", () => Response.json(profile, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } })));
  } catch (error) { return timing.finish(errorResponse(error)); }
}
