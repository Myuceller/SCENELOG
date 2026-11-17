import { z } from "zod";
import { authenticate } from "@/server/auth/authenticate";
import { ApiError, errorResponse } from "@/server/http/errors";
import { searchAll } from "@/server/search/service";

export const runtime = "nodejs";
const schema = z.object({
  q: z.string().trim().min(1).max(60),
  category: z.enum(["all", "movie", "person", "user"]).default("all"),
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(500)).default(1),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    const params = new URL(request.url).searchParams;
    const parsed = schema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length > 1)) throw new ApiError(400, "INVALID_SEARCH", "검색어는 60자 이내로 입력해 주세요.");
    const { q, category, page } = parsed.data;
    return Response.json(await searchAll(user, q, category, page), { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
  } catch (error) { return errorResponse(error); }
}
