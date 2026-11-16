# SCENELOG

`main`에 머지하면 GitHub Actions가 검사 후 Vercel 운영 배포를 실행합니다. 최초 연결에 필요한 GitHub Secrets와 Vercel 환경변수는 [배포 가이드](docs/deployment.md)를 참고하세요.

guma & gamja의 영화 취향과 평론을 기록하는 사이트입니다.
같은 영화에 대한 서로 다른 시선을 나누고, 0.1점 단위의 세밀한 평가로 취향을 남깁니다.

현재는 **TMDB 영화 조회, Supabase 로그인, 사용자별 Supabase PostgreSQL 기록 저장**을 구현했습니다. 로그인하면 개인 별점·리뷰·관람일·테마 점수·찜이 계정에 저장됩니다. 로그아웃 상태에서는 로그인·회원가입 화면이 표시됩니다. 실제 이용자 간 친구·추천·대화는 아직 연결하지 않았습니다.

## 이번 화면에서 할 수 있는 일

- 0.1점 단위 별점·리뷰·관람일·재관람 기록과 스포일러 표시
- 포스터 달력과 모바일 날짜별 기록 카드
- 우표·기록 피드·티어 컬렉션, OST·미장센·스토리별 독립적인 평가
- 예시 계정 간 친구 요청·수락, 추천함, 공통 영화 비교, 그룹별 영화 대화
- 프린터 출력 애니메이션·완료음과 별점순/티어별 PNG 저장
- 개인 기록 JSON 백업

로그인해야 개인 아카이브에 접근할 수 있습니다. 로그아웃하면 개인 화면이 닫히고 로그인 화면으로 돌아갑니다. 기존 체험 계정·기록은 읽거나 자동 이전하지 않습니다.

발견 화면과 기록할 영화 선택은 기본적으로 TMDB API를 사용합니다. **‘예시 영화 체험’을 직접 선택한 경우에만** 기존 영화 6편을 보여줍니다. 토큰 누락이나 API 장애를 샘플로 숨기지 않습니다. 실제 영화의 상세 정보는 열 때 가져오고, 저장한 영화는 검색 페이지가 바뀌거나 새로고침해도 개인 컬렉션에서 유지됩니다.

0점과 미평가는 구분합니다. 테마 점수는 전체 별점에 영향을 주지 않습니다. 재관람은 달력에 따로 기록하며, 컬렉션은 가장 최근 생성한 관람 기록의 별점을 대표로 표시합니다. 티어는 수동 지정이 우선하고, 미지정 시 S ≥4.5 / A ≥4.0 / B ≥3.0 / C ≥2.0 / D <2.0으로 분류합니다.

## 취향 지도와 달력 대표 포스터

홈의 취향 지도는 선택한 기간의 **영화별 최신 별점 중 4.0점 이상인 영화**를 장르별로 셉니다. 조각을 누르면 근거가 된 영화와 별점을 확인할 수 있습니다. 같은 영화의 재관람은 중복 집계하지 않으며, 한 영화가 여러 장르에 포함될 수 있습니다. 장르별 개수 상위 8개를 표시하고, 면적은 그중 최댓값에 비례합니다. 평가가 10편 미만이면 잠정적인 경향임을 안내합니다. 감정이나 성격을 추측하는 AI 분석은 아닙니다.

관람일지에서 날짜를 누르면 그날의 기록을 볼 수 있습니다. 여러 영화를 본 날에는 **대표 포스터**를 선택할 수 있고, 계정·날짜별 선택이 브라우저에 저장됩니다. 기본값은 가장 최근 생성한 기록이며, 선택한 기록의 날짜가 바뀌면 남은 기록 중 최신 포스터를 사용합니다.

전체·테마 별점은 별 버튼으로 정수 점수를 빠르게 고른 뒤 숫자 입력과 ± 버튼으로 0.1점씩 조절합니다. 기존 기록은 그대로 불러오며, 미평가와 0점도 계속 구분합니다.

## 기술 구성

- Next.js 16 App Router / React 19 / TypeScript strict 모드
- CSS Modules / Lucide React / ESLint
- Next.js Route Handler 기반 백엔드
- TMDB API / Zod 외부 응답 및 입력 검증 / `server-only` 서버 코드 경계
- Node.js test runner + tsx / npm 및 `package-lock.json`

## 시작하기

Node.js 22 LTS를 권장합니다. nvm을 사용한다면 `.nvmrc`에 맞춰 `nvm install` 후 `nvm use`를 실행하세요.

```bash
npm ci
cp .env.example .env.local
```

위 복사는 `.env.local`이 없는 첫 설정 때만 실행합니다. 이미 있다면 기존 값을 유지하고 `.env.example`의 새 항목만 추가하세요. Windows PowerShell에서는 `Copy-Item .env.example .env.local`을 사용합니다.

[TMDB API 설정](https://www.themoviedb.org/settings/api)에서 발급받은 **API Read Access Token**을 `.env.local`에 넣습니다. v3 API Key가 아닌 읽기 액세스 토큰을 사용합니다.

```dotenv
TMDB_READ_ACCESS_TOKEN=발급받은_토큰
```

- `Bearer ` 접두사 없이 토큰 값만 입력합니다.
- `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 토큰은 서버에서만 사용합니다.
- `.env.local`은 Git에서 제외됩니다. 커밋하거나 채팅에 공유하지 않습니다.
- 환경변수를 변경했다면 개발 서버를 다시 실행합니다.

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 인기 영화와 제목 검색을 확인합니다.
토큰 없이도 빌드와 자동 테스트는 실행할 수 있습니다. 토큰이 없으면 영화 API는 `503 TMDB_NOT_CONFIGURED`를 반환하고 화면에는 오류 및 재시도 상태가 표시됩니다. 샘플 데이터로 자동 대체하지 않습니다. 화면의 ‘예시 영화로 체험하기’ 버튼으로 로컬 기능을 별도 확인할 수 있습니다.

로그인은 **Supabase Auth**, 데이터 저장은 **Supabase PostgreSQL**, API·권한 검사는 **Next.js**에서 담당합니다. [Supabase 설정 가이드](docs/supabase.md)를 따라 `.env.local`을 채우고 `npm run db:setup`으로 테이블을 생성하세요. 이후에는 `npm run dev`로 Next.js만 실행하면 됩니다. 두 개발자 모두 같은 개발용 Supabase 프로젝트에 연결하므로 로컬 DB 설치나 서비스 계정 JSON은 필요하지 않습니다. 기존 Firebase 계정·기록은 자동 이전하지 않으며 Supabase에서 새로 가입합니다.

## 명령어

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 실행 (공유 Supabase 사용) |
| `npm run dev:web` | dev와 동일하게 Next.js 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드된 앱 실행 |
| `npm run typecheck` | Next.js 타입 생성 및 TypeScript 검사 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 인증·저장 API, PostgreSQL SQL 및 아카이브 회귀 테스트 |
| `npm run db:setup` | 연결된 DB에 마이그레이션 적용 및 연결 확인 |
| `npm run db:local:setup` | 선택 사항: macOS 로컬 DB 최초 생성 (DATABASE_URL을 로컬로 변경함) |
| `npm run db:start` | 프로젝트 로컬 DB 시작 |
| `npm run db:stop` | 프로젝트 로컬 DB 종료, 데이터 유지 |
| `npm run db:status` | 로컬 DB 실행 상태 |
| `npm run db:migrate` | 버전 관리된 SQL 마이그레이션 적용 |
| `npm run db:check` | PostgreSQL 연결 및 기본 테이블 확인 |

## 프로젝트 구조

```text
src/
  app/
    api/
      movies/
        route.ts              # GET /api/movies: 인기 영화 / 제목 검색
        [id]/route.ts         # GET /api/movies/:id: 상세 조회
      auth/me/route.ts        # Supabase 토큰 검증 및 내 계정 조회
      archive/route.ts        # 내 아카이브 GET/PUT
    layout.tsx                # 공통 레이아웃, 메타데이터
    page.tsx                  # 메인 페이지 조합
    globals.css               # 전역 스타일 및 색상 변수
    not-found.tsx             # 404 페이지
  server/                     # 서버 전용: 브라우저에서 import 금지
    auth/                     # Supabase Auth 서버를 통한 토큰 검증
    archive/                  # 저장 입력 검증, 트랜잭션, 충돌 검사
    supabase/                 # 세션 저장 없는 서버 인증 클라이언트
    db/                       # PostgreSQL 연결 풀, 트랜잭션, 마이그레이션
    http/
      errors.ts               # 공통 API 오류와 안전한 JSON 오류 응답
    movies/
      validation.ts           # 검색어, 페이지, 영화 ID 검증
      service.ts              # 영화 조회 로직, 외부 API 조합
    tmdb/
      client.ts               # 인증, HTTP 통신, 캐시, 타임아웃
      schemas.ts              # TMDB 응답 스키마 및 타입
      mapper.ts               # TMDB 응답 → SCENELOG 도메인 타입
  components/
    scenelog/                 # 기록·달력·컬렉션·테마·친구·프린트룸 UI
    layout/                   # 공통 헤더, 푸터
    home/                     # 영화 목록, 검색, 페이지 이동, 오류 상태
    movies/                   # 영화 카드
  hooks/
    use-movies.ts             # 조회 상태, 재시도, 요청 취소
    use-supabase-user.ts      # 로그인 상태 구독
    use-cloud-archive.ts      # 사용자별 저장·조회, 요청 취소
  lib/
    api/movies.ts             # 브라우저 → 같은 도메인의 Next.js API 호출
    archive-movies.ts         # 목록/상세 정규화, 보관한 영화 카탈로그
    scene-model.ts            # 기록·친구 타입과 순수 계산
    scene-store.ts            # 브라우저 로컬 저장
    print-sheet.ts            # 인쇄용 정렬과 Canvas PNG
  types/
    movie.ts                  # 영화, 상세, 목록 응답 타입
    api.ts                    # 공통 오류 응답 타입
  data/
    movies.ts                 # 명시적인 예시 영화 체험용 데이터
db/migrations/                # Git으로 공유하는 SQL 스키마 변경 이력
scripts/db.ts                 # 마이그레이션·연결 확인 CLI
scripts/postgres-local.ts     # 로컬 PostgreSQL 생성·시작·종료
.local/                      # Git 제외: 로컬 DB 데이터·자격 증명
docs/supabase.md              # Supabase Auth·공유 DB 설정
docs/database.md              # 마이그레이션과 팀 협업 안내
public/images/                # 기존 샘플 포스터와 출처
tests/movies-api.test.ts       # API 입력 검증, 응답 변환, 장애 처리 테스트
tests/scene-archive.test.ts    # 재관람, 0점/미평가, 테마·티어 정렬, 영화 정보 보존
.env.example                  # 환경변수 이름과 설정 예시
next.config.ts                # TMDB 포스터 이미지 호스트 허용
```

## 백엔드 역할과 데이터 흐름

```text
SceneLogApp → useMovies → lib/api/movies
                         ↓ HTTP
app/api/movies → server/movies → server/tmdb → TMDB
                    ↓                ↓
              조회 로직         인증 · 검증 · 변환
```

- `app/api`는 HTTP 입력 검증과 응답 처리만 담당합니다.
- `server/movies`는 영화 기능의 조회 로직을 담당합니다. Route Handler에서 외부 API를 직접 호출하지 않습니다.
- `server/tmdb`는 외부 공급자 전용 코드입니다. TMDB 필드와 인증 방식을 UI에 전달하지 않습니다.
- `types`는 브라우저와 서버가 공유하는 SCENELOG 데이터 계약입니다.
- `server/archive`에서 PostgreSQL에 접근합니다. Supabase Auth로 검증한 사용자의 ID로 데이터 소유자를 정하고, SQL 매개변수·트랜잭션·revision 검사로 사용자별 기록을 저장합니다. 상세 내용은 DB 협업 가이드를 참고하세요.
- 서버 컴포넌트에서 데이터가 필요하면 내부 HTTP API를 우회해 `server/movies/service.ts`를 직접 호출할 수 있습니다.

## 영화 API

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| GET | `/api/movies?page=1` | TMDB 인기 영화 |
| GET | `/api/movies?query=인터스텔라&page=1` | 영화 제목 검색 |
| GET | `/api/movies/157336` | 영화 상세, 감독, 상영 시간 |

- 응답 언어는 `ko-KR`입니다. 번역 유무에 따라 원어 제목이나 빈 줄거리가 있을 수 있습니다.
- `page`: 기본값 1, 허용 범위 1~500. `query`: 앞뒤 공백 제거 후 최대 100자. 비어 있으면 인기 영화 조회.
- 검색은 TMDB의 원제·번역 제목·대체 제목을 대상으로 합니다. **감독 이름 검색은 지원하지 않습니다.**
- 목록에서는 작품당 상세 호출을 하지 않습니다. 감독은 상세 API에서만 가져옵니다.
- 평점은 TMDB의 10점 척도를 5점 척도, 소수점 한 자리로 환산합니다. SCENELOG 이용자 평점이 아닙니다.
- 평가가 없으면 `rating: null`, 포스터와 개봉일이 없으면 각각 `poster: null`, `year: null`입니다.

목록 응답 구조 (값은 예시):

```json
{
  "data": [
    {
      "id": "157336",
      "title": "인터스텔라",
      "originalTitle": "Interstellar",
      "year": 2014,
      "genres": ["SF", "드라마"],
      "rating": 4.3,
      "poster": null,
      "description": "영화 줄거리",
      "source": "tmdb"
    }
  ],
  "pagination": { "page": 1, "totalPages": 1, "totalResults": 1 }
}
```

상세 응답은 `{ "data": MovieDetail }`이며 목록의 영화 필드에 `director: string | null`, `runtime: number | null`(분)을 추가합니다.

오류 응답은 항상 같은 형태입니다.

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "페이지는 1~500, 검색어는 100자 이내로 입력해 주세요."
  }
}
```

| 상태 | 의미 |
| --- | --- |
| 400 | 잘못된 페이지, 검색어 또는 영화 ID |
| 404 | 존재하지 않는 영화 |
| 502 | TMDB 인증 실패, 장애, 잘못된 응답 |
| 503 | 토큰 미설정 또는 TMDB 호출 제한 |
| 504 | 외부 요청 8초 타임아웃 |

외부 오류 원문, 스택, 인증 토큰은 응답에 포함하지 않습니다. 서버의 TMDB 조회 캐시는 인기 목록 5분, 장르 24시간, 상세 1시간입니다. 검색은 `no-store`입니다. 자체 HTTP API 응답은 브라우저에 캐시하지 않습니다.

## 개발 규칙

- 파일명은 `movie-card.tsx`처럼 kebab-case, 컴포넌트 이름은 `MovieCard`처럼 PascalCase를 사용합니다.
- 내부 경로는 `@/components/...`, `@/server/...` 별칭을 사용합니다.
- 서버 코드는 `server-only`를 선언합니다. 클라이언트에서 필요한 타입은 `types`에서 가져옵니다.
- 상태와 브라우저 이벤트가 필요한 컴포넌트·훅에만 `"use client"`를 선언합니다.
- 스타일은 컴포넌트 옆 CSS Module에 둡니다.
- 클라우드 API는 Supabase Auth의 `getUser(token)`으로 검증한 후 사용자별 데이터에 접근합니다. DB 소유권 검사는 Next.js에서 수행하며 `scenelog` 스키마는 Data API에 노출하지 않습니다.

## 검증

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

자동 테스트는 실제 토큰이나 네트워크 없이 실행됩니다. 인기 목록·검색·상세 변환, 입력 검증, 빈 결과, 누락 데이터, 토큰 미설정, TMDB 장애·호출 제한·타임아웃을 검증합니다. 0점/미평가 구분, 재관람 집계, 테마·수동 티어 순위, 영화 카탈로그 보존, 상세 조회 오류 전달도 검증합니다. 실제 TMDB 연결은 토큰을 설정한 개발 서버에서 별도로 확인해야 합니다.

## 참고

- [TMDB 인증](https://developer.themoviedb.org/docs/authentication-application)
- [인기 영화](https://developer.themoviedb.org/reference/movie-popular-list) / [검색](https://developer.themoviedb.org/reference/search-movie) / [상세](https://developer.themoviedb.org/reference/movie-details)
- [Next.js 프로젝트 구조](https://nextjs.org/docs/app/getting-started/project-structure)
- [샘플 포스터 출처](public/images/README.md)

## UI 리소스와 저장 범위

주황빛 빨강·흰색·검정·옅은 회색과 [Pretendard v1.3.9](https://github.com/orioncactus/pretendard)를 사용합니다. 폰트와 SIL OFL 라이선스는 `public/fonts/`에 포함합니다.

개인 기록·예시 계정·친구 데이터는 `scenelog.archive.v1` 로컬 저장소에 보관합니다. 다른 브라우저나 기기에 동기화되지 않습니다. TMDB 토큰은 기존 서버 전용 경계를 그대로 유지하며 브라우저 저장소에는 넣지 않습니다. PNG 저장은 브라우저에서 생성하고, 외부 포스터를 읽지 못하면 오류를 표시합니다.

### 평가 비교와 컬렉션 보기

- 전체 별점을 바꾸면 같은 점수를 준 다른 영화가 즉시 나타납니다. 현재 계정의 영화별 최신 기록만 사용하며, 현재 영화·미평가·다른 계정·테마 별점은 제외합니다. 포스터를 누르면 당시 리뷰가 펼쳐지고 작성 중인 감상은 유지됩니다.
- 우표는 최신 평가를 기준으로 4.0점 이상, 5.0점, 모든 영화를 모아 보는 전시입니다. 기록 피드는 포스터와 함께 내 별점·최근 관람 날짜·기록 날짜·최신 감상을 카드로 보여줍니다. 기록순·관람일순·별점순·관람 횟수순 정렬과 제목·원제·장르·감상 검색, 재관람 필터, 회차별 감상 펼치기·수정, 재관람 추가를 지원합니다. 티어는 기존의 직접 등급 분류를 유지합니다.
- 취향 지도의 원래 색을 유지합니다. 호버·포커스한 조각의 채워진 영역 안에서만 액체 질감이 흐르며, 비어 있는 조각은 영역 안의 도트가 한 차례 출렁이고 사라집니다. 운영체제의 동작 줄이기 설정을 따릅니다. 지도 수치와 집계 기준은 기존과 같습니다.

### 연도별 영화 다이어리

컬렉션의 우표 보기에서 연도별 한 권의 다이어리를 만듭니다. 표지를 누르면 책이 펼쳐지고, 기록한 영화 우표와 문장을 각 페이지에 붙일 수 있습니다. 마우스·터치 드래그, 방향키 이동(Shift로 크게 이동), 크기·회전·앞으로 가져오기·삭제, 실행 취소/다시 실행, 종이와 표지 변경을 지원합니다. 올해 기록으로 자동 꾸민 뒤 자유롭게 수정할 수도 있습니다.

다이어리 페이지·조각 배치는 브라우저에 Supabase 사용자 ID별로 분리해서 저장하고 JSON 백업에 함께 포함합니다. 다이어리 꾸미기는 아직 기기 간 동기화되지 않습니다. 우표는 선택한 연도 안의 영화별 최신 관람 기록을 사용하며, '내 모든 관람 기록'을 선택하면 관람일이 없는 영화도 붙일 수 있습니다. 다이어리와 원본 영화 리뷰는 별도로 보존됩니다.

영상 탭에서 편집한 배치 그대로 표지와 페이지 넘김을 MP4(H.264, 30fps)로 만듭니다. 정사각형 1080×1080과 세로 1080×1920을 지원하고, 빈 펼침면만 건너뛰므로 맞은편 페이지는 보존합니다. 화면·마이크 권한이나 서버 업로드 없이 브라우저 안에서 생성합니다. H.264 인코딩을 지원하지 않는 브라우저에는 안내를 표시합니다. 파일 생성 후 미리보기·다운로드가 가능하며 소리와 SNS 자동 게시 기능은 포함하지 않습니다. Mediabunny는 영상 만들기를 실행할 때만 불러옵니다.

### 다이어리 편집 도구

- 펼친 두 페이지를 하나의 작업 공간으로 사용합니다. 우표·문장·사진·그림을 가운데 선을 넘어 옮길 수 있고, 경계에 걸친 조각은 영상에서도 양쪽에 이어집니다.
- 선택한 조각의 8개 조절점으로 크기를 바꿉니다. 문장은 폭·높이를 따로 조절하고, 우표·사진은 비율을 유지합니다. 문장을 더블클릭하거나 Enter를 누르면 페이지에서 직접 편집합니다. Ctrl+Enter는 적용, Escape는 해당 편집 취소입니다.
- 글자 크기 직접 입력(8~120), 왼쪽·가운데·오른쪽 정렬, 색, 글자에 맞춘 상자 높이를 지원합니다. 고운바탕·개구·나눔손글씨 펜·주아체는 Google Fonts의 SIL OFL 배포본을 로컬 제공하며 라이선스는 `public/fonts/journal/`에 함께 둡니다.
- 50~300% 확대와 화면 맞춤, 손 도구로 화면 이동, 펜·형광펜 그리기를 지원합니다. 그림도 선택·이동·크기 조절·삭제·실행 취소할 수 있습니다.
- 앨범/파일에서 사진 가져오기와 클립보드 이미지 붙여넣기, 영역 자르기·원형·둥근 모서리·점으로 테두리를 지정하는 자유 오리기를 지원합니다. 원본은 유지합니다. JPG/PNG/WebP/GIF(정지 이미지), 장당 25MB까지이며 긴 변 1800px로 줄여 브라우저 IndexedDB에 저장합니다. JSON 기록 백업에는 사용하는 사진 데이터도 포함합니다.
- 닫기 옆 저장 버튼과 자동 저장 상태를 제공합니다. 사진·새 글꼴·그림·자르기 결과는 MP4 출력에도 반영됩니다. 브라우저 데이터를 지우면 기록과 사진이 사라지므로 별도 백업이 필요하며, 아직 기기 간 동기화는 없습니다.
