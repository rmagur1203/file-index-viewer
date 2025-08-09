import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { VIDEO_ROOT } from '@/lib/config'
import { safePath, sudoStat } from '@/lib/sudo-fs'
import { getContentType } from '@/lib/utils'
import { stat } from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const requestedPath = params.path.join('/')
    const fullPath = safePath(VIDEO_ROOT, requestedPath)

    // sudoStat을 사용하여 파일 정보를 가져오지만, createReadStream은 일반 권한이 필요합니다.
    // 이는 이 경로가 일반 사용자로 읽을 수 있다고 가정합니다.
    const stats = await stat(fullPath)

    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const range = request.headers.get('range')
    const fileSize = stats.size
    const contentType = getContentType(fullPath)

    if (range && contentType.startsWith('video/')) {
      // Range 요청 처리 (비디오 스트리밍)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      const stream = createReadStream(fullPath, { start, end })

      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      })
    } else {
      // 전체 파일 전송
      const stream = createReadStream(fullPath)

      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
        },
      })
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    if (error.message.startsWith('Access denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error serving media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
