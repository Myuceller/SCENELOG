# DB 협업과 마이그레이션

기본 DB는 두 개발자가 함께 쓰는 **Supabase PostgreSQL**입니다. 처음 연결할 때는 [Supabase 설정](supabase.md)을 따릅니다.

## 무엇을 공유하나요?

- 실제 행 데이터: 원격 DB에 이미 함께 저장됩니다. Git으로 push/pull하지 않습니다.
- 테이블·컬럼 변경: `db/migrations/0003_설명.sql`처럼 다음 번호의 SQL 파일을 작성하고 Git으로 공유합니다(파일명은 영문 소문자·숫자·밑줄).
- 변경 적용: 최신 코드를 받은 뒤 `npm run db:migrate`. 한 사람이 적용했다면 다른 사람이 다시 실행해도 중복 적용되지 않습니다.
- 같은 계정의 동시 저장: revision이 다르면 409로 거부합니다. 화면을 새로 읽은 다음 다시 편집합니다.

이미 적용한 SQL 파일은 수정하지 않고 새 파일을 추가합니다. 체크섬이 변경되거나 DB가 현재 코드보다 앞선 경우 실행을 중단합니다. 마이그레이션은 트랜잭션과 잠금으로 순서를 보장합니다. 공용 DB 구조를 바꾸면 팀원에게 알려 최신 코드를 받게 합니다.

## 테이블

| 테이블 | 내용 |
| --- | --- |
| `scenelog.archive_owners` | Supabase 사용자 ID, revision, 수정 시각 |
| `scenelog.archive_movies` | 사용자별 영화 메타데이터 |
| `scenelog.viewing_logs` | 별점·관람일·리뷰·테마·티어·재관람 기록 |
| `scenelog.watchlist` | 보고 싶은 영화 |
| `scenelog.schema_migrations` | 적용한 SQL 파일과 체크섬 |

`0001`은 이미 로컬에 적용한 초기 이력이라 그대로 보존하며 `0002`에서 소유자 컬럼을 `user_id`로 바꿉니다. Firebase의 기존 행을 Supabase 사용자에게 자동 연결하지 않습니다. 계정과 데이터 삭제를 자동 연동하는 `auth.users` 외래 키는 없으므로, 향후 회원 탈퇴 API에서 기록 삭제도 처리해야 합니다.

Next.js가 인증된 ID로 SQL의 소유자를 제한합니다. 공유 DB에서 개발한다는 것은 같은 DB 인스턴스를 쓴다는 뜻이며, 앱에서 다른 이용자의 개인 기록을 볼 수 있다는 뜻은 아닙니다. DB 관리자 권한으로는 행을 조회할 수 있습니다. 현재 개발 연결은 테이블 소유자 권한을 사용하므로 운영 전용 계정·권한 분리는 배포 시 별도로 구성합니다.

## 명령어와 검증

```bash
npm run db:setup     # 마이그레이션 + 연결 확인
npm run db:migrate   # 아직 적용하지 않은 파일 적용
npm run db:check     # 연결과 스키마 상태 확인
npm test            # 외부 서비스 없이 PostgreSQL SQL/인증/API 회귀 테스트
```

DB 오류는 원본 연결 URL이나 비밀번호를 출력하지 않습니다. 인증서 오류는 인증서 구성을 확인하고, 연결 오류는 pooler URI·DB 비밀번호·프로젝트 상태를 확인하세요. API 401은 로그인 상태, 503은 Auth/DB 연결 설정을 확인합니다.

## 선택 사항: 독립 로컬 DB

네트워크 없이 DB 작업을 하거나 실제 다중 연결 테스트를 할 때만 사용합니다. 기본 협업에는 필요 없습니다. macOS에서는 PostgreSQL 18을 설치한 뒤 `npm run db:local:setup`을 사용할 수 있습니다. **이 명령은 .env.local의 DB URL을 로컬로 바꾸므로 공유 DB 개발 중에는 실행하지 마세요.**

`db:start`, `db:stop`, `db:status`는 `.local/postgres`의 로컬 DB만 관리합니다. `db:test`는 `127.0.0.1:55432/scenelog`에서만 실행되며 공용 DB 테스트로 사용하지 않습니다. DB를 종료해도 파일은 유지합니다.
