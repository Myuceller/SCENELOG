import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { authenticate } from "@/server/auth/authenticate";
import { ApiError, errorResponse } from "@/server/http/errors";
import { replaceAvatar } from "@/server/social/repository";
import { AVATAR_BUCKET, getStorageAdmin } from "@/server/supabase/storage";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

async function readImage(request: Request): Promise<Buffer> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new ApiError(415, "IMAGE_REQUIRED", "사진 파일을 선택해 주세요.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "IMAGE_REQUIRED", "사진 파일을 선택해 주세요.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_FILE_BYTES + 16_384) { await reader.cancel(); throw new ApiError(413, "IMAGE_TOO_LARGE", "3MB 이하의 사진을 선택해 주세요."); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new ApiError(400, "IMAGE_REQUIRED", "사진 파일을 선택해 주세요.");
    if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "IMAGE_TOO_LARGE", "3MB 이하의 사진을 선택해 주세요.");
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new ApiError(415, "IMAGE_FORMAT", "JPG, PNG, WebP 형식의 정지 사진을 선택해 주세요.");
    // Normalize orientation, crop centrally, strip metadata, and store only the small derivative.
    return await image.rotate().resize(384, 384, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_IMAGE", "사진을 읽지 못했습니다. 다른 JPG, PNG, WebP 사진을 선택해 주세요.");
  } finally { reader.releaseLock(); }
}

async function removeOld(uid: string, path: string | null) {
  if (!path || !path.startsWith(`${uid}/`)) return;
  try {
    const { error } = await getStorageAdmin().from(AVATAR_BUCKET).remove([path]);
    if (error) console.warn("Old profile image cleanup deferred.");
  } catch { console.warn("Old profile image cleanup deferred."); }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(request);
    const bytes = await readImage(request);
    const storage = getStorageAdmin().from(AVATAR_BUCKET);
    const path = `${user.id}/${randomUUID()}.webp`;
    const { error } = await storage.upload(path, bytes, { contentType: "image/webp", cacheControl: "3600", upsert: false });
    if (error) throw new ApiError(503, "IMAGE_UPLOAD_FAILED", "사진을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    let result;
    try { result = await replaceAvatar(user, path); }
    catch (error) { await removeOld(user.id, path); throw error; }
    await removeOld(user.id, result.previousPath);
    return Response.json(result.profile, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await authenticate(request);
    const result = await replaceAvatar(user, null);
    await removeOld(user.id, result.previousPath);
    return Response.json(result.profile, { headers });
  } catch (error) { return errorResponse(error); }
}
