import type { JournalItem } from "./journal-model";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("scenelog-journal-assets", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("사진 저장 공간을 열지 못했어요."));
  });
}
export async function readJournalPhoto(id: string): Promise<Blob> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("photos", "readonly"), request = transaction.objectStore("photos").get(id);
    transaction.oncomplete = () => db.close();
    request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("저장한 사진을 찾지 못했어요. 원본 사진을 다시 붙여주세요."));
    request.onerror = () => { db.close(); reject(new Error("사진을 읽지 못했어요.")); };
  });
}
export function decodeJournalPhoto(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("사진을 열지 못했어요. JPG, PNG, WebP 파일을 골라주세요.")); };
    image.src = url;
  });
}
export async function importJournalPhoto(file: File) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("JPG, PNG, WebP, GIF 사진을 골라주세요. GIF는 한 장의 사진으로 붙여요.");
  if (file.size > 25 * 1024 * 1024) throw new Error("25MB 이하의 사진을 골라주세요.");
  const image = await decodeJournalPhoto(file), ratio = Math.min(1, 1800 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("사진을 저장하지 못했어요.")), file.type === "image/jpeg" ? "image/jpeg" : "image/webp", .9));
  const id = crypto.randomUUID(), db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("photos", "readwrite"); transaction.objectStore("photos").put(blob, id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error("사진을 저장할 공간이 부족해요. 브라우저 저장 공간을 확인해 주세요.")); };
  });
  return { id, width: canvas.width, height: canvas.height };
}
const cache = new Map<string, Promise<HTMLImageElement>>();
export async function loadJournalPhotos(items: JournalItem[]) {
  return new Map(await Promise.all([...new Set(items.flatMap(item => item.assetId ? [item.assetId] : []))].map(async id => {
    if (!cache.has(id)) cache.set(id, readJournalPhoto(id).then(decodeJournalPhoto).catch(error => { cache.delete(id); throw error; }));
    return [id, await cache.get(id)!] as const;
  })));
}
export async function journalPhotoBackup(ids: string[]) {
  return Object.fromEntries(await Promise.all([...new Set(ids)].map(async id => {
    const blob = await readJournalPhoto(id);
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
    return [id, data];
  })));
}
