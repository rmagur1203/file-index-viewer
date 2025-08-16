import { NextResponse } from 'next/server'
import { getVideoAnalyzer } from '@/lib/ai-video-analyzer'
import { existsSync } from 'fs'
import path from 'path'
import { MEDIA_ROOT } from '@/lib/config'

export async function POST(request: Request) {
  try {
    const { videoPath: relativePath } = await request.json()

    if (!relativePath || typeof relativePath !== 'string') {
      return NextResponse.json(
        { error: 'Invalid videoPath provided' },
        { status: 400 }
      )
    }

    const videoPath = path.join(MEDIA_ROOT, relativePath)

    if (!existsSync(videoPath)) {
      return NextResponse.json(
        { error: `File not found: ${videoPath}` },
        { status: 404 }
      )
    }

    const analyzer = await getVideoAnalyzer()
    const classificationResults = await analyzer.classifyVideo(videoPath)

    return NextResponse.json(classificationResults)
  } catch (error) {
    console.error('Video classification failed:', error)
    return NextResponse.json(
      { error: 'Internal server error during video classification' },
      { status: 500 }
    )
  }
}
