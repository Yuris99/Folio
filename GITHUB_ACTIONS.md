# GitHub Actions와 NAS 자동 배포

이 저장소는 공개 저장소이므로 NAS에 GitHub self-hosted runner를 직접 설치하지 않습니다. 공개 저장소의 Pull Request 코드가 개인 NAS에서 실행되는 위험을 피하기 위해 다음 구조를 사용합니다.

```text
main push
  ├─ CI: 문법 검사 → API 통합 테스트 → Docker 빌드 검사
  └─ Publish container: 문법 검사 → 테스트 → amd64/arm64 이미지 빌드 → GHCR 발행

NAS 예약 작업
  └─ 저장소 갱신 → GHCR 이미지 pull → 컨테이너 교체 → 상태 검사
```

## 등록된 워크플로

- `.github/workflows/ci.yml`: `main` push와 Pull Request마다 검사합니다.
- `.github/workflows/publish-container.yml`: `main`에 반영된 커밋을 `ghcr.io/yuris99/folio:latest`와 커밋 SHA 태그로 발행합니다.
- 이미지는 Intel/AMD NAS용 `linux/amd64`와 ARM NAS용 `linux/arm64`를 함께 지원합니다.
- 비밀 값은 이미지에 포함하지 않습니다. Google/OpenAI 설정은 NAS의 `.env`에만 둡니다.

## 1. 첫 Actions 실행 확인

코드를 GitHub에 push한 뒤 저장소의 **Actions** 탭에서 `CI`와 `Publish container`가 모두 성공하는지 확인합니다. 별도의 GitHub Secret은 필요하지 않으며 이미지 발행에는 워크플로 전용 `GITHUB_TOKEN`을 사용합니다.

## 2. GHCR 이미지 접근 설정

첫 발행 직후 컨테이너 패키지는 기본적으로 비공개입니다. 둘 중 하나를 선택합니다.

### 방법 A: 패키지를 공개로 전환

GitHub 프로필의 **Packages → folio → Package settings → Change visibility → Public**에서 변경합니다. 공개 패키지는 NAS에서 로그인 없이 pull할 수 있지만, 공개 전환은 되돌릴 수 없으므로 이미지 공개가 괜찮을 때만 선택합니다. 애플리케이션 비밀 값과 사용자 데이터는 이미지에 들어가지 않습니다.

### 방법 B: 패키지를 비공개로 유지

GitHub에서 `read:packages` 권한의 Personal Access Token(classic)을 만들고 NAS에서 한 번 로그인합니다. 토큰은 저장소나 `.env`에 커밋하지 않습니다.

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u Yuris99 --password-stdin
```

## 3. NAS 배포 폴더 준비

NAS에 SSH로 접속하여 원하는 Docker 공유 폴더에서 저장소를 clone합니다.

```sh
git clone https://github.com/Yuris99/Folio.git
cd Folio
cp .env.example .env
```

`.env`에 운영 값을 입력합니다.

```env
NODE_ENV=production
APP_ORIGIN=https://folio.example.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://folio.example.com/api/v1/auth/google/callback
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna

FOLIO_HOST_PORT=4173
FOLIO_DATA_PATH=/volume1/docker/folio-data
```

`FOLIO_DATA_PATH`는 실제 NAS의 영구 저장 폴더로 바꿉니다. Synology가 아니라면 `/volume1/docker` 대신 해당 NAS의 절대 경로를 사용합니다.

처음 실행합니다.

```sh
docker compose -f compose.nas.yaml pull
docker compose -f compose.nas.yaml up -d
docker compose -f compose.nas.yaml ps
```

## 4. 자동 업데이트 예약 작업

NAS 작업 스케줄러에서 아래 명령을 10~30분 간격으로 실행하도록 등록합니다. 실행 계정은 Folio 폴더와 데이터 폴더를 읽고 쓸 수 있고 Docker를 실행할 수 있어야 합니다.

```sh
sh /절대/경로/Folio/scripts/nas-update.sh
```

Synology DSM에서는 **제어판 → 작업 스케줄러 → 생성 → 예약된 작업 → 사용자 정의 스크립트**에 위 명령을 넣을 수 있습니다. 스크립트는 fast-forward 가능한 `main`만 가져오고, 최신 이미지를 적용한 후 컨테이너 내부 상태 API까지 확인합니다.

수동 업데이트도 같은 스크립트로 실행합니다.

```sh
sh scripts/nas-update.sh
```

로그 확인:

```sh
docker compose -f compose.nas.yaml logs --tail=100 folio
```

## 주의 사항

- `.env`, `/data`, 업로드 파일은 GitHub나 컨테이너 이미지에 포함하지 않습니다.
- 외부 공개 시 NAS의 4173 포트를 그대로 포트 포워딩하기보다 NAS 리버스 프록시와 HTTPS 인증서를 사용합니다.
- Google OAuth의 승인된 리디렉션 URI는 `GOOGLE_REDIRECT_URI`와 글자 하나까지 같아야 합니다.
- 데이터 백업 대상은 `FOLIO_DATA_PATH`로 지정한 폴더 전체입니다.
