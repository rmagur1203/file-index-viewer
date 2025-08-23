'use client'

import { useState, useEffect, useCallback } from 'react'
import FileBrowser from '@/components/file-browser'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { useBrowser } from '@/contexts/BrowserContext'
import { FileItem } from '@/types'
import { toast } from 'sonner'
import {
  Sparkles,
  RefreshCw,
  Settings,
  TrendingUp,
  Heart,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Slider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
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

interface RecommendationSettings {
  limit: number
  fileTypes: string[]
  minSimilarity: number
}

export default function RecommendationsPage() {
  const [initialFiles, setInitialFiles] = useState<FileItem[]>([])
  const [recommendations, setRecommendations] = useState<
    RecommendationResult[]
  >([])
  const [stats, setStats] = useState<RecommendationStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSettingsSummaryCollapsed, setIsSettingsSummaryCollapsed] = useState(
    () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(
          'recommendationSettingsSummaryCollapsed'
        )
        return saved === 'true'
      }
      return false
    }
  )
  const { viewMode, searchTerm } = useBrowser()
  const { files, loading, navigateTo } = useFileBrowser(undefined, initialFiles)

  // 추천 설정 (localStorage에서 로드)
  const [settings, setSettings] = useState<RecommendationSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('recommendationSettings')
      if (savedSettings) {
        return JSON.parse(savedSettings)
      }
    }
    return {
      limit: 20,
      fileTypes: ['image', 'video'],
      minSimilarity: 0.3,
    }
  })

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('recommendationSettings', JSON.stringify(settings))
    }
  }, [settings])

  // 접기/펼치기 상태 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'recommendationSettingsSummaryCollapsed',
        isSettingsSummaryCollapsed.toString()
      )
    }
  }, [isSettingsSummaryCollapsed])

  const fetchRecommendations = useCallback(
    async (showToast = false) => {
      try {
        setIsRefreshing(true)
        const API_BASE_URL =
          typeof window !== 'undefined'
            ? window.location.origin.replace('3000', '3001')
            : 'http://localhost:3001'

        // 추천 데이터와 통계 동시 요청 (사용자 설정 적용)
        const fileTypesParam = settings.fileTypes.join(',')
        const [recommendationsResponse, statsResponse] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/recommendations?limit=${settings.limit}&minSimilarity=${settings.minSimilarity}&fileTypes=${fileTypesParam}`
          ),
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
    },
    [settings]
  )

  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 설정 변경 시 즉시 새로운 추천 가져오기
  useEffect(() => {
    // 초기 로딩이 완료된 후에만 설정 변경에 반응
    let timeoutId: NodeJS.Timeout
    if (!isLoading) {
      timeoutId = setTimeout(() => {
        fetchRecommendations(false)
      }, 300) // 300ms 딜레이로 사용자 경험 개선
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [settings, fetchRecommendations, isLoading])

  const handleRefresh = () => {
    fetchRecommendations(true)
  }

  const handleSettingsChange = (
    newSettings: Partial<RecommendationSettings>
  ) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  const handleFileTypeToggle = (fileType: string, checked: boolean) => {
    const newFileTypes = checked
      ? [...settings.fileTypes, fileType]
      : settings.fileTypes.filter((type) => type !== fileType)

    // 최소 하나의 파일 타입은 선택되어야 함
    if (newFileTypes.length > 0) {
      handleSettingsChange({ fileTypes: newFileTypes })
    }
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
        <div className="flex gap-2">
          <Button
            onClick={() => (window.location.href = '/likes')}
            className="flex items-center gap-2"
          >
            <Heart className="w-4 h-4" />
            좋아요 관리하기
          </Button>
        </div>
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
            <div className="flex gap-2">
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>추천 설정</DialogTitle>
                    <DialogDescription>
                      원하는 추천 방식을 설정하세요. 좋아요한 파일들은 자동으로
                      제외됩니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* 추천 개수 설정 */}
                    <div className="space-y-2">
                      <Label htmlFor="limit">
                        추천 개수: {settings.limit}개
                      </Label>
                      <Slider
                        id="limit"
                        min={5}
                        max={50}
                        step={5}
                        value={[settings.limit]}
                        onValueChange={(value) =>
                          handleSettingsChange({ limit: value[0] })
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>5개</span>
                        <span>50개</span>
                      </div>
                    </div>

                    {/* 최소 유사도 설정 */}
                    <div className="space-y-2">
                      <Label htmlFor="similarity">
                        최소 유사도: {Math.round(settings.minSimilarity * 100)}%
                      </Label>
                      <Slider
                        id="similarity"
                        min={0.1}
                        max={0.8}
                        step={0.1}
                        value={[settings.minSimilarity]}
                        onValueChange={(value) =>
                          handleSettingsChange({ minSimilarity: value[0] })
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>10%</span>
                        <span>80%</span>
                      </div>
                    </div>

                    {/* 파일 타입 설정 */}
                    <div className="space-y-3">
                      <Label>추천할 파일 타입</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="image"
                            checked={settings.fileTypes.includes('image')}
                            onCheckedChange={(checked) =>
                              handleFileTypeToggle('image', checked as boolean)
                            }
                          />
                          <Label htmlFor="image">이미지</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="video"
                            checked={settings.fileTypes.includes('video')}
                            onCheckedChange={(checked) =>
                              handleFileTypeToggle('video', checked as boolean)
                            }
                          />
                          <Label htmlFor="video">비디오</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="text"
                            checked={settings.fileTypes.includes('text')}
                            onCheckedChange={(checked) =>
                              handleFileTypeToggle('text', checked as boolean)
                            }
                          />
                          <Label htmlFor="text">텍스트</Label>
                        </div>
                      </div>
                    </div>

                    {/* 좋아요 제외 안내 */}
                    <div className="bg-muted/50 border border-muted p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-foreground">
                          자동 제외 기능
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        이미 좋아요를 누른 파일들은 추천에서 자동으로
                        제외됩니다.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
          <div className="flex gap-2">
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>추천 설정</DialogTitle>
                  <DialogDescription>
                    원하는 추천 방식을 설정하세요. 좋아요한 파일들은 자동으로
                    제외됩니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* 추천 개수 설정 */}
                  <div className="space-y-2">
                    <Label htmlFor="limit">추천 개수: {settings.limit}개</Label>
                    <Slider
                      id="limit"
                      min={5}
                      max={50}
                      step={5}
                      value={[settings.limit]}
                      onValueChange={(value) =>
                        handleSettingsChange({ limit: value[0] })
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5개</span>
                      <span>50개</span>
                    </div>
                  </div>

                  {/* 최소 유사도 설정 */}
                  <div className="space-y-2">
                    <Label htmlFor="similarity">
                      최소 유사도: {Math.round(settings.minSimilarity * 100)}%
                    </Label>
                    <Slider
                      id="similarity"
                      min={0.1}
                      max={0.8}
                      step={0.1}
                      value={[settings.minSimilarity]}
                      onValueChange={(value) =>
                        handleSettingsChange({ minSimilarity: value[0] })
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10%</span>
                      <span>80%</span>
                    </div>
                  </div>

                  {/* 파일 타입 설정 */}
                  <div className="space-y-3">
                    <Label>추천할 파일 타입</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="image"
                          checked={settings.fileTypes.includes('image')}
                          onCheckedChange={(checked) =>
                            handleFileTypeToggle('image', checked as boolean)
                          }
                        />
                        <Label htmlFor="image">이미지</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="video"
                          checked={settings.fileTypes.includes('video')}
                          onCheckedChange={(checked) =>
                            handleFileTypeToggle('video', checked as boolean)
                          }
                        />
                        <Label htmlFor="video">비디오</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="text"
                          checked={settings.fileTypes.includes('text')}
                          onCheckedChange={(checked) =>
                            handleFileTypeToggle('text', checked as boolean)
                          }
                        />
                        <Label htmlFor="text">텍스트</Label>
                      </div>
                    </div>
                  </div>

                  {/* 좋아요 제외 안내 */}
                  <div className="bg-muted/50 border border-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-foreground">
                        자동 제외 기능
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      이미 좋아요를 누른 파일들은 추천에서 자동으로 제외됩니다.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

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

        {/* 설정 요약 카드 */}
        <Card className="mb-4 bg-muted/30 border-muted">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                추천 설정 및 제외 정보
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setIsSettingsSummaryCollapsed(!isSettingsSummaryCollapsed)
                }
                className="p-1 h-auto"
              >
                {isSettingsSummaryCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {!isSettingsSummaryCollapsed && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-foreground">
                    추천 개수:
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {settings.limit}개
                  </span>
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    최소 유사도:
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {Math.round(settings.minSimilarity * 100)}%
                  </span>
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    파일 타입:
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {settings.fileTypes.join(', ')}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Heart className="w-3 h-3 text-red-500" />
                <span>
                  좋아요한 {stats.totalLikedFiles}개 파일은 추천에서 자동
                  제외됩니다
                </span>
              </div>
            </CardContent>
          )}
        </Card>

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
