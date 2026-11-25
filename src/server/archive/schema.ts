import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/http/errors";

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const score = z.number().min(0).max(5).refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-8);
const movie = z.object({
  id, title: z.string().min(1).max(300), originalTitle: z.string().max(300),
  year: z.number().int().min(1800).max(2200).nullable(),
  genres: z.array(z.string().max(50)).max(30), rating: score.nullable(),
  poster: z.string().max(500).refine((value) => /^\/images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|svg|webp)$/.test(value) || /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(value)),
  description: z.string().max(10000), source: z.enum(["tmdb", "sample"]),
  director: z.string().max(1000).nullable(), runtime: z.number().int().min(0).max(100000).nullable(), detailLoaded: z.boolean(),
}).strict();
const log = z.object({
  id, movieId: id, rating: score.nullable(), watchedOn: z.union([z.literal(""), z.iso.date()]),
  review: z.string().max(5000), themes: z.object({ ost: score.optional(), visual: score.optional(), story: score.optional() }).strict(),
  tier: z.enum(["S", "A", "B", "C", "D"]).optional(), spoiler: z.boolean(), createdAt: z.iso.datetime({ offset: true }),
}).strict();
export const archiveSchema = z.object({
  logs: z.array(log), watchlist: z.array(id), catalog: z.array(movie),
}).strict().superRefine((archive, ctx) => {
  for (const ids of [archive.logs.map((item) => item.id), archive.watchlist, archive.catalog.map((item) => item.id)]) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "중복 항목" });
  }
  const catalogIds = new Set(archive.catalog.map((item) => item.id));
  if ([...archive.logs.map((item) => item.movieId), ...archive.watchlist].some((movieId) => !catalogIds.has(movieId))) {
    ctx.addIssue({ code: "custom", message: "영화 정보 누락" });
  }
});
export const writeSchema = z.object({ archive: archiveSchema, revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) }).strict();
export const recordSchema = z.object({ movie, log, revision: writeSchema.shape.revision }).strict()
  .refine((value) => value.movie.id === value.log.movieId, { message: "영화 정보 불일치" });
const watchlistSchema = z.discriminatedUnion("saved", [
  z.object({ saved: z.literal(true), movie, revision: writeSchema.shape.revision }).strict(),
  z.object({ saved: z.literal(false), movieId: id, revision: writeSchema.shape.revision }).strict(),
]);

// 전체 아카이브 교체 API의 요청 크기 제한입니다. DB 자체 용량 제한과는 무관합니다.
export const MAX_ARCHIVE_BYTES = 4_000_000;
export const MAX_RECORD_BYTES = 64_000;
export function readArchiveBody(request: Request) { return readJsonBody(request, writeSchema, MAX_ARCHIVE_BYTES); }
export function readRecordBody(request: Request) { return readJsonBody(request, recordSchema, MAX_RECORD_BYTES); }
export function readWatchlistBody(request: Request) { return readJsonBody(request, watchlistSchema, MAX_RECORD_BYTES); }
async function readJsonBody<T>(request: Request, schema: z.ZodType<T>, maxBytes: number): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_ARCHIVE", "기록 형식이 올바르지 않습니다.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "ARCHIVE_TOO_LARGE", "한 번에 전송할 수 있는 요청 크기를 초과했습니다. 기록을 나누어 전송해 주세요.");
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = schema.safeParse(body);
    if (!result.success) throw new ApiError(400, "INVALID_ARCHIVE", "기록 형식이 올바르지 않습니다. 입력값을 확인해 주세요.");
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_ARCHIVE", "기록 형식이 올바르지 않습니다.");
  } finally {
    reader.releaseLock();
  }
}
