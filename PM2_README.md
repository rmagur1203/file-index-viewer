# PM2 Ecosystem 설정 가이드

이 프로젝트는 PM2를 사용하여 백엔드와 프론트엔드 애플리케이션을 관리합니다.

## 🚀 사용 방법

### 1. PM2 설치
```bash
npm install -g pm2
```

### 2. 애플리케이션 시작
```bash
# 개발 환경
npm run pm2:start

# 프로덕션 환경
npm run pm2:start:prod
```

### 3. 관리 명령어
```bash
# 상태 확인
npm run pm2:status

# 로그 보기
npm run pm2:logs

# 백엔드 로그만 보기
npm run pm2:logs:backend

# 프론트엔드 로그만 보기
npm run pm2:logs:frontend

# 애플리케이션 재시작
npm run pm2:restart

# 애플리케이션 중지
npm run pm2:stop

# 애플리케이션 삭제
npm run pm2:delete

# 모니터링 (실시간)
npm run pm2:monit
```

## 🔧 환경변수 설정

### 백엔드 환경변수
- `NODE_ENV`: 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본값: 3001)
- `HOST`: 서버 호스트 (기본값: 0.0.0.0)
- `LOG_LEVEL`: 로그 레벨 (info/warn/error)

### 프론트엔드 환경변수
- `NODE_ENV`: 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본값: 3000)
- `HOST`: 서버 호스트 (기본값: 0.0.0.0)
- `NEXT_TELEMETRY_DISABLED`: Next.js 텔레메트리 비활성화

### 환경변수 파일 설정
프로젝트 루트에 다음 파일들을 생성하여 환경변수를 설정할 수 있습니다:

```bash
# 개발 환경
.env.development

# 프로덕션 환경
.env.production

# 로컬 환경 (git에 포함되지 않음)
.env.local
```

#### 예시 .env.development
```bash
NODE_ENV=development
BACKEND_PORT=3001
FRONTEND_PORT=3000
LOG_LEVEL=info
```

#### 예시 .env.production
```bash
NODE_ENV=production
BACKEND_PORT=3001
FRONTEND_PORT=3000
LOG_LEVEL=warn
```

## 📁 로그 파일

로그 파일은 `logs/` 디렉토리에 저장됩니다:

- `backend-error.log`: 백엔드 에러 로그
- `backend-out.log`: 백엔드 출력 로그
- `backend-combined.log`: 백엔드 통합 로그
- `frontend-error.log`: 프론트엔드 에러 로그
- `frontend-out.log`: 프론트엔드 출력 로그
- `frontend-combined.log`: 프론트엔드 통합 로그

## 🔄 자동 재시작

PM2는 다음 상황에서 자동으로 애플리케이션을 재시작합니다:

- 애플리케이션 크래시 시
- 메모리 사용량이 1GB를 초과할 때
- 백엔드의 경우 `dist` 폴더의 파일이 변경될 때

## 🏗️ 빌드 및 배포

### 개발 환경
```bash
# 1. 종속성 설치
npm install

# 2. 백엔드 빌드
cd apps/backend && npm run build

# 3. 프론트엔드 빌드
cd apps/frontend && npm run build

# 4. PM2로 시작
npm run pm2:start
```

### 프로덕션 환경
```bash
# 1. 종속성 설치
npm install --production

# 2. 전체 빌드
npm run build

# 3. PM2로 프로덕션 시작
npm run pm2:start:prod
```

## 🐛 문제 해결

### 포트 충돌
기본 포트(3000, 3001)가 이미 사용 중인 경우:
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
lsof -i :3001

# 프로세스 종료
kill -9 <PID>
```

### 로그 확인
```bash
# 실시간 로그 보기
pm2 logs --lines 50

# 특정 앱 로그 보기
pm2 logs file-index-viewer-backend --lines 50
```

### PM2 프로세스 완전 초기화
```bash
pm2 kill
pm2 delete all
```
