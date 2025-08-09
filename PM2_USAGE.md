# PM2 사용법

이 프로젝트는 PM2를 사용하여 프로덕션 환경에서 실행할 수 있습니다.

## 필수 조건

PM2가 전역으로 설치되어 있어야 합니다:

```bash
npm install -g pm2
```

## 사용 가능한 명령어

### 애플리케이션 시작

```bash
# 프로덕션 환경으로 시작
bun run pm2:start

# 개발 환경으로 시작
bun run pm2:dev
```

### 애플리케이션 관리

```bash
# 애플리케이션 중지
bun run pm2:stop

# 애플리케이션 재시작
bun run pm2:restart

# 애플리케이션 리로드 (무중단 재시작)
bun run pm2:reload

# 애플리케이션 완전 삭제
bun run pm2:delete
```

### 모니터링

```bash
# 로그 보기
bun run pm2:logs

# 상태 확인
bun run pm2:status

# 실시간 모니터링
pm2 monit
```

## 설정 파일

- `ecosystem.config.js`: PM2 설정 파일
- 환경 변수는 `.env` 파일에서 관리됩니다
- 로그는 `./logs/` 디렉토리에 저장됩니다

## 주의사항

1. 프로덕션 환경에서 실행하기 전에 먼저 빌드를 수행하세요:

   ```bash
   bun run build
   ```

2. 시스템 재부팅 시 자동 시작을 원한다면:

   ```bash
   pm2 startup
   pm2 save
   ```

3. 메모리 사용량이 500MB를 초과하면 자동으로 재시작됩니다.
