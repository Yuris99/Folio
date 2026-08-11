# Folio 운영 배포 체크리스트

이 문서는 Folio를 다음 구성으로 배포하기 위한 전체 작업을 정리합니다.

```text
사용자
  → https://folio.yuris.io
  → Vercel 프론트엔드
  → /api/v1/* 프록시
  → https://folio-backend.yuris.io
  → Cloudflare Tunnel
  → Synology DS718+ 백엔드
  → Gemini API
```

## 배포 환경

| 구분 | 설정 |
| --- | --- |
| 프론트엔드 | Vercel |
| 프론트 도메인 | `https://folio.yuris.io` |
| 백엔드 | Synology DS718+ Container Manager |
| Tunnel 주소 | `https://folio-backend.yuris.io` |
| Docker 이미지 | `ghcr.io/yuris99/folio:latest` |
| CPU 아키텍처 | `linux/amd64` |
| 인증 | Google OAuth 2.0 |
| AI | Gemini API |
| 데이터 저장 | `/volume1/docker/folio-data` |

## 현재 준비 상태

완료된 항목:

- 반응형 MVP 프론트엔드
- Node.js API 백엔드
- Google OAuth 초안
- 사용자별 JSON 데이터 저장
- Docker 이미지와 NAS용 Compose
- Cloudflare Tunnel이 포함된 NAS Compose
- Vercel 프론트 전용 빌드와 API Rewrite
- GitHub Actions 테스트 및 GHCR 발행
- `linux/amd64`, `linux/arm64` 이미지 지원
- Cloudflare 원격 관리 Tunnel `folio-nas` 생성
- Tunnel Connector 토큰 확인

현재 배포 상태:

```text
Cloudflare: Waiting for connector
다음 작업: NAS compose.yaml과 .env 업로드
```

코드 작업이 더 필요한 항목:

- OpenAI 전용 구현을 Gemini provider 구조로 변경
- 작업별 Gemini 모델 라우팅
- SSH가 없는 NAS를 위한 업데이트 방식 정리

최종 NAS 및 Vercel 배포는 위 코드 작업이 `main`에 반영된 후 진행합니다.

## 1. GitHub Container Package 공개

1. [Folio 컨테이너 패키지](https://github.com/Yuris99/Folio/pkgs/container/folio)에 접속합니다.
2. 오른쪽의 **Package settings**를 선택합니다.
3. **Danger Zone**으로 이동합니다.
4. **Change package visibility**를 선택합니다.
5. **Public**을 선택하고 확인 문구를 입력합니다.

공개 전환은 되돌릴 수 없습니다. 현재 Docker 이미지에는 `.env`, API 키, NAS 사용자 데이터가 포함되지 않으며 소스 저장소도 공개되어 있으므로 공개 이미지로 운영할 수 있습니다.

## 2. Synology 데이터 폴더 생성

DSM에서 **File Station**을 열고 다음 폴더를 생성합니다.

```text
docker/
├─ Folio/
└─ folio-data/
```

실제 절대 경로:

```text
/volume1/docker/Folio
/volume1/docker/folio-data
```

- `/volume1/docker/Folio`: Compose와 `.env` 저장
- `/volume1/docker/folio-data`: DB와 업로드한 PDF 영구 저장

`folio-data` 폴더 전체를 백업해야 합니다.

## 3. Cloudflare Tunnel

공유기 포트, Synology DDNS, DSM 리버스 프록시를 사용하지 않고 Cloudflare Tunnel로 NAS 백엔드를 연결합니다.

```text
https://folio-backend.yuris.io
→ Cloudflare Tunnel
→ cloudflared
→ folio:4173
```

전체 설정 절차는 [CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md)를 순서대로 진행합니다.

핵심 조건:

- `yuris.io` DNS를 Cloudflare에서 관리
- Tunnel 이름은 `folio-nas`
- Folio와 `cloudflared`를 같은 Compose 프로젝트에서 실행
- Tunnel 토큰은 NAS `.env`에만 저장
- Connector가 Healthy가 된 후 Published application 생성
- Published application 호스트는 `folio-backend.yuris.io`
- Service URL은 `http://folio:4173`
- 공유기 포트 포워딩은 생성하지 않음

## 4. 프론트엔드 DNS 설정

Vercel 프로젝트에 `folio.yuris.io`를 추가한 뒤 Vercel이 화면에 안내하는 DNS 레코드를 그대로 등록합니다.

```text
folio.yuris.io → Vercel
```

일반적으로 `folio` 서브도메인의 CNAME을 사용하지만, 실제 대상 값은 Vercel 화면에 표시되는 값을 사용합니다.

`folio-backend.yuris.io` 레코드는 Cloudflare Tunnel의 Published application 경로를 만들 때 Cloudflare가 관리합니다.

## 5. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 Folio용 프로젝트를 생성합니다.
2. Google Auth Platform 또는 OAuth 동의 화면에서 다음 값을 설정합니다.

```text
앱 이름: Folio
사용자 유형: 외부
지원 이메일: 본인 이메일
```

3. 앱이 테스트 상태라면 본인 Google 계정을 테스트 사용자로 추가합니다.
4. OAuth Client를 생성합니다.

```text
애플리케이션 유형: 웹 애플리케이션
이름: Folio Web
```

5. 승인된 JavaScript 원본을 등록합니다.

```text
https://folio.yuris.io
```

6. 승인된 리디렉션 URI를 등록합니다.

```text
https://folio.yuris.io/api/v1/auth/google/callback
```

7. `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을 발급받아 안전하게 보관합니다.

Google Secret은 GitHub 또는 Vercel 프론트 환경 변수에 등록하지 않고 NAS의 `.env`에만 저장합니다.

## 6. Gemini API 설정

1. [Google AI Studio](https://aistudio.google.com/)에 로그인합니다.
2. **Get API key**를 선택합니다.
3. Folio용 Google Cloud 프로젝트를 선택합니다.
4. API 키를 생성합니다.
5. 가능한 경우 키 사용 대상을 Gemini API로 제한합니다.
6. 실제 이력서 개인정보를 처리한다면 유료 결제 프로젝트 사용을 권장합니다.

발급받은 `GEMINI_API_KEY`는 NAS의 `.env`에만 저장합니다.

예정된 모델 라우팅:

| 작업 | 모델 |
| --- | --- |
| 일반 AI 작업 | `gemini-3.6-flash` |
| 공고 추출 및 분류 | `gemini-3.5-flash-lite` |
| 중요한 지원 문서 생성 | `gemini-3.5-flash` |

## 7. NAS 설정 파일 업로드

> [!IMPORTANT]
> 로컬 개발용 `compose.yaml`이 아니라 NAS 전용 `compose.nas.yaml`을 사용합니다.

GitHub에서 최신 `compose.nas.yaml`을 내려받습니다.

파일에 다음 항목이 있는지 확인합니다.

```text
cloudflared 서비스
TUNNEL_TOKEN 환경 변수
folio의 expose: 4173
folio의 ports 항목 없음
```

`compose.nas.yaml`을 NAS에 올릴 때 파일 이름을 `compose.yaml`로 바꿉니다.

다음 파일을 `/volume1/docker/Folio`에 업로드합니다.

```text
compose.yaml
.env
```

운영 `.env`의 목표 형태는 다음과 같습니다. Gemini 구현 과정에서 실제 변수 이름이 바뀌면 저장소의 최신 `.env.example`을 기준으로 사용합니다.

```env
NODE_ENV=production
PORT=4173
FOLIO_DATA_DIR=/data

APP_ORIGIN=https://folio.yuris.io
GOOGLE_REDIRECT_URI=https://folio.yuris.io/api/v1/auth/google/callback

GOOGLE_CLIENT_ID=발급받은_Client_ID
GOOGLE_CLIENT_SECRET=발급받은_Client_Secret

AI_PROVIDER=gemini
GEMINI_API_KEY=발급받은_API_Key
GEMINI_DEFAULT_MODEL=gemini-3.6-flash
GEMINI_EXTRACTION_MODEL=gemini-3.5-flash-lite
GEMINI_WRITING_MODEL=gemini-3.5-flash

FOLIO_DATA_PATH=/volume1/docker/folio-data
CLOUDFLARE_TUNNEL_TOKEN=Cloudflare에서_복사한_긴_토큰
```

주의 사항:

- 값 앞뒤에 불필요한 따옴표를 넣지 않습니다.
- `.env`를 GitHub에 올리지 않습니다.
- API 키를 Vercel 프론트에 넣지 않습니다.

## 8. Container Manager 프로젝트 생성

1. DSM에서 **Container Manager → 프로젝트 → 생성**으로 이동합니다.
2. 다음 값을 입력합니다.

```text
프로젝트 이름: folio
프로젝트 경로: /volume1/docker/Folio
Compose 파일: /volume1/docker/Folio/compose.yaml
```

3. 설정을 검증한 뒤 프로젝트를 생성하고 시작합니다.
4. Container Manager가 다음 이미지를 내려받는지 확인합니다.

```text
ghcr.io/yuris99/folio:latest
```

5. **Container Manager → 컨테이너 → folio**에서 상태가 실행 중 또는 정상인지 확인합니다.
6. 같은 네트워크의 브라우저에서 상태 API를 확인합니다.

```text
http://NAS_IP:4173/api/v1/health
```

정상 응답 예시:

```json
{
  "data": {
    "status": "ok",
    "googleConfigured": true,
    "aiConfigured": true
  }
}
```

## 9. Vercel 프로젝트 생성

Vercel 설정 파일이 `main`에 반영된 다음 진행합니다.

1. [Vercel](https://vercel.com/)에 로그인합니다.
2. **Add New → Project**를 선택합니다.
3. GitHub 계정을 연결합니다.
4. `Yuris99/Folio` 저장소를 선택합니다.
5. 저장소에 정의된 빌드 설정을 확인하고 배포합니다.
6. 배포가 성공하면 **Settings → Domains**에서 다음 도메인을 추가합니다.

```text
folio.yuris.io
```

7. Vercel이 안내하는 DNS 레코드를 DNS 관리 화면에 등록합니다.
8. 도메인과 HTTPS 인증서 상태가 정상으로 바뀔 때까지 기다립니다.

Vercel에는 프론트엔드 파일만 배포하며 Google Secret과 Gemini API 키는 등록하지 않습니다.

## 10. API 프록시와 OAuth 흐름

브라우저의 API 요청:

```text
https://folio.yuris.io/api/v1/*
```

Vercel이 전달하는 NAS API 주소:

```text
https://folio-backend.yuris.io/api/v1/*
```

Google 로그인 흐름:

```text
folio.yuris.io
→ Google 로그인
→ folio.yuris.io/api/v1/auth/google/callback
→ Vercel Rewrite
→ folio-backend.yuris.io의 Cloudflare Tunnel
→ NAS 백엔드
→ folio.yuris.io 복귀
```

따라서 Google Cloud와 NAS의 `GOOGLE_REDIRECT_URI`에는 백엔드 주소가 아니라 다음 프론트 주소를 사용합니다.

```text
https://folio.yuris.io/api/v1/auth/google/callback
```

## 11. 통합 테스트

다음 순서로 확인합니다.

- [ ] `https://folio.yuris.io` 접속
- [ ] Google 로그인
- [ ] 로그아웃 후 재로그인
- [ ] 내 정보 저장
- [ ] 새로고침 후 데이터 유지 확인
- [ ] 지원 기록 생성, 수정, 삭제
- [ ] 면접 일정 생성
- [ ] PDF 이력서 업로드
- [ ] 공고 URL 분석
- [ ] Gemini 지원 문서 생성
- [ ] 모바일 화면 확인
- [ ] NAS 컨테이너 재시작 후 데이터 유지 확인

문제가 생기면 **Container Manager → 컨테이너 → folio → 로그**에서 백엔드 로그를 확인합니다. API 키 자체가 로그에 출력되어서는 안 됩니다.

## 12. 업데이트

`main` 브랜치에 코드가 반영되면 GitHub Actions가 다음 과정을 수행합니다.

```text
문법 검사와 API 테스트
→ amd64/arm64 Docker 이미지 빌드
→ GHCR latest 발행
```

SSH를 사용하지 않는 초기 운영에서는 Container Manager에서 프로젝트를 다시 생성하거나 최신 이미지를 가져와 수동 적용합니다.

현재 `scripts/nas-update.sh`는 Git 저장소 갱신을 포함하므로 파일을 수동 업로드한 NAS 환경에는 그대로 사용하지 않습니다. 기본 배포가 정상 동작한 뒤 DSM 작업 스케줄러 전용 업데이트 방식을 별도로 적용합니다.

## 13. 백업

Synology Hyper Backup 등의 백업 도구로 다음 폴더 전체를 백업합니다.

```text
/volume1/docker/folio-data
```

주요 데이터:

```text
db.json
uploads/
```

최소 하루 한 번 백업하고, 주기적으로 복원 테스트를 진행합니다.

## 역할과 진행 순서

코드에서 처리할 항목:

- Gemini provider와 모델 라우팅
- Vercel 프론트 빌드와 Rewrite 완료
- NAS Compose 갱신 완료
- SSH 없는 업데이트 방식
- 통합 테스트와 GitHub 반영

사용자가 처리할 항목:

- GitHub Package 공개
- Synology 폴더 생성
- Cloudflare Tunnel 생성 완료
- Tunnel 토큰을 NAS `.env`에 입력
- Folio와 cloudflared를 같은 프로젝트로 실행
- Connector가 Healthy가 된 후 Published application 생성
- Google OAuth 발급
- Gemini API 키 발급
- NAS `.env` 입력
- Container Manager 프로젝트 생성
- Vercel 저장소와 도메인 연결

전체 진행 순서:

```text
1. Gemini와 Vercel 코드 반영
2. GHCR 새 이미지 발행 확인
3. NAS compose.yaml과 .env 준비
4. Container Manager에서 Folio 프로젝트 실행
5. Tunnel Connector가 Healthy인지 확인
6. folio-backend.yuris.io Published application 생성
7. Tunnel 상태 API 확인
8. Vercel 프론트와 folio.yuris.io 연결
9. Google OAuth 및 Gemini 키 입력
10. 통합 테스트
11. 자동 업데이트와 백업 설정
```
