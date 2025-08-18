'use client'

import React, { useState, useEffect, useCallback } from 'react'
import path from 'path'
import {
  Brain,
  Loader2,
  Search,
  ImageIcon,
  VideoIcon,
  FileTextIcon,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import LazyImage from '@/components/lazy-image'
import { BACKEND_API_URL } from '@/lib/config'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { isImage, isVideo, isText, isPdf } from '@/lib/utils'

interface SimilarFile {
  file: {
    filePath: string
  }
  similarity: number
}

type FileType = 'image' | 'video' | 'text'

interface SimilarFilesPanelProps {
  filePath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect: (filePath: string) => void
}

export const SimilarFilesPanel: React.FC<SimilarFilesPanelProps> = ({
  filePath,
  open,
  onOpenChange,
  onFileSelect,
}) => {
  const [similarFiles, setSimilarFiles] = useState<SimilarFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.7)
  const [limit, setLimit] = useState(10)
  const [selectedFileType, setSelectedFileType] = useState<FileType>('image')

  // 현재 파일의 타입을 감지하여 기본값 설정
  const detectFileType = useCallback((filePath: string): FileType => {
    if (isImage(filePath)) return 'image'
    if (isVideo(filePath)) return 'video'
    if (isText(filePath) || isPdf(filePath)) return 'text'
    return 'image' // 기본값
  }, [])

  // 파일 경로가 변경될 때 타입 자동 감지
  useEffect(() => {
    if (filePath) {
      const detectedType = detectFileType(filePath)
      setSelectedFileType(detectedType)
    }
  }, [filePath, detectFileType])

  const findSimilar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/ai-recommendations?filePath=${encodeURIComponent(filePath)}&threshold=${threshold}&limit=${limit}&fileType=${selectedFileType}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.message || '유사한 파일을 찾는 데 실패했습니다.'
        )
      }

      const data = await response.json()
      setSimilarFiles(data.recommendations || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [filePath, threshold, limit, selectedFileType])

  useEffect(() => {
    if (open) {
      findSimilar()
    }
  }, [open, findSimilar])

  const handleFileClick = (filePath: string) => {
    onFileSelect(filePath)
    onOpenChange(false)
  }

  const getTypeConfig = (fileType: FileType, currentFileType: FileType) => {
    const isCrossMedia = fileType !== currentFileType

    switch (fileType) {
      case 'image':
        return {
          title: isCrossMedia
            ? '유사한 이미지 찾기 (크로스 미디어)'
            : '유사한 이미지 찾기',
          description: isCrossMedia
            ? '현재 파일과 시각적으로 유사한 특징을 가진 이미지를 검색합니다.'
            : '현재 이미지와 유사한 시각적 특징을 가진 다른 이미지를 검색합니다.',
          icon: ImageIcon,
          emptyMessage: '유사한 이미지를 찾을 수 없습니다.',
        }
      case 'video':
        return {
          title: isCrossMedia
            ? '유사한 비디오 찾기 (크로스 미디어)'
            : '유사한 비디오 찾기',
          description: isCrossMedia
            ? '현재 파일과 시각적으로 유사한 특징을 가진 비디오를 검색합니다.'
            : '현재 비디오와 유사한 시각적 특징을 가진 다른 비디오를 검색합니다.',
          icon: VideoIcon,
          emptyMessage: '유사한 비디오를 찾을 수 없습니다.',
        }
      case 'text':
        return {
          title: '유사한 텍스트 찾기',
          description:
            '현재 텍스트와 유사한 의미를 가진 다른 텍스트 파일을 검색합니다.',
          icon: FileTextIcon,
          emptyMessage: '유사한 텍스트를 찾을 수 없습니다.',
        }
    }
  }

  const renderFilePreview = (file: SimilarFile) => {
    const { filePath: filePathStr } = file.file

    if (isImage(filePathStr)) {
      const fallbackIcon = (
        <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-blue-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )

      return (
        <LazyImage
          src={`${BACKEND_API_URL}/api/media${filePathStr}?thumbnail=true`}
          alt={filePathStr}
          width={200}
          height={128}
          className="w-full h-32 object-cover rounded-md"
          fallbackIcon={fallbackIcon}
        />
      )
    }

    if (isVideo(filePathStr)) {
      const fallbackIcon = (
        <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        </div>
      )

      return (
        <LazyImage
          src={`/api/thumbnail?path=${encodeURIComponent(filePathStr)}`}
          alt={filePathStr}
          width={200}
          height={128}
          className="w-full h-32 object-cover rounded-md"
          fallbackIcon={fallbackIcon}
        />
      )
    }

    // 텍스트나 기타 파일의 경우
    const currentType = detectFileType(filePath)
    const IconComponent = getTypeConfig(selectedFileType, currentType).icon
    return (
      <div className="w-full h-32 rounded-md bg-gray-200 flex items-center justify-center">
        <IconComponent className="w-8 h-8 text-gray-500" />
      </div>
    )
  }

  const currentFileType = detectFileType(filePath)
  const typeConfig = getTypeConfig(selectedFileType, currentFileType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-11/12 h-5/6 flex flex-col">
        <DialogHeader>
          <DialogTitle>{typeConfig.title}</DialogTitle>
          <DialogDescription>{typeConfig.description}</DialogDescription>
        </DialogHeader>

        {/* 검색 옵션 */}
        <div className="flex items-center space-x-4 p-4 border-b">
          {/* 파일 타입 선택 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">파일 타입</label>
            <Select
              value={selectedFileType}
              onValueChange={(value: FileType) => setSelectedFileType(value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image" disabled={currentFileType === 'text'}>
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4" />
                    <span>이미지</span>
                    {currentFileType === 'video' && (
                      <span className="text-xs text-muted-foreground">
                        (크로스)
                      </span>
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="video" disabled={currentFileType === 'text'}>
                  <div className="flex items-center space-x-2">
                    <VideoIcon className="w-4 h-4" />
                    <span>비디오</span>
                    {currentFileType === 'image' && (
                      <span className="text-xs text-muted-foreground">
                        (크로스)
                      </span>
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="text" disabled={currentFileType !== 'text'}>
                  <div className="flex items-center space-x-2">
                    <FileTextIcon className="w-4 h-4" />
                    <span>텍스트</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 유사도 조절 */}
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

          {/* 최대 결과 수 */}
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

          {/* 검색 버튼 */}
          <Button onClick={findSimilar} disabled={isLoading}>
            <Search className="mr-2 h-4 w-4" />
            검색
          </Button>
        </div>

        {/* 검색 결과 */}
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
                {typeConfig.emptyMessage}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {similarFiles.map(({ file, similarity }) => (
                <div
                  key={file.filePath}
                  className="relative group cursor-pointer"
                  onClick={() => handleFileClick(file.filePath)}
                >
                  {renderFilePreview({ file, similarity })}

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
