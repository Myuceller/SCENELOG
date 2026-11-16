export type AuthMode = "login" | "signup";
export type AuthField = "email" | "password" | "passwordConfirm";
export type AuthValues = Record<AuthField, string>;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "이메일을 입력해 주세요.";
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 주소를 입력해 주세요.";
}

export function validateAuthForm(mode: AuthMode, values: AuthValues): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password) errors.password = "비밀번호를 입력해 주세요.";
  else if (mode === "signup" && values.password.length < 8) errors.password = "비밀번호는 8자 이상으로 입력해 주세요.";
  else if (values.password.length > 128) errors.password = "비밀번호는 128자 이하로 입력해 주세요.";
  if (mode === "signup") {
    if (!values.passwordConfirm) errors.passwordConfirm = "비밀번호를 한 번 더 입력해 주세요.";
    else if (values.password !== values.passwordConfirm) errors.passwordConfirm = "비밀번호가 일치하지 않아요.";
  }
  return errors;
}
