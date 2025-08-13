import { NextRequest, NextResponse } from 'next/server'
import { getImageAnalyzer } from '@/lib/ai-image-analyzer'
import { getVectorCache } from '@/lib/vector-cache'
import { isImage } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('filePath')
    const fileType = searchParams.get('fileType') as
      | 'image'
      | 'video'
      | 'text'
      | undefined
    const limit = parseInt(searchParams.get('limit') || '10')
    const threshold = parseFloat(searchParams.get('threshold') || '0.7')

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath parameter is required' },
        { status: 400 }
      )
    }

    // 파일 타입별 추천 처리
    if (fileType === 'image' || isImage(filePath)) {
      return await handleImageRecommendations(filePath, limit, threshold)
    } else if (fileType === 'text') {
      // TODO: 텍스트 추천 구현
      return NextResponse.json(
        { message: 'Text recommendations not implemented yet' },
        { status: 501 }
      )
    } else if (fileType === 'video') {
      // TODO: 비디오 추천 구현
      return NextResponse.json(
        { message: 'Video recommendations not implemented yet' },
        { status: 501 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('AI recommendations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleImageRecommendations(
  filePath: string,
  limit: number,
  threshold: number
) {
  try {
    const imageAnalyzer = await getImageAnalyzer()

    // 유사한 이미지 검색
    const similarImages = await imageAnalyzer.findSimilarImages(
      filePath,
      limit,
      threshold
    )

    const recommendations = similarImages.map((result) => ({
      file: {
        path: result.file.filePath,
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
      similarity: Math.round(result.similarity * 100),
      reason: 'AI 시각적 특징 유사성',
      modelUsed: result.file.modelName,
    }))

    return NextResponse.json({
      success: true,
      queryFile: filePath,
      recommendations,
      total: recommendations.length,
      parameters: {
        limit,
        threshold,
        model: imageAnalyzer.getModelInfo().name,
      },
    })
  } catch (error) {
    console.error('Image recommendations error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, files, options } = body

    if (action === 'analyze') {
      return await handleBatchAnalysis(files, options)
    } else if (action === 'search') {
      return await handleVectorSearch(body.query, options)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('AI recommendations POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleBatchAnalysis(files: string[], _options: any) {
  try {
    const imageAnalyzer = await getImageAnalyzer()
    const imageFiles = files.filter((file) => isImage(file))

    if (imageFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No image files to analyze',
        processed: 0,
        total: files.length,
      })
    }

    // 배치 분석 시작 (비동기적으로 처리)
    const results = await imageAnalyzer.analyzeBatch(
      imageFiles,
      (completed, total, currentFile) => {
        console.log(`Progress: ${completed}/${total} - ${currentFile}`)
      }
    )

    return NextResponse.json({
      success: true,
      processed: results.length,
      total: imageFiles.length,
      results: results.map((r) => ({
        filePath: r.filePath,
        modelName: r.modelName,
        embeddingDimensions: r.embedding.length,
        extractedAt: r.extractedAt,
      })),
    })
  } catch (error) {
    console.error('Batch analysis error:', error)
    throw error
  }
}

async function handleVectorSearch(query: any, options: any) {
  try {
    const vectorCache = await getVectorCache()

    if (query.embedding && Array.isArray(query.embedding)) {
      // 임베딩 벡터로 직접 검색
      const results = await vectorCache.findSimilar(
        query.embedding,
        query.fileType,
        options?.limit || 10,
        options?.threshold || 0.7
      )

      return NextResponse.json({
        success: true,
        results: results.map((r) => ({
          file: {
            path: r.file.filePath,
            type: r.file.fileType,
            metadata: r.file.metadata,
          },
          similarity: Math.round(r.similarity * 100),
          distance: r.distance,
        })),
        total: results.length,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid query format' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Vector search error:', error)
    throw error
  }
}
