import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { sudoStat, sudoReaddir, safePath } from '@/lib/sudo-fs'
import { VIDEO_ROOT } from '@/lib/config'
import { getMediaType } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path') || '/'

    // 보안: 상위 디렉토리 접근 방지 및 안전한 경로 생성
    const fullPath = safePath(VIDEO_ROOT, requestedPath)

    const stats = await sudoStat(fullPath)

    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 })
    }

    const items = await sudoReaddir(fullPath)

    const files = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(fullPath, item.name)
        const relativePath = path.posix
          .join(requestedPath, item.name)
          .replace(/\\/g, '/')

        try {
          const itemStats = await sudoStat(itemPath)

          return {
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: item.isFile() ? itemStats.size : undefined,
            modified: itemStats.mtime.toISOString(),
            path: relativePath.startsWith('/')
              ? relativePath
              : '/' + relativePath,
            mediaType: item.isFile() ? getMediaType(item.name) : undefined,
          }
        } catch (error) {
          console.error(`Error getting stats for ${itemPath}:`, error)
          // 권한 문제로 접근할 수 없는 파일도 목록에는 표시하되 제한된 정보만 제공
          return {
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: undefined,
            modified: new Date().toISOString(),
            path: relativePath.startsWith('/')
              ? relativePath
              : '/' + relativePath,
            mediaType: undefined,
            accessDenied: true,
          }
        }
      })
    )

    const validFiles = files.filter(Boolean).sort((a, b) => {
      // 폴더를 먼저, 그 다음 파일을 알파벳 순으로
      if (a!.type !== b!.type) {
        return a!.type === 'directory' ? -1 : 1
      }
      return a!.name.localeCompare(b!.name)
    })

    return NextResponse.json({ files: validFiles })
  } catch (error) {
    console.error('Error reading directory:', error)
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    )
  }
}
