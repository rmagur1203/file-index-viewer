import { NextRequest, NextResponse } from 'next/server'
import { VIDEO_ROOT } from '@/lib/config'
import { scanMediaFiles, findDuplicateGroups } from '@/lib/duplicate-detector'
import { getFileCache } from '@/lib/file-cache'
import { deserializeThresholds } from '@/lib/threshold-presets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scanPath = searchParams.get('path') || VIDEO_ROOT

    // 새로운 임계값 시스템 사용
    const thresholds = deserializeThresholds(searchParams)

    // 하위 호환성을 위해 기존 threshold 파라미터도 지원
    const legacyThreshold = searchParams.get('threshold')
    if (legacyThreshold && !searchParams.has('imagePerceptual')) {
      const threshold = parseInt(legacyThreshold)
      thresholds.image.perceptual = threshold
      thresholds.video.visual = threshold
    }

    console.log(`Scanning for duplicates in: ${scanPath}`)
    console.log(`Thresholds:`, {
      imagePerceptual: thresholds.image.perceptual,
      imageExact: thresholds.image.exact,
      videoVisual: thresholds.video.visual,
      videoDuration: thresholds.video.duration,
      videoExact: thresholds.video.exact,
      minFileSize: thresholds.global.minFileSize,
      skipSmallFiles: thresholds.global.skipSmallFiles,
    })

    // 모든 미디어 파일 스캔
    const files = await scanMediaFiles(scanPath)
    console.log(`Found ${files.length} media files`)

    // 중복 그룹 찾기 (새로운 임계값 시스템 사용)
    const duplicateGroups = findDuplicateGroups(files, thresholds)

    console.log(`Found ${duplicateGroups.length} duplicate groups`)

    // 캐시 통계 정보 가져오기
    const fileCache = await getFileCache()
    const cacheStats = await fileCache.getCacheStats()

    // 통계 정보 계산
    const stats = {
      totalFiles: files.length,
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce(
        (sum, group) => sum + group.files.length,
        0
      ),
      totalWastedSpace: duplicateGroups.reduce((sum, group) => {
        // 가장 작은 파일을 제외한 나머지 파일들의 크기 합계
        if (group.files.length <= 1) return sum
        const sortedBySize = [...group.files].sort((a, b) => a.size - b.size)
        return (
          sum +
          sortedBySize
            .slice(1)
            .reduce((groupSum, file) => groupSum + file.size, 0)
        )
      }, 0),
      imageGroups: duplicateGroups.filter((g) => g.type === 'image').length,
      videoGroups: duplicateGroups.filter((g) => g.type === 'video').length,
      cache: cacheStats,
    }

    return NextResponse.json({
      groups: duplicateGroups,
      stats,
      thresholds,
    })
  } catch (error) {
    console.error('Error scanning for duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to scan for duplicates' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { filePaths } = await request.json()

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { error: 'Invalid file paths provided' },
        { status: 400 }
      )
    }

    const { promises: fs } = await import('fs')
    const deletedFiles: string[] = []
    const errors: string[] = []

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
        deletedFiles.push(filePath)
        console.log(`Deleted file: ${filePath}`)
      } catch (error) {
        console.error(`Failed to delete ${filePath}:`, error)
        errors.push(`Failed to delete ${filePath}: ${error}`)
      }
    }

    return NextResponse.json({
      deletedFiles,
      errors,
      success: deletedFiles.length,
      failed: errors.length,
    })
  } catch (error) {
    console.error('Error deleting files:', error)
    return NextResponse.json(
      { error: 'Failed to delete files' },
      { status: 500 }
    )
  }
}
