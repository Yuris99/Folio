# Folio

전체 운영 배포 절차는 [SETUP_GUIDE.md](./SETUP_GUIDE.md), Cloudflare Tunnel 설정은 [CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md), Vercel 배포는 [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md), GitHub Actions와 개인 NAS 자동 배포 설정은 [GITHUB_ACTIONS.md](./GITHUB_ACTIONS.md)를 참고하세요.

Folio는 여러 이력서를 검증된 커리어 데이터로 통합하고, 그 데이터를 ChatGPT 같은 LLM에서 재사용하면서 지원 현황과 일정을 함께 관리하는 개인용 워크스페이스입니다.

현재 저장소에는 React·TypeScript·Vite 반응형 프론트엔드와 Node.js API 서버가 함께 구현되어 있습니다. Google OAuth와 AI API 키를 등록하면 실제 외부 서비스와 연결됩니다.

## 현재 구현 상태

### 로그인과 사용자 데이터

- Google OAuth 2.0 Authorization Code Flow, PKCE와 `state` 검증
- HttpOnly, SameSite=Lax 쿠키 기반 14일 세션
- 만료 세션 자동 정리와 SIGTERM/SIGINT 정상 종료 처리
- 로그인 사용자별 독립 워크스페이스
- 로그아웃과 현재 사용자 세션 조회
- 개발 환경에서 Google 키가 없을 경우 로컬 테스트 계정 제공
- 운영 환경에서 Google 설정이 없으면 명시적인 설정 오류 반환
- CSP, HSTS, 클릭재킹 방지, MIME 스니핑 방지와 개인정보 API 캐시 차단 헤더

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
- ChatGPT 등 외부 채팅에서 작성한 자기소개서 보관
- 자소서 생성 기능과 문서 관리 기능을 분리해 회사별 최종본에 집중

### 일정과 면접

- 월간 달력에서 지원 마감일과 면접 일정 통합 표시
- 이전 달과 다음 달 이동
- 면접 회사, 직무, 날짜, 유형과 메모 등록
- 면접 일정 수정 및 삭제
- 홈과 일정 화면의 데이터 연동

### 커리어 데이터 보관함

- 여러 PDF 이력서, 포트폴리오와 텍스트 경력 메모를 원본으로 등록
- 원본별 학력, 경력, 프로젝트, 기술, 자격과 활동 정보를 구조화
- 추출 결과를 `검토 필요 · 확인 완료 · 제외` 상태로 관리
- 비슷한 항목을 중복 가능성으로 표시하고 원본 이름을 근거로 보존
- 기존 상세 프로필을 첫 접근 시 새 커리어 데이터로 자동 이전
- 사용자 확인을 마친 정보만 기본 내보내기에 포함
- 개인정보 포함 여부와 검토 중 정보 포함 여부를 직접 선택
- ChatGPT에 바로 붙여넣을 Markdown과 자동화용 JSON 미리보기·복사·다운로드
- 상단 사용 가이드와 빈 화면별 다음 행동 안내
- 전체 워크스페이스 JSON 백업과 계정 삭제

### 공고 보관함과 AI

- 회사, 직무, 마감일, URL과 공고 본문 저장
- 공고 본문에서 기술, 담당 업무, 필수 요건과 우대 사항 분석
- 공고의 핵심 기술과 확인 완료된 커리어 데이터 연결
- 공고에서 지원 기록 생성
- OpenAI 연결 시 PDF·텍스트 이력서에서 커리어 항목 추출
- API가 없거나 추출에 실패해도 텍스트 붙여넣기와 직접 입력으로 사용 가능

### 반응형 UI

- 기본 다크 모드
- 눈에 강하게 튀는 원색 대신 낮은 채도의 로즈 계열 강조색 사용
- PC에서는 고정 사이드바와 넓은 콘텐츠 영역 제공
- 모바일에서는 홈, 지원, 일정, 커리어의 하단 4개 핵심 탭 제공
- 공고, 지원 문서와 면접 등의 세부 기능은 각 화면 또는 더보기 메뉴에서 접근
- 500px 이하 모바일과 1440px PC 화면에서 브라우저 렌더링 확인

## 기술 구성

| 영역 | 구현 |
| --- | --- |
| 프론트엔드 | React 19, TypeScript, Vite |
| API 서버 | Node.js 기본 `http` 모듈 |
| 데이터 저장 | 사용자별 JSON 영속 저장소 |
| 인증 | Google OAuth 2.0, PKCE, 쿠키 세션 |
| AI | Gemini 또는 OpenAI 기반 원본 구조화, 텍스트 대체 경로 |
| 파일 | 사용자별 로컬 PDF 저장소 |
| 테스트 | TypeScript 타입 검사, Vite 빌드, Node.js API 통합 테스트 |

## 실행 방법

Node.js 22 이상이 필요합니다. 먼저 의존성을 설치합니다.

```powershell
npm.cmd install
```

개발 시에는 API와 Vite를 각각 실행합니다.

```powershell
npm.cmd run dev:api
npm.cmd run dev
```

프론트엔드는 다음 주소에서 열립니다.

```text
http://localhost:5173
```

운영 빌드는 `npm.cmd run build`, 빌드된 프론트와 API 통합 실행은 `npm.cmd start`를 사용합니다. 입력한 데이터는 기본적으로 `.data/db.json`에 저장됩니다.

현재 로컬 `.env` 파일은 기본 주소와 빈 비밀값으로 준비되어 있습니다. 설정 상태만 확인하려면 다음 명령을 사용합니다.

```powershell
npm.cmd run preflight
```

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
OPENAI_MODEL=gpt-5.4-mini
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

### Google Calendar 단방향 동기화

1. 같은 Google Cloud 프로젝트에서 **Google Calendar API**를 활성화합니다.
2. OAuth 동의 화면에 `https://www.googleapis.com/auth/calendar.events` 범위를 추가합니다.
3. 일정 화면에서 `Google Calendar 연결`을 누르고 추가 권한에 동의합니다.
4. `Google Calendar 동기화`를 누르면 Folio의 공고 마감, 면접, 진행 예정 전형이 기본 캘린더에 생성·갱신됩니다. Google Calendar의 기존 일정은 Folio로 가져오지 않습니다.

## 실제 AI 연결

서버의 `.env`에서 Gemini 또는 OpenAI 중 하나를 선택합니다. API 키는 브라우저 코드나 `VITE_` 환경 변수에 넣지 않습니다.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_EXTRACTION_MODEL=gemini-3.5-flash-lite

# 또는
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

키가 설정되면 선택한 공급자의 API를 사용합니다.

- 채용 공고 핵심 요건 분석
- PDF·텍스트 이력서의 커리어 데이터 구조화

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
| 커리어 원본 등록 | POST | `/api/v1/career-sources` |
| 커리어 원본 분석 | POST | `/api/v1/career-sources/:id/extract` |
| 커리어 원본 삭제 | DELETE | `/api/v1/career-sources/:id` |
| 검증 항목 추가 | POST | `/api/v1/career-facts` |
| 검증 항목 수정·삭제 | PATCH, DELETE | `/api/v1/career-facts/:id` |
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
| 내 데이터 초기화 | POST | `/api/v1/workspace/reset` |
| 데이터 내보내기 | GET | `/api/v1/account/export` |
| 계정 탈퇴 | DELETE | `/api/v1/account` |

자세한 요청과 응답 계약은 [BACKEND_API.md](./BACKEND_API.md)를 참고합니다.

## 프론트엔드와 별도 백엔드 연결

기본적으로 동일 출처의 `/api/v1`을 사용합니다. Vercel에서는 [vercel.json](./vercel.json)의 Rewrite가 NAS 백엔드로 요청을 전달합니다. 직접 다른 API를 사용하려면 Vite 빌드 환경 변수 `VITE_API_BASE_URL`을 설정합니다.

## 프로젝트 구조

```text
.
├── index.html          # Vite 진입점
├── styles.css          # 다크 모드 및 반응형 레이아웃
├── src/                # React·TypeScript 프론트엔드
│   ├── components/      # 공통 레이아웃과 모달
│   ├── pages/           # 홈, 지원, 일정, 커리어 보관함 등 페이지
│   ├── hooks/           # 사용자·워크스페이스 상태
│   ├── api.ts           # 타입이 있는 API 클라이언트
│   └── types.ts         # 도메인 타입
├── vite.config.mts     # Vite 개발·빌드 설정
├── server.js           # 정적 서버, 인증, 데이터, 파일과 AI API
├── test-server.js      # 서버 전체 흐름 통합 테스트
├── Dockerfile          # 운영 컨테이너 이미지
├── compose.yaml        # 영구 데이터 볼륨을 포함한 실행 구성
├── render.yaml         # Render Blueprint 배포 구성
├── preflight.js        # 비밀값을 노출하지 않는 배포 사전 점검
├── DEPLOYMENT.md       # HTTPS, OAuth, 볼륨과 운영 점검 가이드
├── BACKEND_API.md      # 상세 백엔드 API 계약
├── plan.md             # 제품 기획과 정보 구조
├── .env.example        # 환경 변수 예시
└── package.json        # 실행 및 검사 명령
```

## 검사

TypeScript 타입과 Node.js 문법 검사:

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
→ 프로필과 커리어 원본·검증 데이터
→ 지원 CRUD
→ 할 일
→ 면접 CRUD
→ 커리어 추출 및 AI 로컬 대체 경로
→ 문서 생성
→ PDF 검증·업로드·다운로드
→ 사용자 데이터 초기화
→ 로그아웃
→ 데이터 내보내기와 계정 탈퇴
```

## 배포

Docker 이미지, 영구 볼륨을 포함한 Compose 구성과 Render Blueprint가 준비되어 있습니다. 실제 도메인, Google OAuth, OpenAI 키와 데이터 볼륨 설정은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고합니다.

운영용 값이 모두 준비되었는지 검사:

```powershell
npm.cmd run preflight:production
```

## 현재 남은 운영 과제

- JSON 저장소를 PostgreSQL 등 운영용 데이터베이스로 이전
- PDF 저장소를 S3, Cloudflare R2 등의 객체 스토리지로 이전
- 경력, 공고, 할 일과 문서의 세부 수정·삭제 기능 확대
- 지원 문서 버전 이력과 제출본 보존
- 개인정보 처리방침과 이용약관
- 오류 수집, 모니터링, 백업과 복구 정책
- 실제 모바일 기기 및 주요 브라우저 회귀 테스트
