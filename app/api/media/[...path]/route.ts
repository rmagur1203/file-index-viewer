import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, promises as fs } from 'fs'
import { Readable } from 'stream'
import { VIDEO_ROOT } from '@/lib/config'
import { safePath } from '@/lib/sudo-fs'
import { getContentType, isText } from '@/lib/utils'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const requestedPath = params.path.join('/')
    const fullPath = safePath(VIDEO_ROOT, requestedPath)

    const stats = await fs.stat(fullPath)

    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const range = request.headers.get('range')
    const fileSize = stats.size
    const contentType = getContentType(fullPath)

    // 텍스트 파일인 경우 인코딩 감지 및 변환
    if (isText(fullPath)) {
      const fileBuffer = await fs.readFile(fullPath)
      const detected = jschardet.detect(fileBuffer)

      if (
        detected &&
        detected.encoding &&
        detected.encoding.toLowerCase() !== 'utf-8'
      ) {
        const decodedContent = iconv.decode(fileBuffer, detected.encoding)
        const utf8Buffer = Buffer.from(decodedContent, 'utf-8')

        return new NextResponse(utf8Buffer, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': utf8Buffer.length.toString(),
          },
        })
      }
    }

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
