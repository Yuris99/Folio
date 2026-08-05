# Folio

Folio는 취업 준비에 필요한 지원 현황, 일정, 지원 문서, 이력 정보와 채용 공고를 한곳에서 관리하는 개인용 워크스페이스입니다.

현재 저장소에는 반응형 프론트엔드와 Node.js API 서버가 함께 구현되어 있습니다. 별도의 패키지 설치나 외부 데이터베이스 없이 실행할 수 있으며, Google OAuth와 OpenAI API 키를 등록하면 실제 외부 서비스까지 연결됩니다.

## 현재 구현 상태

### 로그인과 사용자 데이터

- Google OAuth 2.0 Authorization Code Flow, PKCE와 `state` 검증
- HttpOnly, SameSite=Lax 쿠키 기반 14일 세션
- 로그인 사용자별 독립 워크스페이스
- 로그아웃과 현재 사용자 세션 조회
- 개발 환경에서 Google 키가 없을 경우 로컬 테스트 계정 제공
- 운영 환경에서 Google 설정이 없으면 명시적인 설정 오류 반환

### 홈

- 서류 작성 중, 전체 지원, 면접 진행, 최종 결과 요약
- 요약 카드를 누르면 관련 관리 화면으로 이동
- 다가오는 지원 마감 및 면접 일정 표시
- 할 일 추가와 완료 상태 관리
- 모바일 홈은 화면 안에서 주요 정보를 확인하도록 구성하고 본문 스크롤 제거

### 지원 관리

- 지원 기록 등록, 수정, 삭제
- 회사명, 직무, 마감일, 공고 URL, 메모와 다음 할 일 관리
- 관심부터 합격·탈락까지 전체 지원 단계 관리

```text
관심 → 작성 중 → 지원 완료 → 서류 통과 → 면접 → 합격 또는 탈락
```

- 상태별 지원 건수 요약
- 모바일에서는 가로 스크롤 없이 지원 목록과 상태 요약 표시

### 지원 문서

- 회사별 지원 문서 분류
- 새 문서 생성, 본문 편집과 글자 수 확인
- 서버에 문서 내용 저장
- 저장한 경력 정보를 활용한 AI 맞춤 지원서 초안 생성
- AI가 만든 초안도 일반 문서와 동일하게 편집 가능

### 일정과 면접

- 월간 달력에서 지원 마감일과 면접 일정 통합 표시
- 이전 달과 다음 달 이동
- 면접 회사, 직무, 날짜, 유형과 메모 등록
- 면접 일정 수정 및 삭제
- 홈과 일정 화면의 데이터 연동

### 내 정보

- 이름, 희망 직무, 이메일, 연락처, 거주 지역과 한 줄 소개
- 학교, 전공과 재학 기간
- 보유 기술을 쉼표로 구분해 관리
- 경력 및 프로젝트 경험 추가
- GitHub와 포트폴리오 URL 관리
- PDF 이력서 업로드, 열람과 삭제

### 공고 보관함과 AI

- 회사, 직무, 마감일, URL과 공고 본문 저장
- 공고 본문에서 기술, 담당 업무, 필수 요건과 우대 사항 분석
- 공고의 핵심 기술과 저장된 경력 경험 연결
- 공고에서 지원 기록 생성
- 공고와 선택한 경력 정보를 바탕으로 지원 문서 초안 생성
- OpenAI API가 없거나 호출에 실패하면 로컬 규칙 기반 분석기로 자동 전환
- 생성 문서에는 연결한 경력 근거와 부족한 정보에 대한 경고 포함

### 반응형 UI

- 기본 다크 모드
- 눈에 강하게 튀는 원색 대신 낮은 채도의 로즈 계열 강조색 사용
- PC에서는 고정 사이드바와 넓은 콘텐츠 영역 제공
- 모바일에서는 홈, 지원, 일정, 내 정보의 하단 4개 핵심 탭 제공
- 공고, 지원 문서와 면접 등의 세부 기능은 각 화면 또는 더보기 메뉴에서 접근
- 500px 이하 모바일과 1440px PC 화면에서 브라우저 렌더링 확인

## 기술 구성

| 영역 | 구현 |
| --- | --- |
| 프론트엔드 | HTML, CSS, Vanilla JavaScript |
| API 서버 | Node.js 기본 `http` 모듈 |
| 데이터 저장 | 사용자별 JSON 영속 저장소 |
| 인증 | Google OAuth 2.0, PKCE, 쿠키 세션 |
| AI | OpenAI Responses API, 로컬 대체 생성기 |
| 파일 | 사용자별 로컬 PDF 저장소 |
| 테스트 | Node.js 기반 전체 API 통합 테스트 |

외부 런타임 패키지가 없으므로 `npm install` 없이 실행할 수 있습니다.

## 실행 방법

Node.js 18 이상이 필요합니다.

```powershell
npm.cmd start
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:4173
```

개발 환경에서 Google 키가 비어 있으면 `Google로 계속하기`를 눌렀을 때 로컬 테스트 사용자로 로그인합니다. 입력한 데이터는 기본적으로 `.data/db.json`에 저장됩니다.

## 환경 변수

[.env.example](./.env.example)을 `.env`로 복사해서 사용합니다. 서버는 실행 시 `.env`를 자동으로 읽으며, 이미 설정된 시스템 환경 변수를 우선합니다.

```env
PORT=4173
NODE_ENV=development
FOLIO_DATA_DIR=.data
APP_ORIGIN=http://localhost:4173

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4173/api/v1/auth/google/callback

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

`.env`와 `.data`는 Git에 포함되지 않습니다.

## 실제 Google 로그인 연결

1. Google Cloud Console에서 OAuth 2.0 Web Client를 생성합니다.
2. 승인된 리디렉션 URI에 아래 주소를 등록합니다.

```text
http://localhost:4173/api/v1/auth/google/callback
```

3. 발급된 값을 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력합니다.
4. 배포 시 `APP_ORIGIN`과 `GOOGLE_REDIRECT_URI`를 실제 HTTPS 주소로 변경합니다.
5. 운영 환경에서는 `NODE_ENV=production`을 사용해 세션 쿠키에 Secure 속성이 적용되도록 합니다.

## 실제 AI 연결

서버의 `.env`에 OpenAI API 키를 설정합니다. API 키는 브라우저 코드나 `config.js`에 넣지 않습니다.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

키가 설정되면 다음 기능이 OpenAI Responses API를 사용합니다.

- 채용 공고 핵심 요건 분석
- 사용자 경력에 근거한 지원서 초안 생성

키가 없거나 요청에 실패해도 동일한 응답 구조를 반환하는 로컬 분석기와 문서 생성기가 동작합니다.

## 데이터 저장 방식

기본 데이터 경로는 다음과 같습니다.

```text
.data/
├── db.json
└── uploads/
    └── {userId}/
```

- `db.json`에는 사용자, 세션과 워크스페이스 데이터가 저장됩니다.
- 업로드한 PDF는 사용자 ID별 디렉터리에 분리됩니다.
- PDF만 업로드할 수 있으며 확장자, MIME 타입과 `%PDF-` 파일 시그니처를 검사합니다.
- 파일 크기는 최대 5MB입니다.
- 파일 조회와 삭제에는 해당 사용자의 인증 세션이 필요합니다.

현재 JSON 저장소는 개인 사용과 MVP 검증에 적합합니다. 여러 서버 인스턴스 또는 다수 사용자를 운영할 때는 PostgreSQL 등의 데이터베이스와 객체 스토리지로 교체하는 것이 좋습니다.

## 주요 API

모든 응답은 성공 시 `{ "data": ... }`, 실패 시 `{ "message", "code", "details" }` 형식을 사용합니다.

| 기능 | Method | Endpoint |
| --- | --- | --- |
| 상태 확인 | GET | `/api/v1/health` |
| Google 로그인 | GET | `/api/v1/auth/google` |
| 로그인 콜백 | GET | `/api/v1/auth/google/callback` |
| 현재 세션 | GET | `/api/v1/auth/session` |
| 로그아웃 | POST | `/api/v1/auth/logout` |
| 초기 데이터 | GET | `/api/v1/bootstrap` |
| 프로필 저장 | PUT | `/api/v1/profile` |
| 경력 추가 | POST | `/api/v1/career-stories` |
| 공고 저장 | POST | `/api/v1/jobs` |
| 지원 생성 | POST | `/api/v1/applications` |
| 지원 수정·삭제 | PATCH, DELETE | `/api/v1/applications/:id` |
| 할 일 생성 | POST | `/api/v1/tasks` |
| 할 일 수정 | PATCH | `/api/v1/tasks/:id` |
| 면접 일정 생성 | POST | `/api/v1/interviews` |
| 면접 일정 수정·삭제 | PATCH, DELETE | `/api/v1/interviews/:id` |
| 문서 생성 | POST | `/api/v1/documents` |
| 문서 저장 | PUT | `/api/v1/documents/:id` |
| PDF 업로드 | POST | `/api/v1/files` |
| PDF 조회·삭제 | GET, DELETE | `/api/v1/files/:id` |
| 공고 AI 분석 | POST | `/api/v1/ai/jobs/analyze` |
| 지원서 AI 생성 | POST | `/api/v1/ai/documents/generate` |
| 내 데이터 초기화 | POST | `/api/v1/workspace/reset` |

자세한 요청과 응답 계약은 [BACKEND_API.md](./BACKEND_API.md)를 참고합니다.

## 프론트엔드와 별도 백엔드 연결

[config.js](./config.js)의 API 주소를 변경하면 동일한 계약을 구현한 외부 백엔드를 사용할 수 있습니다.

```js
window.FOLIO_CONFIG = Object.freeze({
  useMockBackend: false,
  apiBaseUrl: '/api/v1',
  googleLoginPath: '/auth/google',
  requestTimeoutMs: 15000
});
```

외부 도메인을 사용하면 `apiBaseUrl`을 전체 HTTPS 주소로 변경하고, 백엔드에서 credential을 포함한 CORS 요청을 허용해야 합니다.

## 프로젝트 구조

```text
.
├── index.html          # 애플리케이션 화면과 모달
├── styles.css          # 다크 모드 및 반응형 레이아웃
├── app.js              # 화면 렌더링과 사용자 상호작용
├── api.js              # 프론트엔드 API 클라이언트
├── config.js           # API 연결 설정
├── server.js           # 정적 서버, 인증, 데이터, 파일과 AI API
├── test-server.js      # 서버 전체 흐름 통합 테스트
├── BACKEND_API.md      # 상세 백엔드 API 계약
├── plan.md             # 제품 기획과 정보 구조
├── .env.example        # 환경 변수 예시
└── package.json        # 실행 및 검사 명령
```

## 검사

JavaScript 문법 검사:

```powershell
npm.cmd run check
```

서버 통합 테스트:

```powershell
npm.cmd test
```

통합 테스트는 임시 데이터 디렉터리에서 다음 흐름을 검증합니다.

```text
상태 확인
→ 인증되지 않은 요청 차단
→ 개발용 Google 로그인
→ 세션 및 초기 데이터
→ 프로필
→ 지원 CRUD
→ 할 일
→ 면접 CRUD
→ AI 로컬 대체 경로
→ 문서 생성
→ PDF 검증·업로드·다운로드
→ 사용자 데이터 초기화
→ 로그아웃
```

## 현재 남은 운영 과제

- JSON 저장소를 PostgreSQL 등 운영용 데이터베이스로 이전
- PDF 저장소를 S3, Cloudflare R2 등의 객체 스토리지로 이전
- 경력, 공고, 할 일과 문서의 세부 수정·삭제 기능 확대
- 지원 문서 버전 이력과 제출본 보존
- 개인정보 처리방침, 이용약관과 계정 탈퇴 기능
- 오류 수집, 모니터링, 백업과 복구 정책
- 실제 모바일 기기 및 주요 브라우저 회귀 테스트
