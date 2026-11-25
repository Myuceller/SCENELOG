import assert from "node:assert/strict";
import { test } from "node:test";
import { loadJournalFonts } from "../src/lib/journal-fonts";
import { loadUiFont, uiFontFamily } from "../src/lib/ui-font";
import type { JournalItem } from "../src/lib/journal-model";

test("canvas exports await font ranges for actual user text, including rare characters", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const calls: { font: string; text: string }[] = [];
  const pending: (() => void)[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { fonts: {
    load(font: string, text: string) {
      calls.push({ font, text });
      return new Promise<void>(resolve => pending.push(resolve));
    },
  } } });
  try {
    const items = [
      { kind: "text", text: "뷁龘", font: "sans" },
      { kind: "text", text: "힣", font: "sans" },
      { kind: "text", text: "나의 기록", font: "gowun" },
      { kind: "stamp", movieId: "movie" },
    ] as JournalItem[];
    let finished = false;
    const loading = loadJournalFonts(items).then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false);
    assert.equal(calls.length, 2);
    assert.ok(calls.some(call => call.font.includes("SceneLog Sans") && call.text.includes("뷁龘") && call.text.includes("힣")));
    assert.ok(calls.some(call => call.font.includes("Journal Gowun") && call.text === "나의 기록"));
    pending.forEach(resolve => resolve());
    await loading;
    assert.equal(finished, true);
    const cover = loadUiFont("나의 龘 다이어리");
    assert.deepEqual(calls.at(-1), { font: `400 24px ${uiFontFamily}`, text: "나의 龘 다이어리" });
    pending.at(-1)!();
    await cover;
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
