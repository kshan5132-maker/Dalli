const ERROR_MAP: [string, string][] = [
  ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않습니다.'],
  ['Email not confirmed', '이메일 인증이 필요합니다. 가입 시 입력한 이메일의 인증 링크를 확인해주세요.'],
  ['User already registered', '이미 가입된 이메일입니다.'],
  ['Password should be at least 6 characters', '비밀번호는 6자 이상이어야 합니다.'],
  ['Unable to validate email address: invalid format', '올바른 이메일 형식이 아닙니다.'],
  ['Signup requires a valid password', '유효한 비밀번호를 입력해주세요.'],
  ['Email rate limit exceeded', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'],
  ['For security purposes, you can only request this after', '보안을 위해 잠시 후 다시 시도해주세요.'],
  ['New password should be different from the old password', '새 비밀번호는 이전 비밀번호와 달라야 합니다.'],
  ['JWT expired', '로그인이 만료되었습니다. 다시 로그인해주세요.'],
  ['permission denied for table', '접근 권한이 없습니다. 데이터베이스 설정을 확인해주세요.'],
  ['relation "public.', '데이터베이스 테이블이 없습니다. schema_v3.sql을 실행해주세요.'],
  ['relation does not exist', '데이터베이스 설정이 필요합니다. schema_v3.sql을 실행해주세요.'],
  ['violates row-level security', '접근 권한이 없습니다. RLS 정책을 확인해주세요.'],
  ['PGRST301', '데이터베이스 연결에 실패했습니다.'],
  ['FetchError', '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.'],
  ['email address', '이메일 주소를 확인해주세요.'],
  ['rate limit', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'],
  ['network', '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'],
  ['fetch', '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'],
  ['timeout', '요청 시간이 초과되었습니다. 다시 시도해주세요.'],
  ['TIMEOUT', '요청 시간이 초과되었습니다. 다시 시도해주세요.'],
]

export function translateError(message: string): string {
  if (!message) return '알 수 없는 오류가 발생했습니다.'

  const lower = message.toLowerCase()
  for (const [key, value] of ERROR_MAP) {
    if (lower.includes(key.toLowerCase())) return value
  }

  return `오류가 발생했습니다: ${message}`
}
