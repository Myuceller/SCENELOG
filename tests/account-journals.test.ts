import assert from "node:assert/strict";
import test from "node:test";
import { createAccountJournalStore, journalStorageKey } from "../src/lib/account-journals";
import { createJournal } from "../src/lib/journal-model";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("journals ignore demo storage and remain isolated across sign-ins", () => {
  const storage = memoryStorage();
  storage.setItem("scenelog.archive.v1", JSON.stringify({ userId: "gamja", journals: { gamja: { 2026: createJournal(2026) } } }));
  const first = createAccountJournalStore("account-one", () => storage);
  assert.deepEqual(first.getSnapshot().books, {});
  assert.equal(first.save(createJournal(2026)), true);
  const second = createAccountJournalStore("account-two", () => storage);
  assert.deepEqual(second.getSnapshot().books, {});
  const signedBackIn = createAccountJournalStore("account-one", () => storage);
  assert.equal(signedBackIn.getSnapshot().books[2026].year, 2026);
});

test("unreadable journals and failed writes do not report successful persistence", () => {
  const storage = memoryStorage();
  storage.setItem(journalStorageKey("account-one"), "broken");
  const store = createAccountJournalStore("account-one", () => storage);
  assert.equal(store.getSnapshot().storageError, true);
  assert.equal(store.save(createJournal(2026)), false);
  assert.equal(storage.getItem(journalStorageKey("account-one")), "broken");
  const unavailable = createAccountJournalStore("account-two", () => ({ getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } }));
  assert.equal(unavailable.save(createJournal(2026)), false);
  assert.deepEqual(unavailable.getSnapshot().books, {});
});
