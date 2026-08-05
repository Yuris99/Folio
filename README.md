# Folio

지원 현황, 일정, 회사별 지원 문서, 이력 정보와 공고 분석을 한곳에서 관리하는 개인용 취업 워크스페이스입니다. 프론트엔드와 Node.js API 서버가 함께 들어 있어 바로 실행할 수 있습니다.

## 바로 실행

Node.js 18 이상에서 별도의 패키지 설치 없이 실행됩니다.

```powershell
npm.cmd start
```

브라우저에서 `http://localhost:4173`을 엽니다. 개발 환경에서 Google 키가 없으면 로컬 테스트 계정으로 로그인하며, 입력한 데이터는 `.data/db.json`에 보존됩니다.

## 제공 기능

- Google OAuth 로그인, 14일 세션과 로그아웃
- 지원 등록·수정·삭제와 전 지원 단계 관리
- 할 일, 면접 일정, 월간 달력
- 상세 프로필, 경력/프로젝트, 포트폴리오 링크
- PDF 이력서 업로드·열람
- 회사별 지원 문서 생성·편집·저장
- 공고 저장과 AI 핵심 요건 분석
- 저장한 경험에 근거한 AI 지원서 초안
- 사용자별 JSON 영속 저장소와 서버 동기화
- 모바일 4개 핵심 탭과 PC 사이드바

## Google 로그인 연결

`.env.example`을 `.env`로 복사하고 Google Cloud Console의 OAuth 2.0 Web Client 값을 입력합니다. 서버가 `.env`를 자동으로 읽습니다.

```env
APP_ORIGIN=http://localhost:4173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4173/api/v1/auth/google/callback
```

Google Cloud Console의 승인된 리디렉션 URI에도 `GOOGLE_REDIRECT_URI`와 동일한 주소를 등록해야 합니다. 운영 환경에서는 `APP_ORIGIN`, `GOOGLE_REDIRECT_URI`, `NODE_ENV=production`을 실제 HTTPS 주소에 맞춥니다.

## AI 연결

`.env`에 서버용 키를 설정하면 OpenAI Responses API를 사용합니다. 키를 브라우저 코드에 넣지 마세요.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

키가 없거나 API 요청이 실패하면 기능이 멈추지 않고 로컬 규칙 기반 분석·초안 생성기로 전환됩니다.

## 외부 백엔드로 교체

[config.js](./config.js)의 `apiBaseUrl`을 바꾸면 됩니다. 프론트엔드가 기대하는 전체 API 계약은 [BACKEND_API.md](./BACKEND_API.md)에 정리되어 있습니다.

## 검사

```powershell
npm.cmd run check
npm.cmd test
```

통합 테스트는 임시 데이터 디렉터리에서 로그인부터 CRUD, AI 대체 경로, 파일, 초기화, 로그아웃까지 검증합니다.
