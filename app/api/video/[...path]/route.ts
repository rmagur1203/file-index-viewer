import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import path from 'path'

const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const videoPath = params.path.join('/')
    const safePath = path.normalize(videoPath).replace(/^(\.\.[\/\\])+/, '')
    const fullPath = path.join(VIDEO_ROOT, safePath)
    
    // 보안: 경로가 VIDEO_ROOT 내부에 있는지 확인
    if (!fullPath.startsWith(VIDEO_ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const stats = await fs.stat(fullPath)
    
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const range = request.headers.get('range')
    const fileSize = stats.size
    
    if (range) {
      // Range 요청 처리 (비디오 스트리밍)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1
      
      const stream = createReadStream(fullPath, { start, end })
      
      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': 'video/mp4',
        },
      })
    } else {
      // 전체 파일 전송
      const stream = createReadStream(fullPath)
      
      return new NextResponse(stream as any, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
        },
      })
    }
  } catch (error) {
    console.error('Error serving video:', error)
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }
}
