'use client'

import { useState, useEffect } from 'react'
import FileBrowser from '@/components/file-browser'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { useBrowser } from '@/contexts/BrowserContext'
import { FileItem } from '@/types'
import { toast } from 'sonner'
import { Sparkles, RefreshCw, Settings, TrendingUp, Heart } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@repo/ui'

interface RecommendationResult {
  file: {
    id: string
    filePath: string
    fileType: 'image' | 'video' | 'text'
    modelName: string
    metadata?: {
      width?: number
      height?: number
      duration?: number
      size: number
      hash: string
    }
  }
  score: number
  reason: string
}

interface RecommendationStats {
  totalLikedFiles: number
  likedByType: Record<string, number>
  availableForRecommendation: Record<string, number>
}

export default function RecommendationsPage() {
  const [initialFiles, setInitialFiles] = useState<FileItem[]>([])
  const [recommendations, setRecommendations] = useState<
    RecommendationResult[]
  >([])
  const [stats, setStats] = useState<RecommendationStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { viewMode, searchTerm } = useBrowser()
  const { files, loading, navigateTo } = useFileBrowser(undefined, initialFiles)

  const fetchRecommendations = async (showToast = false) => {
    try {
      setIsRefreshing(true)
      const API_BASE_URL =
        typeof window !== 'undefined'
          ? window.location.origin.replace('3000', '3001')
          : 'http://localhost:3001'

      // 추천 데이터와 통계 동시 요청
      const [recommendationsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations?limit=20`),
        fetch(`${API_BASE_URL}/api/recommendations/stats`),
      ])

      if (recommendationsResponse.ok && statsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json()
        const statsData = await statsResponse.json()

        setRecommendations(recommendationsData)
        setStats(statsData)

        // 추천 파일들을 FileItem 형식으로 변환
        const fileItems: FileItem[] = recommendationsData.map(
          (rec: RecommendationResult) => {
            const mediaType =
              rec.file.fileType === 'image'
                ? 'image'
                : rec.file.fileType === 'video'
                  ? 'video'
                  : undefined

            // 썸네일 URL 생성 (다른 컴포넌트와 동일한 방식)
            let thumbnail: string | undefined
            if (mediaType === 'image') {
              thumbnail = `${API_BASE_URL}/api/media${rec.file.filePath}`
            } else if (mediaType === 'video') {
              thumbnail = `${API_BASE_URL}/api/thumbnail?path=${encodeURIComponent(rec.file.filePath)}`
            }

            return {
              name: rec.file.filePath.split('/').pop() || '',
              path: rec.file.filePath,
              type: 'file' as const,
              size: rec.file.metadata?.size,
              mediaType,
              thumbnail,
              // 추천 관련 정보 추가
              recommendationScore: rec.score,
              recommendationReason: rec.reason,
            }
          }
        )

        setInitialFiles(fileItems)

        if (showToast) {
          toast.success(
            `${recommendationsData.length}개의 추천 파일을 찾았습니다.`
          )
        }
      } else {
        throw new Error('Failed to fetch recommendations')
      }
    } catch (err) {
      console.error('Recommendation fetch error:', err)
      toast.error('추천을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const handleRefresh = () => {
    fetchRecommendations(true)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span>AI가 당신의 취향을 분석하고 있습니다...</span>
        </div>
      </div>
    )
  }

  if (!stats || stats.totalLikedFiles === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Heart className="w-24 h-24 mb-6 text-muted-foreground/50" />
        <h2 className="text-2xl font-bold mb-4">
          추천을 받으려면 좋아요가 필요해요
        </h2>
        <p className="text-lg mb-6 text-center max-w-md">
          먼저 마음에 드는 이미지나 영상에 좋아요를 눌러주세요. AI가 당신의
          취향을 학습해서 맞춤 추천을 제공할게요!
        </p>
        <Button
          onClick={() => (window.location.href = '/likes')}
          className="flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          좋아요 관리하기
        </Button>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">AI 추천</h1>
                <p className="text-muted-foreground">
                  당신의 취향을 바탕으로 한 맞춤 추천
                </p>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              새로고침
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
          <TrendingUp className="w-24 h-24 mb-6 text-muted-foreground/50" />
          <h2 className="text-2xl font-bold mb-4">추천할 파일이 없습니다</h2>
          <p className="text-lg mb-6 text-center max-w-md">
            더 많은 파일에 좋아요를 눌러주시거나, AI 분석을 먼저 실행해보세요.
          </p>
          <div className="flex gap-4">
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              다시 시도
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/ai-recommendations')}
            >
              <Settings className="w-4 h-4 mr-2" />
              AI 분석 실행
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">AI 추천</h1>
              <p className="text-muted-foreground">
                당신의 취향을 바탕으로 한 맞춤 추천
              </p>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            새로고침
          </Button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                좋아요한 파일
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLikedFiles}</div>
              <p className="text-xs text-muted-foreground">
                이미지 {stats.likedByType.image || 0}개, 비디오{' '}
                {stats.likedByType.video || 0}개
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">추천 가능</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.availableForRecommendation.image || 0) +
                  (stats.availableForRecommendation.video || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                AI 분석 완료된 파일
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">추천된 파일</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recommendations.length}</div>
              <p className="text-xs text-muted-foreground">
                개인화된 추천 결과
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">평균 점수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recommendations.length > 0
                  ? (
                      (recommendations.reduce(
                        (sum, rec) => sum + rec.score,
                        0
                      ) /
                        recommendations.length) *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">추천 정확도</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 파일 브라우저 */}
      <div className="flex-1 overflow-y-auto">
        <FileBrowser
          files={files}
          loading={loading}
          navigateTo={navigateTo}
          searchTerm={searchTerm}
          viewMode={viewMode}
          isRecommendationView={true}
        />
      </div>
    </div>
  )
}
