'use client'

import React, { useState, useEffect, useCallback } from 'react'
import path from 'path'
import { Brain, FileText, Loader2, Search, X } from 'lucide-react'
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
import { isText } from '@/lib/utils'

interface SimilarFile {
  file: {
    filePath: string
  }
  similarity: number
}

interface SimilarTextsPanelProps {
  filePath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTextSelect: (textPath: string) => void
}

export const SimilarTextsPanel: React.FC<SimilarTextsPanelProps> = ({
  filePath,
  open,
  onOpenChange,
  onTextSelect,
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
        `/api/ai-recommendations?filePath=${encodeURIComponent(filePath)}&threshold=${threshold}&limit=${limit}&fileType=text`
      )
      if (!response.ok) {
        throw new Error('유사한 텍스트를 찾는 데 실패했습니다.')
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

  const handleTextClick = (filePath: string) => {
    onTextSelect(filePath)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-11/12 h-5/6 flex flex-col">
        <DialogHeader>
          <DialogTitle>유사한 텍스트 찾기</DialogTitle>
          <DialogDescription>
            현재 텍스트와 유사한 의미를 가진 다른 텍스트 파일을 검색합니다.
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
                유사한 텍스트를 찾을 수 없습니다.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {similarFiles.map(({ file, similarity }) => (
                <div
                  key={file.filePath}
                  className="relative group cursor-pointer border rounded-lg p-4 hover:bg-gray-50"
                  onClick={() => handleTextClick(file.filePath)}
                >
                  <div className="flex items-start space-x-4">
                    <FileText className="w-6 h-6 text-gray-500 mt-1" />
                    <div className="flex-grow">
                      <p className="font-semibold text-sm truncate">
                        {path.basename(file.filePath)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {path.dirname(file.filePath)}
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary" className="absolute top-2 right-2">
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
