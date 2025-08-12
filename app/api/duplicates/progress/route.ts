import { NextRequest } from 'next/server'
import { VIDEO_ROOT } from '@/lib/config'
import { scanMediaFiles, findDuplicateGroups } from '@/lib/duplicate-detector'

export const dynamic = 'force-dynamic'

// 진행 상황을 추적하기 위한 전역 상태
const scanProgressState = {
  isScanning: false,
  currentStep: '',
  filesScanned: 0,
  totalFiles: 0,
  progress: 0,
  startTime: 0,
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scanPath = searchParams.get('path') || VIDEO_ROOT
  const similarityThreshold = parseInt(searchParams.get('threshold') || '90')

  // SSE 헤더 설정
  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      const sendMessage = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      const progressCallback = (step: string, current: number, total: number) => {
        scanProgressState.currentStep = step
        scanProgressState.filesScanned = current
        scanProgressState.totalFiles = total
        scanProgressState.progress = total > 0 ? Math.round((current / total) * 100) : 0
        
        sendMessage({
          step,
          current,
          total,
          progress: scanProgressState.progress,
          message: `${step}: ${current}/${total} (${scanProgressState.progress}%)`
        })
      }

      // 스캔 시작
      const startScan = async () => {
        try {
          scanProgressState.isScanning = true
          scanProgressState.startTime = Date.now()
          
          sendMessage({ 
            step: 'starting', 
            progress: 0, 
            message: '스캔을 시작합니다...' 
          })

          // 파일 스캔
          sendMessage({ 
            step: 'scanning', 
            progress: 5, 
            message: '파일들을 검색하고 있습니다...' 
          })
          
          const files = await scanMediaFiles(scanPath, progressCallback)
          
          sendMessage({ 
            step: 'analyzing', 
            progress: 70, 
            message: '중복 파일을 분석하고 있습니다...' 
          })

          // 중복 그룹 찾기
          const duplicateGroups = findDuplicateGroups(files)
          
          sendMessage({ 
            step: 'filtering', 
            progress: 90, 
            message: '결과를 필터링하고 있습니다...' 
          })

          // 임계값 이상의 유사도를 가진 그룹만 필터링
          const filteredGroups = duplicateGroups.filter(
            (group) => group.similarity >= similarityThreshold
          )

          const totalScanTime = Date.now() - scanProgressState.startTime
          
          sendMessage({
            step: 'completed',
            progress: 100,
            message: `스캔 완료! ${(totalScanTime / 1000).toFixed(1)}초 소요`,
            result: {
              totalFiles: files.length,
              duplicateGroups: filteredGroups.length,
              duplicateFiles: filteredGroups.reduce((sum, group) => sum + group.files.length, 0),
              groups: filteredGroups
            }
          })

        } catch (error) {
          console.error('Scan error:', error)
          sendMessage({
            step: 'error',
            progress: 0,
            message: `스캔 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        } finally {
          scanProgressState.isScanning = false
          controller.close()
        }
      }

      startScan()
    },
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}
