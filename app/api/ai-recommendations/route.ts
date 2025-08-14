import { NextRequest, NextResponse } from 'next/server'
import { getImageAnalyzer } from '@/lib/ai-image-analyzer'
import { getVideoAnalyzer } from '@/lib/ai-video-analyzer'
import { getTextAnalyzer } from '@/lib/ai-text-analyzer'
import { getVectorCache } from '@/lib/vector-cache'
import { isImage, isVideo, isText } from '@/lib/utils'
import path from 'path'

const mediaRoot = process.env.VIDEO_ROOT || ''

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

    // 웹 경로를 실제 파일 시스템 경로로 변환
    const fullPath = path.join(
      mediaRoot,
      filePath.startsWith('/') ? filePath.substring(1) : filePath
    )

    // 파일 타입별 추천 처리
    if (fileType === 'image' || isImage(filePath)) {
      return await handleImageRecommendations(fullPath, limit, threshold)
    } else if (fileType === 'video' || isVideo(filePath)) {
      return await handleVideoRecommendations(fullPath, limit, threshold)
    } else if (fileType === 'text' || isText(filePath)) {
      return await handleTextRecommendations(fullPath, limit, threshold)
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
        filePath: result.file.filePath.replace(mediaRoot, ''), // 상대 경로로 변환
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
      similarity: result.similarity,
      reason: 'AI 시각적 특징 유사성',
      modelUsed: result.file.modelName,
    }))

    return NextResponse.json({
      success: true,
      queryFile: filePath.replace(mediaRoot, ''), // 상대 경로로 변환
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

async function handleVideoRecommendations(
  filePath: string,
  limit: number,
  threshold: number
) {
  try {
    const videoAnalyzer = await getVideoAnalyzer()

    console.log(`🎬 Finding similar videos for: ${filePath}`)

    // 유사한 비디오 검색
    const similarVideos = await videoAnalyzer.findSimilarVideos(
      filePath,
      limit,
      threshold
    )

    console.log(`✅ Found ${similarVideos.length} similar videos`)

    return NextResponse.json({
      success: true,
      query: {
        filePath: filePath.replace(mediaRoot, ''), // 상대 경로로 변환
        fileType: 'video',
        limit,
        threshold,
      },
      recommendations: similarVideos.map((result) => ({
        file: {
          filePath: result.file.filePath.replace(mediaRoot, ''), // 상대 경로로 변환
          name: result.file.filePath.split('/').pop(),
          type: result.file.fileType,
          metadata: result.file.metadata,
        },
        similarity: result.similarity,
        confidence: (result.file.metadata as any)?.confidence || 0,
        analysis: {
          modelName: result.file.modelName,
          extractedAt: result.file.extractedAt,
          embeddingDimensions: result.file.embedding.length,
          frameCount: (result.file.metadata as any)?.frameCount || 0,
          processingTime: (result.file.metadata as any)?.processingTime || 0,
        },
      })),
      total: similarVideos.length,
      processingInfo: {
        analyzer: 'video_mobilenet_v2',
        method: 'keyframe_feature_extraction',
        threshold: threshold,
      },
    })
  } catch (error) {
    console.error('Video recommendations error:', error)

    if (
      (error as Error).message?.includes('not found') ||
      (error as Error).message?.includes('does not exist')
    ) {
      return NextResponse.json(
        { error: 'Video file not found or inaccessible' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to generate video recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function handleTextRecommendations(
  filePath: string,
  limit: number,
  threshold: number
) {
  try {
    const textAnalyzer = await getTextAnalyzer()

    console.log(`📝 Finding similar texts for: ${filePath}`)

    // 유사한 텍스트 검색
    const similarTexts = await textAnalyzer.findSimilarTexts(
      filePath,
      limit,
      threshold
    )

    console.log(`✅ Found ${similarTexts.length} similar texts`)

    return NextResponse.json({
      success: true,
      query: {
        filePath: filePath.replace(mediaRoot, ''), // 상대 경로로 변환
        fileType: 'text',
        limit,
        threshold,
      },
      recommendations: similarTexts.map((result) => ({
        file: {
          filePath: result.file.filePath.replace(mediaRoot, ''), // 상대 경로로 변환
          name: result.file.filePath.split('/').pop(),
          type: 'text',
          metadata: result.file.metadata,
        },
        similarity: result.similarity, // 백분율로 변환
        confidence: (result.file.metadata as any)?.confidence || 0,
        analysis: {
          modelName: result.file.modelName,
          extractedAt: result.file.extractedAt,
          embeddingDimensions: result.file.embedding.length,
          wordCount: (result.file.metadata as any)?.wordCount || 0,
          charCount: (result.file.metadata as any)?.charCount || 0,
          language: (result.file.metadata as any)?.language || 'unknown',
          summary: (result.file.metadata as any)?.summary || '',
          processingTime: (result.file.metadata as any)?.processingTime || 0,
        },
      })),
      total: similarTexts.length,
      processingInfo: {
        analyzer: textAnalyzer.getModelInfo().name,
        method: textAnalyzer.getModelInfo().useLocalModel
          ? 'local_text_embeddings'
          : 'openai_embeddings',
        threshold: threshold,
      },
    })
  } catch (error) {
    console.error('Text recommendations error:', error)

    if (
      (error as Error).message?.includes('not found') ||
      (error as Error).message?.includes('does not exist')
    ) {
      return NextResponse.json(
        { error: 'Text file not found or inaccessible' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to generate text recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
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
    const imageFiles = files.filter((file) => isImage(file))
    const videoFiles = files.filter((file) => isVideo(file))
    const textFiles = files.filter((file) => isText(file))

    let allResults: any[] = []
    let totalProcessed = 0

    if (
      imageFiles.length === 0 &&
      videoFiles.length === 0 &&
      textFiles.length === 0
    ) {
      return NextResponse.json({
        success: true,
        message: 'No image, video, or text files to analyze',
        processed: 0,
        total: files.length,
      })
    }

    // 이미지 배치 분석
    if (imageFiles.length > 0) {
      console.log(`🖼️ Analyzing ${imageFiles.length} image files...`)
      const imageAnalyzer = await getImageAnalyzer()
      const imageResults = await imageAnalyzer.analyzeBatch(
        imageFiles,
        (completed, total, currentFile) => {
          console.log(`Image Progress: ${completed}/${total} - ${currentFile}`)
        }
      )
      allResults.push(...imageResults)
      totalProcessed += imageResults.length
    }

    // 비디오 배치 분석
    if (videoFiles.length > 0) {
      console.log(`🎬 Analyzing ${videoFiles.length} video files...`)
      const videoAnalyzer = await getVideoAnalyzer()
      const videoResults = await videoAnalyzer.analyzeBatch(
        videoFiles,
        (completed, total, currentFile) => {
          console.log(`Video Progress: ${completed}/${total} - ${currentFile}`)
        }
      )
      allResults.push(...videoResults)
      totalProcessed += videoResults.length
    }

    // 텍스트 배치 분석
    if (textFiles.length > 0) {
      console.log(`📝 Analyzing ${textFiles.length} text files...`)
      const textAnalyzer = await getTextAnalyzer()
      const textResults = await textAnalyzer.analyzeBatch(
        textFiles,
        (completed, total, currentFile) => {
          console.log(`Text Progress: ${completed}/${total} - ${currentFile}`)
        }
      )
      allResults.push(...textResults)
      totalProcessed += textResults.length
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      total: imageFiles.length + videoFiles.length + textFiles.length,
      breakdown: {
        images: imageFiles.length,
        videos: videoFiles.length,
        texts: textFiles.length,
      },
      results: allResults.map((r) => ({
        filePath: r.filePath,
        fileType: r.fileType,
        modelName: r.modelName,
        embeddingDimensions: r.embedding.length,
        extractedAt: r.extractedAt,
        metadata: r.metadata,
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
