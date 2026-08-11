# Synology DS718+ Cloudflare Tunnel 배포 순서

이 문서는 공유기 포트를 개방하지 않고 Synology DS718+의 Folio 백엔드를 Vercel 프론트엔드에 연결하는 실제 작업 순서를 설명합니다.

```text
사용자
  → https://folio.yuris.io
  → Vercel
  → /api/v1/* Rewrite
  → https://folio-backend.yuris.io
  → Cloudflare Tunnel
  → cloudflared 컨테이너
  → folio 컨테이너:4173
```

이 구성에서는 공유기 포트 포워딩, Synology DDNS, DSM 리버스 프록시, NAS용 외부 인증서가 필요하지 않습니다.

## 현재 진행 상태

- [x] `yuris.io`를 Cloudflare에서 관리
- [x] 원격 관리 Tunnel `folio-nas` 생성
- [x] Docker Connector용 Tunnel 토큰 확인
- [x] NAS Compose에 Folio와 `cloudflared` 함께 구성
- [ ] NAS 프로젝트 실행 및 Connector 연결
- [ ] Published application 생성
- [ ] Tunnel 상태 API 확인
- [ ] Vercel Rewrite 연결

Cloudflare 화면의 **Waiting for connector**는 오류가 아닙니다. Tunnel만 생성됐고 NAS에서 `cloudflared`가 아직 정상 실행되지 않았다는 뜻입니다.

## 지금 중단할 작업

Container Manager의 **이미지 → 실행**에서 `cloudflared`만 단독으로 만들지 않습니다. 실행 명령과 Docker 네트워크가 최종 Folio 프로젝트와 분리되기 때문입니다.

이미 만들어 둔 `folio-tunnel` 컨테이너가 시작 직후 종료된다면 해당 컨테이너만 삭제합니다. 이 컨테이너에는 사용자 데이터가 없으므로 Folio 데이터에는 영향이 없습니다. Cloudflare Dashboard에서 만든 Tunnel과 토큰은 삭제하지 않습니다.

이제부터 Folio와 `cloudflared`를 하나의 Compose 프로젝트로 실행합니다.

## 1. 저장소의 NAS Compose 준비

코드에서 먼저 다음 변경을 완료해야 합니다.

- `compose.nas.yaml`에 `cloudflared` 서비스 추가
- Folio의 호스트 포트 매핑 제거
- Folio는 Docker 내부 `4173` 포트만 노출
- Tunnel 토큰은 `cloudflared`에만 전달
- Folio와 `cloudflared`를 같은 Compose 네트워크에 배치

목표 Compose 구조:

```yaml
services:
  folio:
    image: ghcr.io/yuris99/folio:latest
    container_name: folio
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4173
      FOLIO_DATA_DIR: /data
      APP_ORIGIN: "${APP_ORIGIN}"
      GOOGLE_REDIRECT_URI: "${GOOGLE_REDIRECT_URI}"
      GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
      GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET}"
      AI_PROVIDER: "${AI_PROVIDER}"
      GEMINI_API_KEY: "${GEMINI_API_KEY}"
      GEMINI_DEFAULT_MODEL: "${GEMINI_DEFAULT_MODEL}"
      GEMINI_EXTRACTION_MODEL: "${GEMINI_EXTRACTION_MODEL}"
      GEMINI_WRITING_MODEL: "${GEMINI_WRITING_MODEL}"
    volumes:
      - "${FOLIO_DATA_PATH}:/data"
    expose:
      - "4173"
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:4173/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: folio-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: "${CLOUDFLARE_TUNNEL_TOKEN}"
    depends_on:
      - folio
```

`ports`가 아니라 `expose`를 사용하므로 NAS의 4173 포트는 외부에 공개되지 않습니다. `cloudflared`도 외부에서 들어오는 포트를 사용하지 않습니다.

> [!IMPORTANT]
> 로컬 개발용 `compose.yaml`이 아니라 NAS 전용 `compose.nas.yaml`을 사용합니다.

## 2. NAS 폴더 준비

DSM의 **File Station**에서 다음 폴더를 만듭니다.

```text
/volume1/docker/Folio
/volume1/docker/folio-data
```

GitHub의 최신 `compose.nas.yaml`을 내려받습니다. 파일 내용에 `cloudflared`, `TUNNEL_TOKEN`, `expose`가 있고 Folio의 `ports` 항목이 없는지 확인합니다.

내려받은 `compose.nas.yaml`의 이름을 `compose.yaml`로 바꿔 NAS에 업로드합니다.

```text
/volume1/docker/Folio/compose.yaml
```

Tunnel 토큰을 포함한 `.env`까지 준비한 뒤 Container Manager 프로젝트를 생성합니다.

## 3. NAS `.env` 준비

다음 파일을 만듭니다.

```text
/volume1/docker/Folio/.env
```

목표 환경 변수:

```env
NODE_ENV=production
APP_ORIGIN=https://folio.yuris.io

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://folio.yuris.io/api/v1/auth/google/callback

AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_DEFAULT_MODEL=gemini-3.6-flash
GEMINI_EXTRACTION_MODEL=gemini-3.5-flash-lite
GEMINI_WRITING_MODEL=gemini-3.5-flash

FOLIO_DATA_PATH=/volume1/docker/folio-data
CLOUDFLARE_TUNNEL_TOKEN=Cloudflare에서_복사한_긴_토큰
```

Tunnel 연결만 먼저 확인할 때 Google과 Gemini 값은 비워둘 수 있습니다. 실제 로그인과 AI 테스트 전에는 반드시 입력합니다.

보안 주의 사항:

- Tunnel 토큰을 GitHub에 올리지 않습니다.
- Tunnel 토큰을 다른 사람에게 보내지 않습니다.
- `.env`를 Vercel에 업로드하지 않습니다.
- 토큰이 노출되면 Cloudflare에서 새 토큰을 발급합니다.

## 4. Container Manager 프로젝트 생성

DSM에서 다음 메뉴로 이동합니다.

```text
Container Manager
→ 프로젝트
→ 생성
```

다음 값을 입력합니다.

```text
프로젝트 이름: folio
프로젝트 경로: /volume1/docker/Folio
Compose 파일: /volume1/docker/Folio/compose.yaml
```

프로젝트를 생성하고 시작합니다. 다음 두 컨테이너가 생성되어야 합니다.

```text
folio
folio-tunnel
```

두 컨테이너가 모두 **실행 중**인지 확인합니다. `folio-tunnel`은 별도의 실행 명령을 DSM 화면에서 입력하지 않습니다. Compose의 다음 줄이 실행 명령을 담당합니다.

```yaml
command: tunnel --no-autoupdate run
```

## 5. Connector 연결 확인

Container Manager에서 확인합니다.

```text
컨테이너
→ folio-tunnel
→ 로그
```

다음과 비슷한 문구가 나오면 정상입니다.

```text
Registered tunnel connection
```

Cloudflare Dashboard로 돌아갑니다.

```text
Networking
→ Tunnels
→ folio-nas
```

상태가 다음처럼 바뀌어야 합니다.

```text
Waiting for connector
→ Healthy
```

여기까지 확인된 후에만 다음 단계로 이동합니다.

## 6. Published application 생성

`folio-nas` Tunnel의 Route를 추가합니다.

```text
Routes
→ Add route
→ Published application
```

다음 값을 입력합니다.

```text
Subdomain: folio-backend
Domain: yuris.io
Path: 비워두기
Service type: HTTP
Service URL: folio:4173
```

저장 후 Cloudflare가 다음 주소를 관리합니다.

```text
https://folio-backend.yuris.io
```

`localhost:4173`이 아니라 `folio:4173`을 사용해야 합니다. `localhost`는 `cloudflared` 컨테이너 자신을 의미하고, `folio`는 같은 Compose 네트워크의 백엔드 컨테이너를 의미합니다.

## 7. Tunnel 백엔드 검사

외부 브라우저에서 다음 주소를 엽니다.

```text
https://folio-backend.yuris.io/api/v1/health
```

정상 응답 예시:

```json
{
  "data": {
    "status": "ok"
  }
}
```

이 검사가 성공하기 전에는 Vercel 연결을 진행하지 않습니다.

## 8. Vercel Rewrite 연결

Vercel 프론트는 다음 Rewrite를 사용합니다.

```json
{
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://folio-backend.yuris.io/api/v1/:path*"
    }
  ]
}
```

Vercel 배포 후 다음 주소를 확인합니다.

```text
https://folio.yuris.io/api/v1/health
```

Tunnel 주소와 Vercel 주소가 모두 정상 응답해야 합니다.

## 9. Google OAuth 연결

NAS `.env`:

```env
APP_ORIGIN=https://folio.yuris.io
GOOGLE_REDIRECT_URI=https://folio.yuris.io/api/v1/auth/google/callback
```

Google Cloud Console:

```text
승인된 JavaScript 원본:
https://folio.yuris.io

승인된 리디렉션 URI:
https://folio.yuris.io/api/v1/auth/google/callback
```

OAuth callback은 Tunnel 주소가 아니라 사용자가 접속하는 Vercel 주소를 기준으로 합니다.

## 문제 해결

### `folio-tunnel`이 시작 직후 종료

- `CLOUDFLARE_TUNNEL_TOKEN` 값이 비어 있지 않은지 확인합니다.
- 토큰 앞뒤의 공백을 제거합니다.
- Compose에 `command: tunnel --no-autoupdate run`이 있는지 확인합니다.
- Container Manager의 이미지 실행 기능으로 만든 단독 컨테이너가 아니라 Compose 프로젝트의 컨테이너인지 확인합니다.

### Tunnel이 계속 Waiting

- `folio-tunnel` 컨테이너가 실행 중인지 확인합니다.
- `folio-tunnel` 로그를 확인합니다.
- NAS가 외부 인터넷에 연결되는지 확인합니다.
- 현재 Tunnel에서 발급된 토큰인지 확인합니다.

### `502 Bad Gateway`와 `lookup folio: no such host`

Folio와 `cloudflared`가 같은 Compose 네트워크에 있지 않은 상태입니다. 두 서비스를 하나의 Container Manager 프로젝트로 실행합니다.

### `connection refused`

- `folio` 컨테이너의 실행 상태를 확인합니다.
- `folio` 로그와 상태 검사를 확인합니다.
- Published application의 Service URL이 `http://folio:4173`인지 확인합니다.

### `EACCES: permission denied` 또는 오류 코드 `-13`

NAS 데이터 폴더의 소유권과 컨테이너 실행 사용자가 일치하지 않는 상태입니다. 최신 Folio 이미지는 시작할 때 `/data`의 소유권만 안전하게 정리한 뒤 일반 `node` 사용자로 권한을 낮춥니다.

1. GitHub Actions의 최신 이미지 발행이 성공했는지 확인합니다.
2. Container Manager에서 Folio 프로젝트를 중지합니다.
3. 최신 `ghcr.io/yuris99/folio:latest` 이미지를 가져옵니다.
4. Folio 프로젝트를 다시 생성합니다.
5. `folio` 로그에서 쓰기 권한 오류가 사라졌는지 확인합니다.

NAS의 `folio-data` 폴더를 `Everyone` 쓰기 권한으로 열거나 Folio 애플리케이션을 계속 root로 실행하지 않습니다.

## 최종 보안 체크리스트

- [ ] 공유기에 Folio용 포트 포워딩이 없음
- [ ] DSM 5000/5001을 외부에 공개하지 않음
- [ ] Folio Compose에 호스트 `ports` 매핑이 없음
- [ ] Tunnel 토큰이 NAS `.env`에만 있음
- [ ] Google 및 Gemini Secret이 NAS에만 있음
- [ ] `/volume1/docker/folio-data`를 정기 백업

## 공식 참고 문서

- [Cloudflare 원격 관리 Tunnel 생성](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)
- [Cloudflared Tunnel 토큰과 실행 파라미터](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/cloudflared-parameters/run-parameters/)
