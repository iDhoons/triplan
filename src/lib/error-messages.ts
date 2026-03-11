const ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다",
  "Email not confirmed": "이메일 인증이 필요합니다. 메일함을 확인해주세요",
  "User already registered": "이미 가입된 이메일입니다",
  "Password should be at least 6 characters":
    "비밀번호는 6자 이상이어야 합니다",
  "Email rate limit exceeded":
    "너무 많은 요청입니다. 잠시 후 다시 시도해주세요",
  "Signup requires a valid password": "유효한 비밀번호를 입력해주세요",
  "For security purposes, you can only request this after 60 seconds.":
    "보안을 위해 60초 후에 다시 시도해주세요",
  "New password should be different from the old password.":
    "새 비밀번호는 기존 비밀번호와 달라야 합니다",
};

export function humanizeError(message: string): string {
  return ERROR_MAP[message] ?? message;
}
