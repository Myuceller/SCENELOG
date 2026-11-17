export function validateNickname(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "닉네임을 입력해 주세요.";
  if (name.length > 30) return "닉네임은 30자 이하로 입력해 주세요.";
  if (/[\u0000-\u001f\u007f]/.test(name)) return "닉네임에 사용할 수 없는 문자가 있어요.";
}

export function initialProfileName(userId: string, nickname: unknown): string {
  return typeof nickname === "string" && !validateNickname(nickname) ? nickname.trim() : `영화친구 ${userId.slice(0, 8)}`;
}
