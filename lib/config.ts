import path from 'path'

// 비디오 라이브러리의 루트 디렉토리
export const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'

// 썸네일 이미지를 저장할 디렉토리
export const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails')
