export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  createdAt?: string
  modifiedAt?: string
  thumbnail?: string
  mediaType?: 'video' | 'image' | 'pdf'
  accessDenied?: boolean
  // 추천 관련 속성
  recommendationScore?: number
  recommendationReason?: string
}

export interface FolderTree {
  [key: string]: FolderTree
}

export interface DuplicateGroup {
  id: string
  type: 'image' | 'video'
  files: DuplicateFile[]
  similarity: number
}

export interface VideoFrame {
  timestamp: number
  hash: string
}

export interface VideoFingerprint {
  filePath: string
  duration: number
  frames: VideoFrame[]
  averageHash: string
}

export interface DuplicateFile {
  path: string
  relativePath: string // VIDEO_ROOT를 기준으로 한 상대 경로
  name: string
  size: number
  hash: string
  perceptualHash?: string
  videoFingerprint?: VideoFingerprint
  modifiedAt: string
}

export interface SimilarityThresholds {
  image: {
    perceptual: number // 이미지 perceptual hash 유사도 임계값 (0-100)
    exact: boolean // 정확한 해시 매치만 허용할지 여부
  }
  video: {
    visual: number // 비디오 시각적 유사도 임계값 (0-100)
    duration: number // 비디오 길이 비교 최소 비율 (0-100)
    exact: boolean // 정확한 해시 매치만 허용할지 여부
  }
  global: {
    minFileSize: number // 최소 파일 크기 (bytes)
    skipSmallFiles: boolean // 작은 파일 제외 여부
  }
}

export interface ThresholdPreset {
  name: string
  description: string
  icon: string
  thresholds: SimilarityThresholds
}

export interface DuplicateStats {
  totalFiles: number
  totalGroups: number
  totalDuplicates: number
  totalWastedSpace: number
  imageGroups: number
  videoGroups: number
  cache?: {
    totalFiles: number
    filesWithPerceptualHash: number
    filesWithVideoFingerprint: number
    oldestEntry: string | null
    newestEntry: string | null
  }
}
