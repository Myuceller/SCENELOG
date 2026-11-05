# SCENELOG

guma & gamja의 영화 취향과 평론을 기록하는 사이트입니다.
같은 영화에 대한 서로 다른 시선을 나누고, 0.1점 단위의 세밀한 평가로 취향을 남깁니다.

현재는 **TMDB 영화 조회 API와 영화 기록·컬렉션·친구 기능의 로컬 체험 UI**를 구현했습니다. 개인 별점과 리뷰는 브라우저에 저장되며, 사용자 인증과 공유 DB는 아직 연결하지 않았습니다.

## 이번 화면에서 할 수 있는 일

- 0.1점 단위 별점·리뷰·관람일·재관람 기록과 스포일러 표시
- 포스터 달력과 모바일 날짜별 기록 카드
- 우표·VHS·티어 컬렉션, OST·미장센·스토리별 독립적인 평가
- 예시 계정 간 친구 요청·수락, 추천함, 공통 영화 비교, 그룹별 영화 대화
- 프린터 출력 애니메이션·완료음과 별점순/티어별 PNG 저장
- 개인 기록 JSON 백업

상단 계정 선택에서 **guma**, **gamja**, **momo**를 전환해 친구 기능을 확인할 수 있습니다. 메시지는 실제 사람에게 전송되지 않으며 이 브라우저 안에 저장됩니다.

발견 화면과 기록할 영화 선택은 기본적으로 TMDB API를 사용합니다. **‘예시 영화 체험’을 직접 선택한 경우에만** 기존 영화 6편을 보여줍니다. 토큰 누락이나 API 장애를 샘플로 숨기지 않습니다. 실제 영화의 상세 정보는 열 때 가져오고, 저장한 영화는 검색 페이지가 바뀌거나 새로고침해도 개인 컬렉션에서 유지됩니다.

0점과 미평가는 구분합니다. 테마 점수는 전체 별점에 영향을 주지 않습니다. 재관람은 달력에 따로 기록하며, 컬렉션은 가장 최근 생성한 관람 기록의 별점을 대표로 표시합니다. 티어는 수동 지정이 우선하고, 미지정 시 S ≥4.5 / A ≥4.0 / B ≥3.0 / C ≥2.0 / D <2.0으로 분류합니다.

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

Windows PowerShell에서는 `Copy-Item .env.example .env.local`을 사용합니다.

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

## 명령어

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드된 앱 실행 |
| `npm run typecheck` | Next.js 타입 생성 및 TypeScript 검사 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 영화 API 및 기록·정렬·영화 정보 보존 회귀 테스트 |

## 프로젝트 구조

```text
src/
  app/
    api/
      movies/
        route.ts              # GET /api/movies: 인기 영화 / 제목 검색
        [id]/route.ts         # GET /api/movies/:id: 상세 조회
    layout.tsx                # 공통 레이아웃, 메타데이터
    page.tsx                  # 메인 페이지 조합
    globals.css               # 전역 스타일 및 색상 변수
    not-found.tsx             # 404 페이지
  server/                     # 서버 전용: 브라우저에서 import 금지
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
- 추후 DB 도입 시 `server/db`, 영화 저장소 모듈을 추가하고 서비스에 연결합니다. 현재 DB 연결이나 ORM은 없습니다.
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
- DB, 인증, 쓰기 API는 실제 기능을 추가할 때 도입합니다.

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
