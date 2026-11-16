export function authMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    supabase_not_configured: "Supabase 연결 설정이 필요합니다.",
    invalid_credentials: "이메일 또는 비밀번호를 확인해 주세요.",
    email_not_confirmed: "이메일의 가입 확인 링크를 먼저 눌러 주세요.",
    user_already_exists: "이미 가입한 이메일입니다. 로그인해 주세요.",
    email_exists: "이미 가입한 이메일입니다. 로그인해 주세요.",
    weak_password: "더 안전한 비밀번호를 입력해 주세요.",
    validation_failed: "입력한 이메일과 비밀번호를 확인해 주세요.",
    signup_disabled: "현재 회원가입을 사용할 수 없습니다.",
    provider_disabled: "이 로그인 방식이 아직 활성화되지 않았습니다.",
    over_request_rate_limit: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    over_email_send_rate_limit: "이메일 전송이 많습니다. 잠시 후 다시 시도해 주세요.",
    email_address_not_authorized: "개발용 이메일 발송이 제한되어 있습니다. Supabase의 SMTP 설정을 확인해 주세요.",
    flow_state_not_found: "인증을 요청했던 브라우저에서 링크를 열거나 다시 요청해 주세요.",
    flow_state_expired: "인증 링크가 만료되었습니다. 다시 요청해 주세요.",
    otp_expired: "인증 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.",
    same_password: "기존과 다른 비밀번호를 입력해 주세요.",
  };
  return messages[code] ?? "로그인 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}
