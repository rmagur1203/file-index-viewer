import { NextRequest, NextResponse } from 'next/server'
import { getVectorCache } from '@/lib/vector-cache'
import { getImageAnalyzer } from '@/lib/ai-image-analyzer'
import { getVideoAnalyzer } from '@/lib/ai-video-analyzer'
import { getTextAnalyzer } from '@/lib/ai-text-analyzer'

export async function GET(_request: NextRequest) {
  try {
    const vectorCache = await getVectorCache()
    const vectorStats = await vectorCache.getStats()

    // AI 모델 정보 수집
    const modelInfo: any[] = []

    try {
      const imageAnalyzer = await getImageAnalyzer()
      const imageModelInfo = imageAnalyzer.getModelInfo()
      modelInfo.push({
        type: 'image',
        name: imageModelInfo.name,
        isInitialized: imageModelInfo.isInitialized,
        status: imageModelInfo.isInitialized ? 'ready' : 'not_loaded',
      })
    } catch (error) {
      modelInfo.push({
        type: 'image',
        name: 'mobilenet_v2',
        isInitialized: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 비디오 분석기 정보
    let videoAnalyzerInitialized = false
    try {
      const videoAnalyzer = await getVideoAnalyzer()
      const videoModelInfo = videoAnalyzer.getModelInfo()
      videoAnalyzerInitialized = videoModelInfo.isInitialized
      modelInfo.push({
        type: 'video',
        name: videoModelInfo.name,
        isInitialized: videoModelInfo.isInitialized,
        status: videoModelInfo.isInitialized ? 'ready' : 'not_loaded',
      })
    } catch (error) {
      modelInfo.push({
        type: 'video',
        name: 'video-features',
        isInitialized: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 텍스트 분석기 정보
    let textAnalyzerInitialized = false
    try {
      const textAnalyzer = await getTextAnalyzer()
      const textModelInfo = textAnalyzer.getModelInfo()
      textAnalyzerInitialized = textModelInfo.isInitialized
      modelInfo.push({
        type: 'text',
        name: textModelInfo.name,
        isInitialized: textModelInfo.isInitialized,
        status: textModelInfo.isInitialized ? 'ready' : 'not_loaded',
      })
    } catch (error) {
      modelInfo.push({
        type: 'text',
        name: 'text-embedding',
        isInitialized: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 성능 통계 (더미 데이터 - 실제로는 추적 시스템 필요)
    const performanceStats = {
      averageAnalysisTime: {
        image: 2500, // ms
        text: 1000,
        video: 8000,
      },
      cacheHitRate: vectorStats.totalEmbeddings > 0 ? 0.85 : 0, // 85%
      totalProcessedToday: vectorStats.totalEmbeddings, // 임시
      lastAnalysisTime: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      vectorDatabase: {
        ...vectorStats,
        status: 'connected',
      },
      models: modelInfo,
      performance: performanceStats,
      features: {
        imageAnalysis: true,
        textAnalysis: textAnalyzerInitialized,
        videoAnalysis: videoAnalyzerInitialized,
        vectorSearch: true,
        batchProcessing: true,
      },
    })
  } catch (error) {
    console.error('AI stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve AI statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
