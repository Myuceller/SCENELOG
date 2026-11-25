import "server-only";
import { authenticate } from "@/server/auth/authenticate";
import { ApiError, errorResponse } from "@/server/http/errors";
import { isAchievementId } from "@/lib/achievements";
import { achievementRepository } from "./repository";
import type { SocialActor } from "@/server/social/repository";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export function createAchievementHandlers(deps: { authenticate: (request: Request) => Promise<SocialActor>; repository: typeof achievementRepository } = { authenticate, repository: achievementRepository }) {
  return {
    async GET(request: Request) {
      try { return Response.json(await deps.repository.read(await deps.authenticate(request)), { headers }); }
      catch (error) { return errorResponse(error); }
    },
    async PUT(request: Request) {
      try {
        const user = await deps.authenticate(request);
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
        const reader = request.body?.getReader();
        if (!reader) throw new ApiError(400, "INVALID_REQUEST", "칭호를 선택해 주세요.");
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 1024) { await reader.cancel(); throw new ApiError(413, "TOO_LARGE", "요청이 너무 큽니다."); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        let data: unknown;
        try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { throw new ApiError(400, "INVALID_REQUEST", "칭호를 선택해 주세요."); }
        if (!data || typeof data !== "object" || Object.keys(data).length !== 1 || !("titleId" in data) || !isAchievementId(data.titleId)) {
          throw new ApiError(400, "INVALID_TITLE", "올바른 칭호를 선택해 주세요.");
        }
        return Response.json(await deps.repository.equip(user, data.titleId), { headers });
      } catch (error) { return errorResponse(error); }
    },
  };
}
