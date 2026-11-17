import { loadEnvConfig } from "@next/env";
import { AVATAR_BUCKET, getStorageAdmin } from "../src/server/supabase/storage";

loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
async function main() {
  const storage = getStorageAdmin();
  const { data: buckets, error } = await storage.listBuckets();
  if (error) throw new Error("Storage access failed");
  const existing = buckets.find(bucket => bucket.id === AVATAR_BUCKET);
  if (existing) {
    if (!existing.public) throw new Error("Existing avatar bucket is not public");
    console.log("프로필 사진 버킷이 준비되어 있습니다."); return;
  }
  const created = await storage.createBucket(AVATAR_BUCKET, { public: true, allowedMimeTypes: ["image/webp"], fileSizeLimit: 1_048_576 });
  if (created.error) throw new Error("Bucket creation failed");
  console.log("프로필 사진 전용 버킷을 만들었습니다. 업로드·삭제는 서버에서만 처리합니다.");
}
main().catch(() => { console.error("프로필 사진 저장소 준비 실패. Supabase 관리자 키와 Storage 설정을 확인하세요."); process.exitCode = 1; });
