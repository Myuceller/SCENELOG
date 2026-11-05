# SCENELOG

guma & gamja의 영화 취향과 평론을 기록하는 사이트입니다.
같은 영화에 대한 서로 다른 시선을 나누고, 앞으로 0.1점 단위의 세밀한 평가를 지원하는 것을 목표로 합니다.

현재는 **프로젝트 기본 구조와 간단한 메인 페이지**만 구현했습니다. DB, 인증, 평론 작성, 평점 저장은 아직 연결하지 않았습니다.

## 기술 구성

- Next.js 16 / App Router
- React 19 / TypeScript strict 모드
- CSS Modules + 전역 CSS 변수
- ESLint / Next.js 권장 규칙
- Lucide React 아이콘
- npm / `package-lock.json`으로 의존성 관리

## 시작하기

Node.js 22 LTS를 권장합니다. nvm을 사용한다면 `.nvmrc`에 맞춰 `nvm install` 후 `nvm use`를 실행하세요.

```bash
npm ci
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.
현재 환경변수나 API 키는 필요하지 않습니다.

## 명령어

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드된 앱 실행 |
| `npm run typecheck` | Next.js 타입 생성 및 TypeScript 검사 |
| `npm run lint` | ESLint 검사 |

## 프로젝트 구조

```text
public/
  images/                     # 샘플 영화 포스터, 출처 기록
src/
  app/
    layout.tsx                # 공통 레이아웃, 메타데이터
    page.tsx                  # 메인 페이지 (서버 컴포넌트)
    page.module.css           # 메인 페이지 스타일
    globals.css               # 리셋, 색상 변수, 공통 스타일
    not-found.tsx             # 404 페이지
    icon.svg                  # 사이트 아이콘
  components/
    layout/                   # 공통 헤더, 푸터
    home/                     # 메인 페이지 영화 목록 및 검색
    movies/                   # 재사용 가능한 영화 카드
  data/
    movies.ts                 # 화면 개발용 샘플 데이터
  types/
    movie.ts                  # 영화 도메인 타입
eslint.config.mjs             # ESLint 설정
next.config.ts                # Next.js 설정
tsconfig.json                 # TypeScript 설정, @/* 별칭
```

## 개발 규칙

- `app`에는 라우트 구성과 페이지 조합을 둡니다.
- 재사용 UI는 `components`에 기능별로 나누고, 스타일은 컴포넌트 옆의 CSS Module에 둡니다.
- 파일명은 `movie-card.tsx`와 같은 kebab-case, 컴포넌트 이름은 `MovieCard`와 같은 PascalCase를 사용합니다.
- 내부 경로는 `@/components/...`, `@/types/...` 형태로 가져옵니다.
- 기본적으로 서버 컴포넌트를 사용하고, 상태나 이벤트가 필요한 부분에만 `"use client"`를 선언합니다.
- 현재 데이터 흐름은 `data/movies.ts → app/page.tsx → MovieList → MovieCard`입니다. 목록 컴포넌트는 데이터를 props로 받아 데이터 소스와 분리되어 있습니다.
- DB를 도입할 때 서버의 데이터 조회 모듈을 추가하고 페이지의 데이터 공급 부분을 교체하면 됩니다. 현재는 빈 API나 DB 계층을 미리 만들지 않았습니다.
- 공통 훅, 유틸리티, UI 프리미티브는 실제 필요해질 때 `hooks`, `lib`, `components/ui`를 추가합니다.

## 현재 메인 페이지

- 서비스 소개와 반응형 영화 목록
- 영화 제목, 영문 제목, 감독 이름 검색 및 검색 결과 없음 표시
- 영화 카드의 소수점 한 자리 샘플 평점
- 메타데이터, 사이트 아이콘, 404 페이지

영화 소개 문구와 평점은 UI 개발용 샘플이며 실제 이용자 평론이나 집계가 아닙니다.
포스터 출처는 [public/images/README.md](public/images/README.md)를 참고하세요.

공식 가이드: [Next.js 프로젝트 구조](https://nextjs.org/docs/app/getting-started/project-structure)
