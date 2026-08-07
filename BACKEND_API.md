# Folio 백엔드 연결 계약

현재 프로젝트에는 이 계약을 구현한 Node.js 백엔드가 포함되어 있으며 [config.js](./config.js)는 동일 출처의 `/api/v1`을 사용한다. 별도 백엔드로 교체할 때도 아래 계약을 유지하면 프론트엔드를 수정하지 않고 연결할 수 있다.

## 공통 규칙

- API prefix: `/api/v1`
- 인증: HttpOnly, Secure, SameSite=Lax 세션 쿠키 권장
- 요청/응답: `application/json`
- 성공 응답: `{ "data": ... }`
- 실패 응답: `{ "message": "사용자 메시지", "code": "ERROR_CODE", "details": {} }`
- 프론트엔드 origin에 대해 credential 포함 CORS 허용
- 모든 사용자 데이터 API는 인증된 사용자 ID로 범위를 제한
- API 응답은 `Cache-Control: no-store`로 캐시하지 않음
- 정적 페이지와 API에 CSP, 클릭재킹 방지, MIME 스니핑 방지 헤더 적용
- 운영 환경에서는 HSTS와 Secure 세션 쿠키 적용

## Google 로그인

### `GET /api/v1/auth/google?returnTo={frontendUrl}`

Google OAuth 2.0 Authorization Code Flow를 시작한다. 백엔드는 `state`, `nonce`, PKCE를 생성하고 Google 인증 화면으로 리디렉션한다.

콜백 처리 후 백엔드는 세션 쿠키를 설정하고 검증된 `returnTo`로 사용자를 돌려보낸다. 임의 외부 URL로 리디렉션하지 않도록 허용 origin을 검사한다.

필요한 Google OAuth 환경 변수 예시:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_ORIGIN=http://localhost:4173
GOOGLE_REDIRECT_URI=http://localhost:4173/api/v1/auth/google/callback
```

### `GET /api/v1/auth/session`

```json
{
  "data": {
    "id": "user_uuid",
    "name": "홍길동",
    "email": "user@example.com",
    "avatarUrl": "https://..."
  }
}
```

미인증 상태는 `401`을 반환한다.

### `POST /api/v1/auth/logout`

세션을 폐기하고 `204`를 반환한다.

## 초기 데이터

### `GET /api/v1/bootstrap`

첫 화면에 필요한 데이터를 한 번에 반환한다.

```json
{
  "data": {
    "profile": {},
    "stories": [],
    "jobs": [],
    "applications": [],
    "tasks": [],
    "docs": [],
    "interviews": []
  }
}
```

필드명은 현재 [app.js](./app.js)의 `seed` 구조를 기준으로 한다. 운영 단계에서는 ISO 8601 날짜와 UUID 사용을 권장한다.

## 지원 관리

- `POST /api/v1/applications` — 지원 생성
- `PATCH /api/v1/applications/:id` — 지원 일부 수정 및 상태 변경
- `DELETE /api/v1/applications/:id` — 지원 삭제

생성/수정 payload:

```json
{
  "company": "회사명",
  "role": "Frontend Developer",
  "status": "작성 중",
  "deadline": "2026-08-30",
  "next": "자기소개서 검토",
  "url": "https://...",
  "memo": "채용 담당자 연락처 등"
}
```

지원 상태 enum:

```text
관심 | 작성 중 | 지원 완료 | 서류 통과 | 면접 | 합격 | 탈락
```

지원 삭제 시 연결된 문서와 면접 기록은 즉시 삭제보다 soft delete 또는 사용자 확인 정책을 권장한다.

## 내 정보와 경험

- `PUT /api/v1/profile` — 기본 정보 전체 저장
- `POST /api/v1/career-stories` — 경력/프로젝트 추가
- 후속 구현: `PATCH/DELETE /career-stories/:id`

프로필에는 이름, 희망 직무, 이메일, 연락처, 거주 지역, 소개, 학력, 기간, 기술 목록과 포트폴리오 링크가 포함된다.

## 문서

- `POST /api/v1/documents` — 회사별 문서 생성
- `PUT /api/v1/documents/:id` — 문서 본문 저장

운영 환경에서는 `Document`와 `DocumentVersion`을 분리해 제출 시점의 본문을 보존한다.

## 공고

- `POST /api/v1/jobs` — 공고 저장

## 할 일과 일정

- `POST /api/v1/tasks` — 할 일 생성
- `PATCH /api/v1/tasks/:id` — 완료 여부 등 일부 수정
- `POST /api/v1/interviews` — 면접 일정 생성
- `PATCH /api/v1/interviews/:id` — 면접 일정과 메모 수정
- `DELETE /api/v1/interviews/:id` — 면접 일정 삭제

면접 일정은 `company`, `role`, `date`, `type`, `memo`를 받으며 생성 후 날짜순으로 정렬된다.

## PDF 파일

- `POST /api/v1/files` — PDF 업로드
- `GET /api/v1/files/:id` — 인증된 사용자의 PDF 열람
- `DELETE /api/v1/files/:id` — PDF 삭제

현재 업로드 형식은 아래와 같은 JSON이다. 서버는 확장자, MIME 타입, PDF 시그니처와 5MB 제한을 모두 확인한다.

```json
{
  "name": "resume.pdf",
  "type": "application/pdf",
  "data": "data:application/pdf;base64,..."
}
```

대용량 파일이나 객체 스토리지를 연결할 때는 이 엔드포인트를 presigned URL 방식으로 교체할 수 있다.

## 워크스페이스 초기화

- `POST /api/v1/workspace/reset` — 현재 로그인 사용자의 데이터만 빈 워크스페이스로 초기화

초기화 시 해당 사용자가 업로드한 PDF 원본도 함께 삭제한다.

## 데이터 내보내기와 계정 탈퇴

- `GET /api/v1/account/export` — 사용자 정보와 워크스페이스를 JSON 파일로 내보내기
- `DELETE /api/v1/account` — 사용자, 모든 세션, 워크스페이스와 업로드 파일 영구 삭제

내보내기 응답에는 내부 파일 저장명이 포함되지 않는다. 계정 탈퇴가 완료되면 세션 쿠키도 즉시 만료된다.

## AI 연결

AI API 키는 브라우저에 두지 않고 반드시 백엔드에서 관리한다.

### `POST /api/v1/ai/jobs/analyze`

입력:

```json
{
  "company": "회사명",
  "role": "직무명",
  "deadline": "2026-08-30",
  "url": "https://...",
  "description": "공고 본문"
}
```

출력:

```json
{
  "data": {
    "skills": ["React", "TypeScript"],
    "responsibilities": [],
    "requirements": [],
    "preferredQualifications": []
  }
}
```

### `POST /api/v1/ai/documents/generate`

입력:

```json
{
  "jobId": "job_uuid",
  "documentType": "cover_letter",
  "careerStoryIds": ["story_uuid"]
}
```

출력:

```json
{
  "data": {
    "id": "document_uuid",
    "title": "회사명 · 맞춤 지원서",
    "content": "생성된 초안",
    "citations": [{ "sentence": 1, "careerStoryId": "story_uuid" }],
    "warnings": []
  }
}
```

생성 시 저장된 사용자 경험만 근거로 사용하고, 근거가 없는 수치나 경력을 만들지 않도록 서버 측 검증을 둔다.

## 구현 상태

위 계약은 현재 포함된 [server.js](./server.js)에 구현되어 있다. 운영 데이터베이스나 별도 API 서버로 교체할 때 응답 형태와 쿠키 인증 방식을 유지하면 프론트엔드는 그대로 사용할 수 있다.
