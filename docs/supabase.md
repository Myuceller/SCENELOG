# Supabase 연결

SceneLog는 Supabase Auth로 로그인하고, Next.js API가 토큰을 검증한 뒤 Supabase PostgreSQL에 기록을 저장합니다. 브라우저는 DB에 직접 접근하지 않습니다. 서비스 계정 JSON, Supabase secret/service_role 키는 필요하지 않습니다.

## 1. 개발용 프로젝트와 환경변수

두 사람이 같은 개발 프로젝트를 사용합니다. `.env.example`을 참고해 각자의 `.env.local`에 입력하세요. 이미 있는 파일을 덮어쓰지 말고 TMDB 토큰을 유지합니다.

| 항목 | 가져오는 곳 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트의 API 설정 / Connect에서 Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API Keys의 `sb_publishable_...` 키 |
| `DATABASE_URL` | Connect → Session pooler → PostgreSQL URI |
| `DATABASE_MIGRATION_URL` | 별도 연결을 쓸 때만 설정. 기본은 비워 두기 |

DB URI의 `[YOUR-PASSWORD]`는 프로젝트 생성 시 지정한 **DB 비밀번호**로 바꿉니다. Supabase 로그인 비밀번호나 API 키가 아닙니다. 특수문자는 URL 인코딩해야 합니다. 연결 URI 끝에 `?sslmode=verify-full`을 붙입니다. 이미 query string이 있으면 `&sslmode=verify-full`을 사용하고 중복된 sslmode는 없앱니다. Supabase 호스트는 서버 코드가 공식 공개 CA(`src/server/db/supabase-ca.json`)를 사용해 인증서와 호스트를 검증합니다. 이 인증서는 비밀 키가 아니므로 Git으로 공유하며 친구가 별도로 내려받거나 절대 경로를 설정할 필요가 없습니다. Supabase CA가 교체되면 공식 대시보드 다운로드와 비교해 갱신합니다. 검증은 끄지 않습니다.

Session pooler는 IPv4에서도 연결할 수 있어 로컬 개발 기본값으로 사용합니다. 서버리스 배포 시 런타임은 Transaction pooler, 마이그레이션은 Session pooler 또는 direct connection으로 분리할 수 있습니다. 이 코드는 이름 있는 prepared statement를 사용하지 않습니다.

공개 URL·publishable key는 브라우저에서 사용됩니다. DB URL은 서버 전용 비밀이며 `NEXT_PUBLIC_`을 붙이지 않습니다. `.env.local`을 Git에 올리지 않습니다.

## 2. 로그인 설정

Authentication의 로그인 제공자 설정에서 Email을 활성화합니다. 최소 비밀번호 길이는 8자 이상을 권장합니다. 이메일 확인을 켠 상태를 지원하며, 가입 후 확인 메일 안내가 표시됩니다. 개발용 기본 메일 발송은 대상/빈도 제한이 있으므로 팀 외 계정으로 가입하려면 Custom SMTP 설정을 확인하세요.

Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`
- Redirect URLs: `http://localhost:3000/auth/reset-password`

다른 포트나 배포 도메인을 쓰면 같은 두 경로를 등록하고 운영 Site URL도 맞춥니다. 인증 링크는 가입·재설정을 요청한 브라우저에서 엽니다(PKCE의 브라우저별 검증값 사용).

Google 로그인은 별도 설정입니다. Supabase의 Google 제공자에 Google OAuth Client ID/Secret을 입력하고, Google Cloud의 승인된 리디렉션 URI에 **Supabase가 표시하는 callback URL**을 등록합니다. OAuth Secret은 Supabase 콘솔에만 넣습니다. Firebase에서 켰던 Google 로그인이 자동 이전되지는 않습니다.

## 3. 테이블 생성과 실행

```bash
npm ci
npm run db:setup
npm run dev
```

`db:setup`은 `.env.local`이 가리키는 DB에 SQL 마이그레이션을 적용합니다. 매번 DB를 설치하거나 켤 필요는 없습니다. 테이블은 `public`이 아닌 `scenelog` 스키마에 생성되므로 Table Editor에서 해당 스키마를 선택하세요. **Data API의 exposed schemas에 scenelog를 추가하지 않습니다.** RLS에는 브라우저 접근 정책을 두지 않고, Next.js의 DB 연결에서만 읽고 씁니다.

로그인 UI와 아카이브는 클라이언트 화면입니다. SDK가 브라우저 세션을 유지·갱신하고, Next API 요청에 access token을 Bearer로 보냅니다. 서버는 매 요청마다 `getUser(token)`으로 검증하며 브라우저의 사용자 ID를 신뢰하지 않습니다. 서버 렌더링 인증이 필요한 페이지는 별도 cookie/SSR 연동이 필요합니다. 로그아웃은 현재 브라우저 세션을 종료하며 이미 발급된 access token은 만료 시점까지 유효할 수 있습니다.

## 4. 친구의 개발 환경

친구를 Supabase 조직에 본인 계정으로 초대하고 필요한 프로젝트 권한을 부여합니다. 각자 저장소를 pull하고 `npm ci`, `.env.local` 설정, `npm run dev`를 실행합니다. 같은 프로젝트 URL과 개발 DB 연결 정보를 사용하면 같은 DB를 봅니다. DB 비밀번호는 신뢰할 수 있는 비밀 공유 수단으로 전달하며 Git/PR에 올리지 않습니다. 실제 이용자는 각자 로그인하고 자신의 기록만 접근합니다.

테이블 변경은 [DB 협업 가이드](database.md)의 migration 파일로 공유합니다. 운영 서비스가 생기면 운영 DB는 개발 DB와 분리합니다.

## Firebase 정리

Firebase SDK·초기화 코드·환경변수·프로젝트 내부 로컬 자격 증명 파일은 Supabase 전환 시 제거합니다. 기존 Firebase 계정은 Supabase 계정으로 자동 이전되지 않습니다. Firebase 콘솔의 사용자·Firestore·프로젝트 자체 삭제와 서비스 계정 키 폐기는 별도의 원격 작업입니다. 로컬 파일 삭제가 원격 키 폐기를 의미하지 않습니다. 삭제 전에 해당 프로젝트에 다른 서비스가 있는지 확인하세요.

## 공식 문서

- [PostgreSQL 연결](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [이메일·비밀번호 인증](https://supabase.com/docs/guides/auth/passwords)
- [PKCE 인증 흐름](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [서버에서 사용자 검증](https://supabase.com/docs/reference/javascript/auth-getuser)

공개 CA 출처: [Supabase 공식 대시보드의 다운로드 설정](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json), [인증서 다운로드](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). 이 CA는 Supabase PostgreSQL 연결에만 사용합니다.
