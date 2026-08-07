# Folio 배포 가이드

## 배포 전 필수 조건

- 외부에서 접근 가능한 HTTPS 도메인
- Google OAuth 2.0 Web Client
- 영구 볼륨 또는 운영용 데이터베이스
- AI 기능을 사용할 경우 OpenAI API 키

## Docker로 실행

`.env.example`을 `.env`로 복사한 뒤 실제 값을 입력한다.

```env
NODE_ENV=production
APP_ORIGIN=https://folio.example.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://folio.example.com/api/v1/auth/google/callback
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

컨테이너를 실행한다.

```powershell
docker compose up --build -d
```

상태 확인:

```powershell
docker compose ps
docker compose logs -f folio
```

종료:

```powershell
docker compose down
```

`docker compose down -v`는 저장된 사용자 데이터까지 삭제하므로 사용하지 않는다.

## Google Cloud 설정

Google Cloud Console의 승인된 리디렉션 URI는 `.env`의 `GOOGLE_REDIRECT_URI`와 완전히 같아야 한다.

```text
https://folio.example.com/api/v1/auth/google/callback
```

승인된 JavaScript 원본에는 서비스 주소를 등록한다.

```text
https://folio.example.com
```

## 영구 데이터

Docker Compose는 `folio-data` 볼륨을 컨테이너의 `/data`에 연결한다. 현재 다음 데이터가 여기에 저장된다.

```text
/data/db.json
/data/uploads/{userId}/*
```

컨테이너를 새로 만들어도 볼륨을 유지해야 한다. 호스팅 서비스에서는 `/data`에 영구 디스크를 연결하고 `FOLIO_DATA_DIR=/data`로 설정한다.

## 리버스 프록시

프록시는 HTTPS를 종료한 뒤 Folio의 4173 포트로 요청을 전달한다. 다음 헤더를 유지한다.

```text
Host
X-Forwarded-Proto: https
```

`APP_ORIGIN`을 지정하면 OAuth 리디렉션과 허용된 복귀 주소는 프록시 헤더 대신 이 고정 주소를 사용한다.

## 운영 점검

배포 후 아래 항목을 순서대로 확인한다.

1. `GET /api/v1/health`가 200을 반환하는지 확인
2. 실제 Google 계정으로 로그인
3. 프로필 저장 후 새로고침
4. 지원과 면접 일정 등록·수정·삭제
5. PDF 업로드·열람·삭제
6. 공고 분석과 지원서 생성
7. 데이터 JSON 내보내기
8. 별도 테스트 계정으로 계정 탈퇴
9. 컨테이너 재시작 후 데이터 유지 확인

## 백업

JSON 저장소를 유지하는 동안에는 `/data` 전체를 함께 백업한다. `db.json`만 백업하면 PDF 파일이 빠진다. 복구 테스트 없이 백업 파일만 생성하는 방식은 피한다.

사용자가 늘거나 여러 인스턴스로 확장하기 전에는 PostgreSQL과 객체 스토리지로 이전해야 한다. 현재 JSON 파일 저장 방식은 단일 인스턴스 개인용 배포를 대상으로 한다.
