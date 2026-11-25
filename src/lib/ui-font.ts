/** OFL-compliant family name for our subsets of Pretendard; glyphs are unchanged. */
export const uiFontFamily = '"SceneLog Sans", Arial, sans-serif';

/** Canvas text is not in the DOM, so explicitly load the ranges it will draw. */
export function loadUiFont(text: string) {
  return document.fonts.load(`400 24px ${uiFontFamily}`, text);
}
