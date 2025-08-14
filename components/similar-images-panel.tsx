'use client'

import React, { useState, useEffect, useCallback } from 'react'
import path from 'path'
import { Brain, Loader2, Search, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { isImage } from '@/lib/utils'

interface SimilarFile {
  file: {
    filePath: string
  }
  similarity: number
}

interface SimilarImagesPanelProps {
  filePath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImageSelect: (imagePath: string) => void
}

export const SimilarImagesPanel: React.FC<SimilarImagesPanelProps> = ({
  filePath,
  open,
  onOpenChange,
  onImageSelect,
}) => {
  const [similarFiles, setSimilarFiles] = useState<SimilarFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.7)
  const [limit, setLimit] = useState(10)

  const findSimilar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ai-recommendations?filePath=${encodeURIComponent(filePath)}&threshold=${threshold}&limit=${limit}&fileType=image`
      )
      if (!response.ok) {
        throw new Error('유사한 이미지를 찾는 데 실패했습니다.')
      }
      const data = await response.json()
      setSimilarFiles(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [filePath, threshold, limit])

  useEffect(() => {
    if (open) {
      findSimilar()
    }
  }, [open, findSimilar])

  const handleImageClick = (filePath: string) => {
    onImageSelect(filePath)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-11/12 h-5/6 flex flex-col">
        <DialogHeader>
          <DialogTitle>유사한 이미지 찾기</DialogTitle>
          <DialogDescription>
            현재 이미지와 유사한 시각적 특징을 가진 다른 이미지를 검색합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-4 p-4 border-b">
          <div className="flex-grow flex items-center space-x-2">
            <label htmlFor="threshold" className="text-sm font-medium">
              유사도 ({(threshold * 100).toFixed(0)}%)
            </label>
            <Slider
              id="threshold"
              min={0.1}
              max={0.99}
              step={0.01}
              value={[threshold]}
              onValueChange={(value) => setThreshold(value[0])}
              className="w-48"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="limit" className="text-sm font-medium">
              최대 결과
            </label>
            <Input
              id="limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-20"
            />
          </div>
          <Button onClick={findSimilar} disabled={isLoading}>
            <Search className="mr-2 h-4 w-4" />
            검색
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <ScrollArea className="h-full p-4">
            {isLoading && (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">검색 중...</span>
              </div>
            )}
            {error && <div className="text-red-500 text-center">{error}</div>}
            {!isLoading && !error && similarFiles.length === 0 && (
              <div className="text-center text-gray-500">
                유사한 이미지를 찾을 수 없습니다.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {similarFiles.map(({ file, similarity }) => (
                <div
                  key={file.filePath}
                  className="relative group cursor-pointer"
                  onClick={() => handleImageClick(file.filePath)}
                >
                  {isImage(file.filePath) ? (
                    <img
                      src={`/api/media${file.filePath}?thumbnail=true`}
                      alt={file.filePath}
                      className="w-full h-32 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full h-32 rounded-md bg-gray-200 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-gray-500" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs text-center p-1">
                      {path.basename(file.filePath)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="absolute top-1 right-1">
                    {(similarity * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
