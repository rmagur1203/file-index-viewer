import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import { VIDEO_ROOT, THUMBNAIL_DIR } from '@/lib/config'
import { safePath, sudoExists } from '@/lib/sudo-fs'

// 썸네일 디렉토리가 없으면 생성
async function ensureThumbnailDir() {
  try {
    await fs.access(THUMBNAIL_DIR)
  } catch {
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true })
  }
}

// FFmpeg를 사용하여 썸네일 생성
function generateThumbnail(
  videoPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      videoPath,
      '-ss',
      '00:00:01.000', // 1초 지점에서 캡처
      '-vframes',
      '1', // 1프레임만 캡처
      '-vf',
      'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
      '-y', // 기존 파일 덮어쓰기
      outputPath,
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        // FFmpeg 프로세스 자체의 오류 로그를 더 자세히 보기 위해 stderr를 캡처할 수 있습니다.
        let stderr = ''
        ffmpeg.stderr.on('data', (data) => (stderr += data.toString()))
        ffmpeg.stderr.on('end', () => {
          reject(
            new Error(`FFmpeg exited with code ${code}. Stderr: ${stderr}`)
          )
        })
      }
    })

    ffmpeg.on('error', (error) => {
      reject(error)
    })
  })
}

// 썸네일 응답 생성
function createThumbnailResponse(
  buffer: Buffer,
  contentType: 'image/jpeg' | 'image/svg+xml',
  maxAge: number
): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path')

    if (!requestedPath) {
      return NextResponse.json(
        { error: 'Path parameter required' },
        { status: 400 }
      )
    }

    const fullVideoPath = safePath(VIDEO_ROOT, requestedPath)

    // 비디오 파일이 존재하는지 확인 (sudo 권한 포함)
    if (!(await sudoExists(fullVideoPath))) {
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      )
    }

    await ensureThumbnailDir()

    // 썸네일 파일명 생성 (경로를 안전한 파일명으로 변환)
    const thumbnailFileName = requestedPath
      .replace(/[\/\\]/g, '_')
      .replace(/\.[^.]+$/, '.jpg')
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFileName)

    // 썸네일이 이미 존재하는지 확인
    try {
      await fs.access(thumbnailPath)
      const thumbnailBuffer = await fs.readFile(thumbnailPath)
      return createThumbnailResponse(thumbnailBuffer, 'image/jpeg', 31536000) // 1년 캐시
    } catch {
      // 썸네일이 없으면 생성
      try {
        await generateThumbnail(fullVideoPath, thumbnailPath)
        const thumbnailBuffer = await fs.readFile(thumbnailPath)
        return createThumbnailResponse(thumbnailBuffer, 'image/jpeg', 31536000)
      } catch (error) {
        console.error('Error generating thumbnail:', error)

        // FFmpeg 실패 시 기본 이미지 반환
        const defaultThumbnail = await generateDefaultThumbnail()
        return createThumbnailResponse(defaultThumbnail, 'image/svg+xml', 3600)
      }
    }
  } catch (error: any) {
    // safePath에서 발생한 오류 처리
    if (error.message.startsWith('Access denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('Thumbnail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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
