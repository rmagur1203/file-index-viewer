import { ThresholdPreset, SimilarityThresholds } from '../types'

// 기본 임계값 설정
export const DEFAULT_THRESHOLDS: SimilarityThresholds = {
  image: {
    perceptual: 85,
    exact: false,
  },
  video: {
    visual: 70,
    duration: 20,
    exact: false,
  },
  global: {
    minFileSize: 1024, // 1KB
    skipSmallFiles: false,
  },
}

// 프리셋 옵션들
export const THRESHOLD_PRESETS: ThresholdPreset[] = [
  {
    name: '매우 엄격',
    description: '거의 동일한 파일만 중복으로 인식',
    icon: '🔒',
    thresholds: {
      image: {
        perceptual: 95,
        exact: false,
      },
      video: {
        visual: 90,
        duration: 90,
        exact: false,
      },
      global: {
        minFileSize: 10240, // 10KB
        skipSmallFiles: true,
      },
    },
  },
  {
    name: '엄격',
    description: '높은 유사도를 가진 파일들만 중복으로 인식',
    icon: '🎯',
    thresholds: {
      image: {
        perceptual: 90,
        exact: false,
      },
      video: {
        visual: 80,
        duration: 70,
        exact: false,
      },
      global: {
        minFileSize: 5120, // 5KB
        skipSmallFiles: true,
      },
    },
  },
  {
    name: '균형',
    description: '적당한 수준의 유사도로 중복 탐지 (기본값)',
    icon: '⚖️',
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    name: '관대',
    description: '더 많은 유사한 파일들을 중복으로 인식',
    icon: '🔍',
    thresholds: {
      image: {
        perceptual: 75,
        exact: false,
      },
      video: {
        visual: 60,
        duration: 15,
        exact: false,
      },
      global: {
        minFileSize: 512, // 512B
        skipSmallFiles: false,
      },
    },
  },
  {
    name: '매우 관대',
    description: '약간만 유사해도 중복으로 인식 (편집된 파일 포함)',
    icon: '🌊',
    thresholds: {
      image: {
        perceptual: 65,
        exact: false,
      },
      video: {
        visual: 50,
        duration: 10,
        exact: false,
      },
      global: {
        minFileSize: 0,
        skipSmallFiles: false,
      },
    },
  },
  {
    name: '정확한 중복만',
    description: 'MD5 해시가 완전히 일치하는 파일만 중복으로 인식',
    icon: '✅',
    thresholds: {
      image: {
        perceptual: 100,
        exact: true,
      },
      video: {
        visual: 100,
        duration: 100,
        exact: true,
      },
      global: {
        minFileSize: 0,
        skipSmallFiles: false,
      },
    },
  },
]

/**
 * 프리셋 이름으로 임계값 설정 가져오기
 */
export function getPresetByName(name: string): SimilarityThresholds {
  const preset = THRESHOLD_PRESETS.find((p) => p.name === name)
  return preset ? preset.thresholds : DEFAULT_THRESHOLDS
}

/**
 * 임계값이 유효한지 검증
 */
export function validateThresholds(thresholds: SimilarityThresholds): boolean {
  const { image, video, global } = thresholds

  // 범위 검증
  if (image.perceptual < 0 || image.perceptual > 100) return false
  if (video.visual < 0 || video.visual > 100) return false
  if (video.duration < 0 || video.duration > 100) return false
  if (global.minFileSize < 0) return false

  return true
}

/**
 * 임계값을 URL 쿼리 파라미터로 직렬화
 */
export function serializeThresholds(
  thresholds: SimilarityThresholds
): Record<string, string> {
  return {
    imagePerceptual: thresholds.image.perceptual.toString(),
    imageExact: thresholds.image.exact.toString(),
    videoVisual: thresholds.video.visual.toString(),
    videoDuration: thresholds.video.duration.toString(),
    videoExact: thresholds.video.exact.toString(),
    minFileSize: thresholds.global.minFileSize.toString(),
    skipSmallFiles: thresholds.global.skipSmallFiles.toString(),
  }
}

/**
 * URL 쿼리 파라미터에서 임계값 역직렬화
 */
export function deserializeThresholds(
  params: URLSearchParams
): SimilarityThresholds {
  try {
    return {
      image: {
        perceptual: parseInt(params.get('imagePerceptual') || '85'),
        exact: params.get('imageExact') === 'true',
      },
      video: {
        visual: parseInt(params.get('videoVisual') || '70'),
        duration: parseInt(params.get('videoDuration') || '20'),
        exact: params.get('videoExact') === 'true',
      },
      global: {
        minFileSize: parseInt(params.get('minFileSize') || '1024'),
        skipSmallFiles: params.get('skipSmallFiles') === 'true',
      },
    }
  } catch (error) {
    console.warn('Failed to deserialize thresholds, using defaults:', error)
    return DEFAULT_THRESHOLDS
  }
}

/**
 * 임계값 설정의 복잡도 계산 (0-100, 높을수록 더 관대)
 */
export function calculateComplexity(thresholds: SimilarityThresholds): number {
  const imageWeight = 0.4
  const videoWeight = 0.4
  const globalWeight = 0.2

  // 각 설정의 관대함 정도 계산 (높을수록 관대)
  const imageComplexity = thresholds.image.exact
    ? 0
    : 100 - thresholds.image.perceptual
  const videoComplexity = thresholds.video.exact
    ? 0
    : (100 - thresholds.video.visual + (100 - thresholds.video.duration)) / 2
  const globalComplexity = thresholds.global.skipSmallFiles
    ? Math.max(0, 100 - (thresholds.global.minFileSize / 10240) * 100)
    : 100

  return Math.round(
    imageComplexity * imageWeight +
      videoComplexity * videoWeight +
      globalComplexity * globalWeight
  )
}
