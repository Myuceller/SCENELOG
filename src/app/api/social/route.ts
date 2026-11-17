import { z } from "zod";
import { validateNickname } from "@/lib/profile-name";
import { authenticate } from "@/server/auth/authenticate";
import { ApiError, errorResponse } from "@/server/http/errors";
import { listSocial, readSocialProfile, saveFriendship, saveSocialProfile, readSocialSummary } from "@/server/social/repository";

export const runtime = "nodejs";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const querySchema = z.object({
  tab: z.enum(["feed", "discover", "friends", "incoming", "outgoing", "summary"]).default("friends"),
  q: z.string().trim().max(60).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  profile: id.optional(),
}).strict();
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(30).refine(value => !validateNickname(value)), collectionVisibility: z.enum(["private", "friends", "public"]) }).strict();
const friendshipSchema = z.object({ userId: id, action: z.enum(["request", "accept", "decline", "cancel", "remove"]) }).strict();
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_REQUEST", "입력 내용을 확인해 주세요.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new ApiError(413, "TOO_LARGE", "입력 내용이 너무 깁니다."); }
      chunks.push(value);
    }
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_REQUEST", "입력 내용을 확인해 주세요.");
  } finally { reader.releaseLock(); }
}

export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => params.getAll(key).length > 1)) throw new ApiError(400, "INVALID_QUERY", "검색 조건을 확인해 주세요.");
    const result = querySchema.safeParse(Object.fromEntries(params));
    if (!result.success) throw new ApiError(400, "INVALID_QUERY", "검색 조건을 확인해 주세요.");
    const { profile, tab, q, page } = result.data;
    return Response.json(profile ? await readSocialProfile(user, profile, page) : tab === "summary" ? await readSocialSummary(user) : await listSocial(user, tab, q, page), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await authenticate(request);
    const data = await readBody(request, profileSchema);
    return Response.json(await saveSocialProfile(user, data.displayName, data.collectionVisibility), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticate(request);
    const data = await readBody(request, friendshipSchema);
    return Response.json(await saveFriendship(user, data.userId, data.action), { headers });
  } catch (error) { return errorResponse(error); }
}
