import path from 'path'

// 백엔드 API 서버 URL
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// 미디어 라이브러리의 루트 디렉토리
export const MEDIA_ROOT = process.env.VIDEO_ROOT || process.cwd()

// 비디오 라이브러리의 루트 디렉토리 (기존 호환성 유지)
export const VIDEO_ROOT = MEDIA_ROOT

// 썸네일 이미지를 저장할 디렉토리
export const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails')
