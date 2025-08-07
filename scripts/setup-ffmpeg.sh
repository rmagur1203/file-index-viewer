# FFmpeg 설치 스크립트 (Ubuntu/Debian)
echo "FFmpeg 설치를 시작합니다..."

# 시스템 업데이트
sudo apt update

# FFmpeg 설치
sudo apt install -y ffmpeg

# 설치 확인
if command -v ffmpeg &> /dev/null; then
    echo "FFmpeg가 성공적으로 설치되었습니다."
    ffmpeg -version | head -1
else
    echo "FFmpeg 설치에 실패했습니다."
    exit 1
fi

# 썸네일 디렉토리 생성
mkdir -p public/thumbnails
echo "썸네일 디렉토리가 생성되었습니다: public/thumbnails"

echo "설정이 완료되었습니다!"
