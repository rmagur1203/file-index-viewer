import { NextResponse } from 'next/server'
import { getImageAnalyzer } from '@/lib/ai-image-analyzer'
import { existsSync } from 'fs'
import path from 'path'
import { MEDIA_ROOT } from '@/lib/config'

export async function POST(request: Request) {
  try {
    const { imagePath: relativePath } = await request.json()

    if (!relativePath || typeof relativePath !== 'string') {
      return NextResponse.json(
        { error: 'Invalid imagePath provided' },
        { status: 400 }
      )
    }

    const imagePath = path.join(MEDIA_ROOT, relativePath)
    console.log('imagePath', imagePath)

    if (!existsSync(imagePath)) {
      return NextResponse.json(
        { error: `File not found: ${imagePath}` },
        { status: 404 }
      )
    }

    const analyzer = await getImageAnalyzer()
    const classificationResults = await analyzer.classifyImage(imagePath)

    return NextResponse.json(classificationResults)
  } catch (error) {
    console.error('Image classification failed:', error)
    return NextResponse.json(
      { error: 'Internal server error during image classification' },
      { status: 500 }
    )
  }
}
