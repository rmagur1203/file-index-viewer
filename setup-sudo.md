# Sudo 권한 설정 가이드

이 파일 뷰어가 루트 권한이 필요한 파일들을 읽을 수 있도록 하려면 다음 설정이 필요합니다.

## 1. Sudoers 파일 수정

터미널에서 다음 명령어를 실행하여 sudoers 파일을 편집합니다:

```bash
sudo visudo
```

파일 끝에 다음 라인을 추가합니다 (사용자명을 실제 사용자명으로 변경):

```
# 파일 뷰어용 sudo 권한
your_username ALL=(ALL) NOPASSWD: /usr/bin/stat, /usr/bin/find
```

예시:
```
user ALL=(ALL) NOPASSWD: /usr/bin/stat, /usr/bin/find
```

## 2. 설정 확인

설정이 올바르게 되었는지 확인하려면:

```bash
# stat 명령어 테스트
sudo stat /usr/local/var/www

# find 명령어 테스트  
sudo find /usr/local/var/www -maxdepth 1 -mindepth 1
```

패스워드를 묻지 않으면 설정이 성공한 것입니다.

## 3. 보안 고려사항

- 위 설정은 `stat`과 `find` 명령어에만 sudo 권한을 부여합니다
- 특정 경로로 제한하려면 더 구체적인 규칙을 설정할 수 있습니다
- 프로덕션 환경에서는 전용 사용자 계정 생성을 권장합니다

## 4. 애플리케이션 재시작

설정 완료 후 Next.js 애플리케이션을 재시작합니다:

```bash
npm run dev
# 또는
pnpm dev
```

이제 애플리케이션이 루트 권한이 필요한 파일들도 읽을 수 있습니다!

