import assert from "node:assert/strict";
import { test } from "node:test";
import { createJournal, isFilmJournal, journalStampLogs, addJournalItem, updateJournalItem, moveJournalItem, exportPages, placeOnSpread, spreadItems, itemsForPage, type JournalItem } from "../src/lib/journal-model";
import { createSeedState, validState, type FilmLog } from "../src/lib/scene-model";

const log = (id: string, movieId: string, watchedOn: string, extra: Partial<FilmLog> = {}): FilmLog => ({ id, movieId, watchedOn, userId: "guma", rating: 4.5, createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false, ...extra });
const stamp: JournalItem = { id: "stamp", kind: "stamp", movieId: "film", logId: "record", x: .1, y: .1, width: .35, rotation: 5 };

test("연도별 우표는 해당 관람 연도의 영화별 최신 기록을 쓰며 계정과 미정 날짜를 섞지 않는다", () => {
  const logs = [log("2025", "a", "2025-12-30", { createdAt: "2025-12-31T00:00:00Z" }), log("2026", "a", "2026-01-03"), log("unknown", "b", ""), log("friend", "c", "2025-11-01", { userId: "momo" })];
  assert.deepEqual(journalStampLogs(logs, "guma", 2025).map(log => log.id), ["2025"]);
  assert.deepEqual(journalStampLogs(logs, "guma", 2026).map(log => log.id), ["2026"]);
  assert.equal(journalStampLogs(logs, "guma").length, 2);
});

test("다이어리는 연도별 별도 책이며 JSON 저장 후 위치·회전·문장·종이가 보존된다", () => {
  let id = 0; const book = createJournal(2026, () => `page-${id++}`);
  assert.equal(new Set(book.pages.map(page => page.id)).size, 4);
  const decorated = addJournalItem(book, book.pages[1].id, stamp);
  decorated.pages[1].paper = "grid";
  const state = createSeedState(); state.journals = { guma: { "2026": decorated, "2025": createJournal(2025) }, momo: { "2026": createJournal(2026) } };
  const restored = JSON.parse(JSON.stringify(state));
  assert.ok(validState(restored)); assert.ok(restored.journals?.guma && restored.journals.momo); assert.ok(isFilmJournal(restored.journals.guma["2026"]));
  assert.deepEqual(restored.journals.guma["2026"].pages[1].items[0], stamp);
  assert.equal(restored.journals.guma["2025"].pages[1].items.length, 0);
  assert.equal(restored.journals.momo["2026"].pages[1].items.length, 0);
});

test("가운데 선을 넘은 조각은 오른쪽 소유로 옮겨도 양쪽 종이에 같은 위치로 그려진다", () => {
  const book = createJournal(2026);
  const crossed = placeOnSpread(book, 0, { ...stamp, x: .9, width: .4 });
  assert.equal(crossed.pages[0].items.length, 0);
  assert.equal(crossed.pages[1].items.length, 1);
  assert.ok(Math.abs(crossed.pages[1].items[0].x + .1) < .0001);
  assert.equal(spreadItems(crossed, 0)[0].x, .9);
  assert.equal(itemsForPage(crossed, 0)[0].x, .9);
  assert.ok(Math.abs(itemsForPage(crossed, 1)[0].x + .1) < .0001);
  const returned = placeOnSpread(crossed, 0, { ...spreadItems(crossed, 0)[0], x: .2 });
  assert.equal(returned.pages[0].items.length, 1);
  assert.equal(returned.pages[1].items.length, 0);
  assert.equal(book.pages[0].items.length, 0);
});

test("사진 자르기와 자유 오리기·그림·텍스트 크기와 정렬이 저장 후 유지된다", () => {
  let book = createJournal(2026);
  const photo: JournalItem = { id: "photo", kind: "photo", x: .8, y: .1, width: .7, height: .4, rotation: 0, assetId: "blob-id", crop: { x: .1, y: .2, width: .7, height: .6 }, cutout: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: .5, y: 1 }] };
  book = placeOnSpread(book, 0, photo);
  book = placeOnSpread(book, 0, { id: "ink", kind: "drawing", x: .9, y: .6, width: .6, height: .1, rotation: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: "#e84b29", penWidth: 4 });
  book = placeOnSpread(book, 0, { id: "text", kind: "text", x: .2, y: .1, width: 1.2, height: .12, rotation: 0, text: "두 페이지의 문장", font: "gaegu", fontSize: 26, align: "center" });
  const restored = JSON.parse(JSON.stringify(book));
  assert.ok(isFilmJournal(restored));
  const items = spreadItems(restored, 0);
  assert.deepEqual(items.find(item => item.id === "photo")?.crop, photo.crop);
  assert.deepEqual(items.find(item => item.id === "photo")?.cutout, photo.cutout);
  assert.equal(items.find(item => item.id === "text")?.align, "center");
  assert.equal(items.find(item => item.id === "text")?.height, .12);
  assert.equal(items.find(item => item.id === "ink")?.points?.length, 2);
});

test("우표를 페이지 밖으로 끌어도 다시 선택할 수 있는 범위에 남는다", () => {
  const moved = moveJournalItem(stamp, 1.5, -2);
  assert.equal(moved.x, .65); assert.equal(moved.y, 0);
  const bottom = moveJournalItem(stamp, .5, 9);
  assert.ok(bottom.y > .5 && bottom.y < .6);
  assert.deepEqual({ x: stamp.x, y: stamp.y }, { x: .1, y: .1 });
});

test("조각 수정은 대상 페이지만 바꾸며 실행 취소용 이전 책은 보존한다", () => {
  const original = createJournal(2026);
  const decorated = addJournalItem(original, original.pages[0].id, stamp);
  const updated = updateJournalItem(decorated, original.pages[0].id, stamp.id, { width: .5, rotation: -15 });
  assert.equal(original.pages[0].items.length, 0);
  assert.equal(decorated.pages[0].items[0].width, .35);
  assert.equal(updated.pages[0].items[0].width, .5);
  assert.equal(updated.pages[0].items[0].rotation, -15);
  assert.equal(updated.pages[1].items.length, 0);
});

test("영상은 빈 펼침면만 건너뛰며 꾸민 페이지의 맞은편 빈 종이와 순서는 유지한다", () => {
  const book = createJournal(2026);
  const decorated = addJournalItem(book, book.pages[3].id, stamp);
  assert.deepEqual(exportPages(decorated).map(page => page.id), [book.pages[2].id, book.pages[3].id]);
  assert.equal(exportPages(book).length, 0);
  assert.equal(exportPages(book, false).length, 4);
});

test("잘못된 다이어리 조각을 읽지 않으며 기존 다이어리 없는 기록도 유효하다", () => {
  const book = addJournalItem(createJournal(2026), "missing", stamp);
  assert.ok(isFilmJournal(book));
  assert.equal(isFilmJournal({ ...book, pages: [{ id: "x", paper: "grid", items: [{ ...stamp, x: NaN }] }] }), false);
  assert.ok(validState(createSeedState()));
});
