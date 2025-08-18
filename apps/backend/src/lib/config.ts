import path from "path";

// 미디어 라이브러리의 루트 디렉토리
export const MEDIA_ROOT =
  process.env.VIDEO_ROOT || path.join(process.cwd(), "media");

// 비디오 라이브러리의 루트 디렉토리 (기존 호환성 유지)
export const VIDEO_ROOT = MEDIA_ROOT;

// 썸네일 이미지를 저장할 디렉토리
export const THUMBNAIL_DIR =
  process.env.THUMBNAIL_DIR || path.join(process.cwd(), "thumbnails");

// 데이터베이스 디렉토리
export const DATABASE_DIR =
  process.env.DATABASE_DIR || path.join(process.cwd(), "database");

// 캐시 디렉토리
export const CACHE_DIR =
  process.env.CACHE_DIR || path.join(process.cwd(), "cache");

// OpenAI API 키
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// 서버 포트
export const PORT = parseInt(process.env.PORT || "3001");

// 로그 레벨
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
