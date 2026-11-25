import type { JournalFont, JournalItem } from "./journal-model";
import { uiFontFamily } from "./ui-font";
export const journalFonts: { id: JournalFont; name: string; family: string }[] = [
  { id: "sans", name: "프리텐다드 · 담백한 고딕", family: uiFontFamily },
  { id: "gowun", name: "고운바탕 · 단정한 명조", family: '"Journal Gowun", serif' },
  { id: "gaegu", name: "개구 · 동글동글 손글씨", family: '"Journal Gaegu", cursive' },
  { id: "pen", name: "나눔손글씨 펜 · 가벼운 필기", family: '"Journal Pen", cursive' },
  { id: "jua", name: "주아 · 또렷한 제목", family: '"Journal Jua", sans-serif' },
  { id: "serif", name: "클래식 · 기본 명조", family: 'Georgia, "Batang", serif' },
];
export const journalFontFamily = (id?: JournalFont) => journalFonts.find(font => font.id === id)?.family ?? journalFonts[0].family;
export async function loadJournalFonts(items: JournalItem[]) {
  const textByFont = new Map<JournalFont, string>();
  for (const item of items) {
    if (item.kind !== "text") continue;
    const font = item.font ?? "sans";
    textByFont.set(font, (textByFont.get(font) ?? "") + (item.text ?? ""));
  }
  await Promise.all([...textByFont].map(([font, text]) => document.fonts.load(`24px ${journalFontFamily(font)}`, text)));
}
