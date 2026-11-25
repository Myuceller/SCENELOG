# GitHub Actions → Vercel 배포

`.github/workflows/ci-cd.yml`에서 검사와 운영 배포를 관리합니다.

| 이벤트 | 동작 |
| --- | --- |
| main/dev 대상 PR | npm ci → lint → typecheck → test → build |
| dev에 push/merge | 동일 검사와 빌드 |
| main에 push/merge | 검사 성공 → Vercel Production 설정 다운로드 → 필수 환경변수 검사 → 운영 빌드 → 운영 배포 |
| Actions에서 수동 실행 | main을 선택하면 검사 후 운영 재배포. 다른 브랜치는 검사만 실행 |

운영 빌드는 `vercel build --prod`로 GitHub runner에서 한 번 수행하고, `vercel deploy --prebuilt --prod`로 결과를 배포합니다. PR 검사에는 운영 비밀 값이 전달되지 않습니다. 운영 배포는 동시에 실행되지 않으며, 배포 직전에 최신 main 커밋인지 확인합니다.

## 최초 연결

현재 GitHub 저장소 **Settings → Environments → scenelogenv → Environment secrets**에 다음 세 값이 등록되어 있습니다. 배포 job은 `scenelogenv` 환경을 지정해 이 값을 사용합니다. 토큰을 교체할 때도 같은 위치에서 변경합니다.

| Secret | 위치 |
| --- | --- |
| `VERCEL_TOKEN` | [Vercel Account Settings → Tokens](https://vercel.com/account/settings/tokens)에서 scenelog가 속한 팀에 접근 가능한 토큰 발급 |
| `VERCEL_ORG_ID` | Vercel 팀 Settings의 Team ID. 팀 이름이나 slug가 아니라 실제 ID |
| `VERCEL_PROJECT_ID` | scenelog → Settings → General → Project ID |

`vercel link`를 실행했다면 로컬 `.vercel/project.json`의 `orgId`, `projectId`로도 확인할 수 있습니다. 토큰이나 `.vercel` 폴더는 커밋하지 않습니다. 토큰 만료 전에 GitHub secret을 갱신합니다.

Vercel **scenelog → Settings → Environment Variables**에서 다음 값의 **Production** 적용을 확인합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` — 원격 Supabase 연결 주소
- `TMDB_READ_ACCESS_TOKEN`
- `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED` — Google 로그인을 사용할 때만 `true`

환경변수가 빠지면 기존 운영 배포를 교체하기 전에 실패합니다. 이 검사는 값의 존재 여부를 확인하며 실제 DB 연결 성공까지 보장하지는 않습니다. 로컬 `.env.local`은 자동 업로드되지 않습니다. 서비스 실행에 불필요한 Supabase 관리자 키와 로컬 서비스 계정 파일은 등록하지 않습니다.

Vercel 프로젝트의 Node.js 버전은 `.nvmrc`와 같은 **22.x**, Framework Preset은 **Next.js**, Root Directory는 저장소 루트로 설정합니다.

## 중복 배포와 브랜치 규칙

`vercel.json`은 **main의 Vercel Git 자동 배포만 비활성화**합니다. main은 GitHub Actions가 운영 배포하고, 다른 브랜치의 기존 Vercel Preview 배포는 유지합니다. 위 Secrets를 등록한 후 이 설정을 main에 병합해야 합니다.

main은 PR로 변경합니다. main 브랜치 규칙에서 **Quality checks**를 필수 검사로 지정하면 검사 실패 PR의 병합도 막을 수 있습니다. 이 워크플로 파일 자체는 브랜치 보호 규칙을 변경하지 않습니다.

GitHub `scenelogenv` Environment에 별도 승인자가 설정되어 있다면 배포가 승인을 기다립니다. 현재 승인 규칙은 없습니다.

CI/CD 변경을 main에 먼저 병합했다면 dev에도 main을 병합해 워크플로와 설정을 공유합니다. 현재 저장소 기본 브랜치가 dev인 경우 수동 실행 버튼은 워크플로가 dev에도 반영된 뒤 표시됩니다.

## 운영 확인과 실패 대응

API 실행 지역은 루트 `vercel.json`의 `"regions": ["sin1"]`로 지정합니다.
`sin1`은 싱가포르이며, 현재 Supabase DB 연결 지역(`ap-southeast-1`)과 맞춘 설정입니다.
이 변경은 새 배포부터 적용됩니다. GitHub Actions의 운영 배포가 완료되면
`/api/archive` 또는 `/api/profile` 응답의 `x-vercel-id`에서 실행 지역이
`sin1`인지 확인하고, 로그인한 요청의 `Server-Timing`으로 인증·DB 구간을 비교합니다.
앞에 표시되는 `icn1` 등은 요청을 받은 엣지 지역일 수 있으므로 실행 지역과 구분합니다.

1. GitHub **Actions → CI / Vercel**에서 `Quality checks`, `Deploy production` 결과를 확인합니다.
2. 성공한 실행 요약의 배포 주소를 열고 로그인·영화 조회·기록 읽기/저장을 확인합니다.
3. 환경변수 수정 후에는 Actions에서 최신 main 실행을 다시 실행하거나 수동 실행합니다.
4. `main has changed`로 실패한 이전 실행은 재시도하지 않고 최신 main 실행을 확인합니다.

Supabase Authentication의 Site URL과 Redirect URLs에는 운영 사이트 주소와 `/auth/callback`, `/auth/reset-password`를 등록합니다.

DB 마이그레이션은 이 워크플로에서 자동 실행하지 않습니다. 테이블 변경이 포함된 릴리스는 별도로 검토한 마이그레이션을 먼저 적용하고, 기존 앱과 호환되는 순서로 배포합니다. `.vercel` 설정 파일·빌드 결과는 별도 공개 artifact로 업로드하지 않습니다.

공식 문서: [Vercel GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [Git 자동 배포 설정](https://vercel.com/docs/project-configuration/git-configuration)
