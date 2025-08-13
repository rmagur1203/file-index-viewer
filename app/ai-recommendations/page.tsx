'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Brain,
  Search,
  Zap,
  Database,
  Cpu,
  Loader2,
  // Settings,
  BarChart3,
  Image as ImageIcon,
  Video,
  FileText,
} from 'lucide-react'

interface AIStats {
  vectorDatabase: {
    totalEmbeddings: number
    imageEmbeddings: number
    videoEmbeddings: number
    textEmbeddings: number
    models: { [key: string]: number }
    status: string
  }
  models: Array<{
    type: string
    name: string
    isInitialized: boolean
    status: string
    error?: string
  }>
  performance: {
    averageAnalysisTime: {
      image: number
      text: number
      video: number
    }
    cacheHitRate: number
    totalProcessedToday: number
    lastAnalysisTime: string
  }
  features: {
    imageAnalysis: boolean
    textAnalysis: boolean
    videoAnalysis: boolean
    vectorSearch: boolean
    batchProcessing: boolean
  }
}

interface AnalysisResult {
  totalFiles: number
  analyzedFiles: number
  newAnalysis: number
  cachedResults: number
  vectorStats?: AIStats['vectorDatabase']
}

export default function AIRecommendationsPage() {
  const [stats, setStats] = useState<AIStats | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStep, setAnalysisStep] = useState('')
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([
    'image',
  ])

  // 통계 정보 로딩
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/ai-recommendations/stats')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStats(data)
        }
      }
    } catch (error) {
      console.error('Failed to load AI stats:', error)
    }
  }

  const startAnalysis = async () => {
    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setAnalysisStep('')
    setAnalysisMessage('')
    setAnalysisResult(null)

    try {
      const params = new URLSearchParams({
        fileTypes: selectedFileTypes.join(','),
        forceReanalyze: 'false',
      })

      const eventSource = new EventSource(
        `/api/ai-recommendations/analyze?${params.toString()}`
      )

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          setAnalysisStep(data.step)
          setAnalysisProgress(data.progress || 0)
          setAnalysisMessage(data.message || '')

          if (data.step === 'completed' && data.result) {
            setAnalysisResult(data.result)
            setIsAnalyzing(false)
            eventSource.close()
            // 통계 새로고침
            loadStats()
          } else if (data.step === 'error') {
            console.error('Analysis error:', data.message)
            setIsAnalyzing(false)
            eventSource.close()
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        setIsAnalyzing(false)
      }
    } catch (error) {
      console.error('Error starting analysis:', error)
      setIsAnalyzing(false)
    }
  }

  const toggleFileType = (fileType: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(fileType)
        ? prev.filter((type) => type !== fileType)
        : [...prev, fileType]
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-500" />
            AI 파일 추천 시스템
          </h1>
          <p className="text-muted-foreground">
            AI 기반 이미지, 비디오, 텍스트 파일 유사도 분석 및 추천
          </p>
        </div>
        <Button
          onClick={startAnalysis}
          disabled={isAnalyzing || selectedFileTypes.length === 0}
          className="min-w-[140px]"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              AI 분석 시작
            </>
          )}
        </Button>
      </div>

      {/* 파일 타입 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">분석할 파일 타입 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={
                selectedFileTypes.includes('image') ? 'default' : 'outline'
              }
              onClick={() => toggleFileType('image')}
              className="flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              이미지
              {stats?.features.imageAnalysis && (
                <Badge variant="secondary" className="ml-2">
                  활성
                </Badge>
              )}
            </Button>
            <Button
              variant={
                selectedFileTypes.includes('video') ? 'default' : 'outline'
              }
              onClick={() => toggleFileType('video')}
              disabled={!stats?.features.videoAnalysis}
              className="flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              비디오
              {!stats?.features.videoAnalysis && (
                <Badge variant="outline" className="ml-2">
                  개발 중
                </Badge>
              )}
            </Button>
            <Button
              variant={
                selectedFileTypes.includes('text') ? 'default' : 'outline'
              }
              onClick={() => toggleFileType('text')}
              disabled={!stats?.features.textAnalysis}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              텍스트
              {!stats?.features.textAnalysis && (
                <Badge variant="outline" className="ml-2">
                  개발 중
                </Badge>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 분석 진행 상황 */}
      {isAnalyzing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI 분석 진행 상황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{analysisMessage || '준비 중...'}</span>
                <span>{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="w-full" />
            </div>
            {analysisStep && (
              <div className="text-sm text-muted-foreground">
                현재 단계: {analysisStep}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-600">
              ✅ AI 분석 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {analysisResult.totalFiles}
                </div>
                <div className="text-sm text-muted-foreground">전체 파일</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analysisResult.analyzedFiles}
                </div>
                <div className="text-sm text-muted-foreground">분석 완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResult.newAnalysis}
                </div>
                <div className="text-sm text-muted-foreground">새로 분석</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analysisResult.cachedResults}
                </div>
                <div className="text-sm text-muted-foreground">캐시 활용</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 시스템 통계 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 벡터 데이터베이스 통계 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                벡터 데이터베이스
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.vectorDatabase.totalEmbeddings}
              </div>
              <p className="text-xs text-muted-foreground">
                이미지: {stats.vectorDatabase.imageEmbeddings} | 비디오:{' '}
                {stats.vectorDatabase.videoEmbeddings} | 텍스트:{' '}
                {stats.vectorDatabase.textEmbeddings}
              </p>
              <Badge
                variant={
                  stats.vectorDatabase.status === 'connected'
                    ? 'default'
                    : 'destructive'
                }
                className="mt-2"
              >
                {stats.vectorDatabase.status}
              </Badge>
            </CardContent>
          </Card>

          {/* 성능 통계 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">처리 성능</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(stats.performance.cacheHitRate * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">캐시 적중률</p>
              <div className="mt-2 text-xs">
                <div>
                  이미지: {stats.performance.averageAnalysisTime.image}ms
                </div>
                <div>
                  비디오: {stats.performance.averageAnalysisTime.video}ms
                </div>
                <div>
                  텍스트: {stats.performance.averageAnalysisTime.text}ms
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI 모델 상태 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                AI 모델 상태
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.models.map((model, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {model.type}
                  </span>
                  <Badge
                    variant={
                      model.status === 'ready'
                        ? 'default'
                        : model.status === 'not_implemented'
                          ? 'outline'
                          : 'destructive'
                    }
                  >
                    {model.status === 'ready'
                      ? '준비됨'
                      : model.status === 'not_implemented'
                        ? '개발 중'
                        : model.status === 'not_loaded'
                          ? '미로딩'
                          : '오류'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 기능 안내 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">사용 가능한 기능</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-green-500" />
                이미지 AI 분석 ✅
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• MobileNet v2 모델 기반 특징 추출</li>
                <li>• 시각적 유사도 검색</li>
                <li>• 배치 처리 지원</li>
                <li>• 벡터 캐싱 시스템</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Video className="w-4 h-4 text-yellow-500" />
                비디오 AI 분석 🚧
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• 키프레임 기반 특징 추출 (개발 중)</li>
                <li>• 장면 변화 감지</li>
                <li>• 시간축 벡터 분석</li>
                <li>• 이미지-비디오 교차 검색</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                텍스트 AI 분석 🔮
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• 의미적 임베딩 기반 분석 (계획됨)</li>
                <li>• 코드 유사도 검색</li>
                <li>• 문서 내용 기반 추천</li>
                <li>• 다국어 지원</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-500" />
                통합 검색 시스템 🎯
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• 멀티모달 유사도 검색</li>
                <li>• 개인화 추천 알고리즘</li>
                <li>• 실시간 검색 결과</li>
                <li>• 고급 필터링 옵션</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 시작 안내 */}
      {!stats?.vectorDatabase.totalEmbeddings && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI 분석을 시작하세요</h3>
            <p className="text-muted-foreground mb-4">
              파일을 AI로 분석하여 시각적, 의미적 유사도 기반 추천을 받아보세요.
            </p>
            <p className="text-sm text-muted-foreground">
              💡 첫 번째 분석은 시간이 걸릴 수 있지만, 이후에는 캐시를 활용하여
              빠르게 처리됩니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
