import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import path from 'path'

const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'
const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails')

// 썸네일 디렉토리가 없으면 생성
async function ensureThumbnailDir() {
  try {
    await fs.access(THUMBNAIL_DIR)
  } catch {
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true })
  }
}

// FFmpeg를 사용하여 썸네일 생성
function generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01.000',  // 1초 지점에서 캡처
      '-vframes', '1',        // 1프레임만 캡처
      '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
      '-y',                   // 기존 파일 덮어쓰기
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (error) => {
      reject(error)
    })
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path')
    
    if (!requestedPath) {
      return NextResponse.json({ error: 'Path parameter required' }, { status: 400 })
    }

    // 보안: 상위 디렉토리 접근 방지
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '')
    const fullVideoPath = path.join(VIDEO_ROOT, safePath)
    
    // 경로가 VIDEO_ROOT 내부에 있는지 확인
    if (!fullVideoPath.startsWith(VIDEO_ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 비디오 파일이 존재하는지 확인
    try {
      await fs.access(fullVideoPath)
    } catch {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 })
    }

    await ensureThumbnailDir()

    // 썸네일 파일명 생성 (경로를 안전한 파일명으로 변환)
    const thumbnailFileName = safePath.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '.jpg')
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFileName)

    // 썸네일이 이미 존재하는지 확인
    try {
      await fs.access(thumbnailPath)
      // 썸네일이 존재하면 해당 파일을 반환
      const thumbnailBuffer = await fs.readFile(thumbnailPath)
      return new NextResponse(new Uint8Array(thumbnailBuffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000', // 1년 캐시
        },
      })
    } catch {
      // 썸네일이 없으면 생성
      try {
        await generateThumbnail(fullVideoPath, thumbnailPath)
        const thumbnailBuffer = await fs.readFile(thumbnailPath)
        return new NextResponse(new Uint8Array(thumbnailBuffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000',
          },
        })
      } catch (error) {
        console.error('Error generating thumbnail:', error)
        
        // FFmpeg 실패 시 기본 이미지 반환
        const defaultThumbnail = await generateDefaultThumbnail()
        return new NextResponse(new Uint8Array(defaultThumbnail), {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
    }
  } catch (error) {
    console.error('Thumbnail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 기본 썸네일 SVG 생성
async function generateDefaultThumbnail(): Promise<Buffer> {
  const svg = `
    <svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="240" fill="#374151"/>
      <g transform="translate(160,120)">
        <circle r="30" fill="#6B7280"/>
        <polygon points="-12,-15 -12,15 18,0" fill="#FFFFFF"/>
      </g>
      <text x="160" y="200" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="14">
        썸네일 생성 실패
      </text>
    </svg>
  `
  return Buffer.from(svg, 'utf-8')
}
