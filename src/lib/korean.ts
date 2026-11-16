/** True when the last Hangul syllable of the word has a final consonant (받침). Non-Hangul endings count as none. */
export function hasFinalConsonant(word: string) {
  const last = [...word.trim()].pop();
  if (!last) return false;
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/** Attach the right particle: josa("드라마", "은", "는") -> "드라마는". */
export function josa(word: string, withFinal: string, withoutFinal: string) {
  return word + (hasFinalConsonant(word) ? withFinal : withoutFinal);
}
