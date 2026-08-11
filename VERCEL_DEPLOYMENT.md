# Vercel 프론트엔드 배포

Folio 프론트엔드는 Vercel에 정적 사이트로 배포하고 `/api/v1/*` 요청은 Cloudflare Tunnel의 NAS 백엔드로 전달합니다.

```text
https://folio.yuris.io
→ Vercel 정적 프론트엔드
→ /api/v1/* Rewrite
→ https://folio-backend.yuris.io
→ Cloudflare Tunnel
→ NAS 백엔드
```

## 빌드 구성

Vercel은 Vite 사이트를 빌드하고 `dist` 결과물을 배포합니다.

```text
src/
vite.config.mts
vercel.json
package.json의 build
```

빌드 결과에는 프론트 파일만 포함됩니다.

```text
dist/
├─ index.html
└─ assets/
   ├─ index-[hash].css
   └─ index-[hash].js
```

## 1. 사전 확인

Vercel을 연결하기 전에 Tunnel 백엔드가 정상이어야 합니다.

```text
https://folio-backend.yuris.io/api/v1/health
```

Tunnel이 아직 **Waiting for connector**라면 [CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md)를 먼저 진행합니다. 프론트 배포 자체는 가능하지만 API와 로그인은 Tunnel이 Healthy가 될 때까지 작동하지 않습니다.

## 2. 기존 Vercel 프로젝트가 있는 경우

현재 404가 표시되는 기존 Folio 프로젝트를 삭제하거나 새로 만들지 않습니다.

GitHub의 `main`에 Vercel 설정 커밋이 올라가면 Vercel GitHub 연동이 자동으로 새 Production Deployment를 시작합니다.

```text
Vercel Dashboard
→ Folio 프로젝트
→ Deployments
```

가장 최근 배포의 커밋이 Vercel 설정을 포함한 커밋인지 확인합니다. 자동 배포가 시작되지 않으면 프로젝트가 `Yuris99/Folio` 저장소의 `main` 브랜치에 연결되어 있는지 확인합니다.

## 3. 새 Vercel 프로젝트를 만드는 경우

1. [Vercel Dashboard](https://vercel.com/)에 GitHub 계정으로 로그인합니다.
2. **Add New → Project**를 선택합니다.
3. `Yuris99/Folio` 저장소를 찾습니다.
4. 저장소가 보이지 않으면 **Adjust GitHub App Permissions**에서 `Yuris99/Folio` 접근을 허용합니다.
5. 저장소 오른쪽의 **Import**를 선택합니다.

프로젝트 기본 설정:

```text
Project Name: folio
Framework Preset: Other
Root Directory: ./
```

저장소의 `vercel.json`이 다음 값을 지정하므로 Vercel 화면에서 별도로 Override하지 않습니다.

```text
Build Command: npm run build
Output Directory: dist
```

Vercel 환경 변수에는 Google, Gemini, Tunnel Secret을 입력하지 않습니다. 모든 서버 Secret은 NAS의 `.env`에만 둡니다.

## 4. 첫 빌드 확인

Vercel의 최신 Deployment를 열고 **Build Logs**를 확인합니다.

정상 빌드 로그에는 다음 문구가 표시됩니다.

```text
Built 5 frontend files in .../dist
```

배포 상태가 **Ready**가 되면 Vercel이 제공한 임시 주소를 엽니다.

```text
https://프로젝트이름.vercel.app
```

다음 항목을 확인합니다.

- Folio 화면 표시
- CSS와 JavaScript 정상 로드
- 브라우저 콘솔에 정적 파일 404가 없음

Tunnel이 Healthy라면 다음 API도 확인합니다.

```text
https://프로젝트이름.vercel.app/api/v1/health
```

## 5. folio.yuris.io 연결

Vercel 프로젝트에서 다음 메뉴로 이동합니다.

```text
Settings
→ Domains
→ Add Domain
```

다음 주소를 입력합니다.

```text
folio.yuris.io
```

Vercel이 이 프로젝트에 사용할 CNAME 대상을 표시합니다. Vercel 프로젝트마다 고유한 값이 나올 수 있으므로 화면에 표시된 값을 그대로 사용합니다.

Cloudflare Dashboard에서 다음 메뉴로 이동합니다.

```text
yuris.io
→ DNS
→ Records
→ Add record
```

다음 값을 입력합니다.

```text
Type: CNAME
Name: folio
Target: Vercel이 표시한 CNAME
Proxy status: DNS only
TTL: Auto
```

`folio-backend` Tunnel 레코드는 변경하지 않습니다.

Vercel Domains 화면에서 다음 상태를 확인합니다.

```text
Valid Configuration
```

Vercel이 `folio.yuris.io`용 HTTPS 인증서를 자동으로 발급한 뒤 다음 주소를 엽니다.

```text
https://folio.yuris.io
```

## 6. NAS와 Google OAuth 기준 주소

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

Vercel 임시 주소와 `folio-backend.yuris.io`는 Google OAuth 리디렉션 URI로 사용하지 않습니다.

NAS `.env`를 바꾸면 Container Manager에서 Folio 프로젝트를 다시 생성해 변경된 환경 변수를 적용합니다.

## 7. 최종 검사

다음 순서로 확인합니다.

- [ ] `https://folio-backend.yuris.io/api/v1/health`
- [ ] `https://folio.yuris.io`
- [ ] `https://folio.yuris.io/api/v1/health`
- [ ] Google 로그인
- [ ] 내 정보 저장
- [ ] 새로고침 후 데이터 유지
- [ ] 로그아웃 후 재로그인
- [ ] 모바일 화면

## 문제 해결

### `404: NOT_FOUND`

1. Vercel의 최신 Deployment 커밋을 확인합니다.
2. Build Logs에 `npm run build`가 있는지 확인합니다.
3. 로그에 `Built 5 frontend files`가 있는지 확인합니다.
4. Project의 Root Directory가 `./`인지 확인합니다.
5. Build Command와 Output Directory Override를 꺼서 `vercel.json`을 사용합니다.

### Deployment는 Ready인데 API가 502 또는 530

- `https://folio-backend.yuris.io/api/v1/health`를 먼저 확인합니다.
- Cloudflare Tunnel이 **Healthy**인지 확인합니다.
- Published application의 Service URL이 `http://folio:4173`인지 확인합니다.

### Google 로그인 후 원래 화면으로 돌아오지 않음

- NAS `APP_ORIGIN`을 확인합니다.
- NAS와 Google Cloud의 `GOOGLE_REDIRECT_URI`가 정확히 같은지 확인합니다.
- Vercel Rewrite가 `/api/v1/:path*`를 Tunnel 주소로 전달하는지 확인합니다.

## 자동 배포

Vercel GitHub 연동 후에는 `main` push마다 Production Deployment가 자동 실행됩니다. Pull Request에는 별도의 Preview Deployment가 생성됩니다.

## 공식 참고 문서

- [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github)
- [Vercel 사용자 도메인](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Rewrites](https://vercel.com/docs/rewrites)
