import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import path from 'path'

const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  
  // 비디오 파일
  if (['.mp4'].includes(ext)) return 'video/mp4'
  if (['.mov'].includes(ext)) return 'video/quicktime'
  if (['.avi'].includes(ext)) return 'video/x-msvideo'
  if (['.mkv'].includes(ext)) return 'video/x-matroska'
  if (['.webm'].includes(ext)) return 'video/webm'
  if (['.m4v'].includes(ext)) return 'video/mp4'
  if (['.flv'].includes(ext)) return 'video/x-flv'
  if (['.wmv'].includes(ext)) return 'video/x-ms-wmv'
  
  // 이미지 파일
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg'
  if (['.png'].includes(ext)) return 'image/png'
  if (['.gif'].includes(ext)) return 'image/gif'
  if (['.webp'].includes(ext)) return 'image/webp'
  if (['.bmp'].includes(ext)) return 'image/bmp'
  if (['.svg'].includes(ext)) return 'image/svg+xml'
  if (['.tiff'].includes(ext)) return 'image/tiff'
  if (['.ico'].includes(ext)) return 'image/x-icon'
  
  // PDF 파일
  if (['.pdf'].includes(ext)) return 'application/pdf'
  
  // 기본값
  return 'application/octet-stream'
}

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
    const contentType = getContentType(fullPath)
    
    if (range) {
      // Range 요청 처리 (비디오 스트리밍)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1
      
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
  } catch (error) {
    console.error('Error serving video:', error)
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }
}
