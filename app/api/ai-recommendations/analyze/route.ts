import { NextRequest, NextResponse } from 'next/server'
import { VIDEO_ROOT } from '@/lib/config'
// import { safePath } from '@/lib/sudo-fs'
import { scanMediaFiles } from '@/lib/duplicate-detector'
import { getImageAnalyzer } from '@/lib/ai-image-analyzer'
import { getVectorCache } from '@/lib/vector-cache'
import { isImage } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileTypes = searchParams.get('fileTypes')?.split(',') || ['image']
  const forceReanalyze = searchParams.get('forceReanalyze') === 'true'

  // Server-Sent Events 스트림 설정
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // SSE 헤더 전송
        const sendEvent = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        sendEvent({
          step: 'scanning',
          progress: 0,
          message: '파일 스캔 시작...',
        })

        // 파일 스캔
        const files = await scanMediaFiles(
          VIDEO_ROOT,
          (step, current, total) => {
            sendEvent({
              step: 'scanning',
              progress: total > 0 ? Math.round((current / total) * 30) : 0, // 30%까지 할당
              message: step,
              details: { current, total },
            })
          }
        )

        sendEvent({
          step: 'filtering',
          progress: 30,
          message: `총 ${files.length}개 파일 발견, AI 분석 대상 필터링 중...`,
        })

        // 분석할 파일 필터링
        const analysisTargets = files.filter((file) => {
          if (fileTypes.includes('image') && isImage(file.name)) return true
          // TODO: 비디오, 텍스트 파일 필터링 추가
          return false
        })

        sendEvent({
          step: 'analysis_preparation',
          progress: 35,
          message: `AI 분석 대상: ${analysisTargets.length}개 파일`,
        })

        // AI 분석 시작
        if (analysisTargets.length === 0) {
          sendEvent({
            step: 'completed',
            progress: 100,
            message: '분석할 파일이 없습니다.',
            result: {
              totalFiles: files.length,
              analyzedFiles: 0,
              newAnalysis: 0,
              cachedResults: 0,
            },
          })
          controller.close()
          return
        }

        // 이미지 분석기 초기화
        if (fileTypes.includes('image')) {
          sendEvent({
            step: 'model_loading',
            progress: 40,
            message: 'AI 모델 로딩 중...',
          })

          const imageAnalyzer = await getImageAnalyzer()
          const vectorCache = await getVectorCache()

          sendEvent({
            step: 'analyzing',
            progress: 45,
            message: 'AI 분석 시작...',
          })

          let analyzedCount = 0
          let newAnalysisCount = 0
          let cachedCount = 0

          // 배치 분석 실행
          const imageFiles = analysisTargets.filter((file) =>
            isImage(file.name)
          )
          const imagePaths = imageFiles.map((file) => file.path)

          await imageAnalyzer.analyzeBatch(
            imagePaths,
            async (completed, total, currentFile) => {
              const progressPercent = 45 + Math.round((completed / total) * 50) // 45%~95%

              // 캐시 확인 (새로 분석했는지 기존 캐시인지)
              const existingEmbedding = await vectorCache.getEmbeddingByPath(
                currentFile,
                imageAnalyzer.getModelInfo().name
              )

              if (existingEmbedding && !forceReanalyze) {
                cachedCount++
              } else {
                newAnalysisCount++
              }

              analyzedCount = completed

              sendEvent({
                step: 'analyzing',
                progress: progressPercent,
                message: `AI 분석 진행 중: ${completed}/${total}`,
                details: {
                  currentFile: currentFile.split('/').pop(), // 파일명만
                  completed,
                  total,
                  newAnalysis: newAnalysisCount,
                  cached: cachedCount,
                },
              })
            }
          )

          // 통계 정보 수집
          const stats = await vectorCache.getStats()

          sendEvent({
            step: 'completed',
            progress: 100,
            message: 'AI 분석 완료!',
            result: {
              totalFiles: files.length,
              analyzedFiles: analyzedCount,
              newAnalysis: newAnalysisCount,
              cachedResults: cachedCount,
              vectorStats: stats,
            },
          })
        }

        controller.close()
      } catch (error) {
        console.error('AI analysis error:', error)

        const sendEvent = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        sendEvent({
          step: 'error',
          progress: 0,
          message: `분석 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        })

        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
