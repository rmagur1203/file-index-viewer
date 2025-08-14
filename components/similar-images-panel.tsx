'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, AlertCircle, Brain, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import Image from 'next/image'
import { Input } from '@/components/ui/input'

interface SimilarImage {
  file: {
    path: string
    type: string
    metadata?: {
      width?: number
      height?: number
      size: number
    }
  }
  similarity: number
  reason: string
  modelUsed: string
}

interface SimilarImagesResponse {
  success: boolean
  queryFile: string
  recommendations: SimilarImage[]
  total: number
  parameters: {
    limit: number
    threshold: number
    model: string
  }
}

interface SimilarImagesPanelProps {
  filePath: string
  onClose: () => void
  onImageClick?: (imagePath: string) => void
}

export default function SimilarImagesPanel({
  filePath,
  onClose,
  onImageClick,
}: SimilarImagesPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SimilarImagesResponse | null>(null)
  const [threshold, setThreshold] = useState([0.7])
  const [limit, setLimit] = useState([10])

  const searchSimilarImages = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        filePath,
        threshold: threshold[0].toString(),
        limit: limit[0].toString(),
        fileType: 'image',
      })

      const response = await fetch(`/api/ai-recommendations?${params}`)
      const data = await response.json()

      if (data.success) {
        setResults(data)
      } else {
        setError(data.error || '알 수 없는 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Similar images search error:', error)
      setError('유사한 이미지 검색 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [filePath, threshold, limit])

  useEffect(() => {
    searchSimilarImages()
  }, [searchSimilarImages])

  const getFileName = (path: string) => {
    return path.split('/').pop() || path
  }

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500" />
              유사한 이미지 검색
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            기준 이미지:{' '}
            <span className="font-medium">{getFileName(filePath)}</span>
          </div>

          {/* 검색 설정 */}
          <div className="flex gap-4 items-center pt-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-medium">유사도 임계값:</span>
              <Slider
                value={threshold}
                onValueChange={setThreshold}
                max={1}
                min={0.1}
                step={0.1}
                className="flex-1 max-w-32"
              />
              <span className="text-xs text-muted-foreground min-w-10">
                {Math.round(threshold[0] * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">최대 결과:</span>
              <Slider
                value={limit}
                onValueChange={setLimit}
                max={50}
                min={5}
                step={5}
                className="w-24"
              />
              <Input
                type="number"
                value={limit[0]}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  if (!isNaN(value) && value >= 1 && value <= 100) {
                    setLimit([value])
                  }
                }}
                className="h-8 w-16 text-center"
                min="1"
                max="100"
              />
            </div>

            <Button
              size="sm"
              onClick={searchSimilarImages}
              disabled={isLoading}
              className="min-w-16"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && !results && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">
                  AI가 유사한 이미지를 검색하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 font-medium mb-2">검색 오류</p>
                <p className="text-muted-foreground text-sm">{error}</p>
                <Button
                  variant="outline"
                  onClick={searchSimilarImages}
                  className="mt-4"
                >
                  다시 시도
                </Button>
              </div>
            </div>
          )}

          {results && (
            <div className="h-full flex flex-col">
              {/* 결과 요약 */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">{results.total}개</span> 유사
                  이미지 발견
                </div>
                <Badge variant="secondary">{results.parameters.model}</Badge>
                <div className="text-xs text-muted-foreground">
                  임계값 {Math.round(results.parameters.threshold * 100)}% 이상
                </div>
              </div>

              {/* 결과 리스트 */}
              <ScrollArea className="h-full">
                {results.recommendations.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {results.recommendations.map((item, index) => (
                      <Card
                        key={index}
                        className="cursor-pointer hover:ring-2 hover:ring-primary transition-all duration-200"
                        onClick={() => onImageClick?.(item.file.path)}
                      >
                        <div className="aspect-square relative overflow-hidden rounded-t-lg">
                          <Image
                            src={`/api/media${item.file.path}`}
                            alt={getFileName(item.file.path)}
                            fill
                            className="object-cover"
                            unoptimized
                          />

                          {/* 유사도 배지 */}
                          <div className="absolute top-2 right-2">
                            <Badge
                              variant={
                                item.similarity >= 90
                                  ? 'default'
                                  : item.similarity >= 80
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-xs"
                            >
                              {item.similarity}%
                            </Badge>
                          </div>

                          {/* 보기 아이콘 */}
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                        </div>

                        <div className="p-3">
                          <div className="text-sm font-medium truncate mb-1">
                            {getFileName(item.file.path)}
                          </div>

                          {item.file.metadata && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {item.file.metadata.width &&
                                item.file.metadata.height && (
                                  <div>
                                    {item.file.metadata.width} ×{' '}
                                    {item.file.metadata.height}
                                  </div>
                                )}
                              {item.file.metadata.size && (
                                <div>
                                  {formatFileSize(item.file.metadata.size)}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground mt-2">
                            {item.reason}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground font-medium mb-2">
                        유사한 이미지를 찾을 수 없습니다
                      </p>
                      <p className="text-sm text-muted-foreground">
                        임계값을 낮춰보거나 다른 이미지를 시도해보세요
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
