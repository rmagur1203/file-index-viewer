import { NextRequest, NextResponse } from 'next/server'
import { VIDEO_ROOT } from '@/lib/config'
import { scanMediaFiles, findDuplicateGroups } from '@/lib/duplicate-detector'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scanPath = searchParams.get('path') || VIDEO_ROOT
    const similarityThreshold = parseInt(searchParams.get('threshold') || '90')

    console.log(`Scanning for duplicates in: ${scanPath}`)
    console.log(`Similarity threshold: ${similarityThreshold}%`)

    // 모든 미디어 파일 스캔
    const files = await scanMediaFiles(scanPath)
    console.log(`Found ${files.length} media files`)

    // 중복 그룹 찾기
    const duplicateGroups = findDuplicateGroups(files)

    // 임계값 이상의 유사도를 가진 그룹만 필터링
    const filteredGroups = duplicateGroups.filter(
      (group) => group.similarity >= similarityThreshold
    )

    console.log(`Found ${filteredGroups.length} duplicate groups`)

    // 통계 정보 계산
    const stats = {
      totalFiles: files.length,
      totalGroups: filteredGroups.length,
      totalDuplicates: filteredGroups.reduce(
        (sum, group) => sum + group.files.length,
        0
      ),
      totalWastedSpace: filteredGroups.reduce((sum, group) => {
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
      imageGroups: filteredGroups.filter((g) => g.type === 'image').length,
      videoGroups: filteredGroups.filter((g) => g.type === 'video').length,
    }

    return NextResponse.json({
      groups: filteredGroups,
      stats,
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
