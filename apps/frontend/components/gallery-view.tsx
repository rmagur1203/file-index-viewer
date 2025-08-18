'use client'

import {
  Folder,
  Play,
  ImageIcon,
  FileText,
  File,
  Brain,
  Heart,
} from 'lucide-react'
import LazyImage from '@/components/lazy-image'
import type { FileItem } from '@/types'
import { useSettings } from '@/contexts/SettingsContext'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface GalleryViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
  onFindSimilar?: (
    filePath: string,
    mediaType: 'image' | 'video' | 'pdf' | 'text'
  ) => void
}

export default function GalleryView({
  files,
  onFileClick,
  onFindSimilar,
}: GalleryViewProps) {
  const { settings } = useSettings()
  const [likedFiles, setLikedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchLikedFiles = async () => {
      try {
        const API_BASE_URL =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await fetch(`${API_BASE_URL}/api/likes`)
        if (response.ok) {
          const likedPaths = await response.json()
          setLikedFiles(new Set(likedPaths))
        }
      } catch (error) {
        console.error('Failed to fetch liked files:', error)
      }
    }
    fetchLikedFiles()
  }, [])

  const handleLikeClick = async (
    e: React.MouseEvent<HTMLButtonElement>,
    file: FileItem
  ) => {
    e.stopPropagation()
    const isLiked = likedFiles.has(file.path)
    const newLikedFiles = new Set(likedFiles)

    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      if (isLiked) {
        const response = await fetch(`${API_BASE_URL}/api/likes${file.path}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          newLikedFiles.delete(file.path)
          toast.success(`${file.name}을(를) 좋아요에서 제거했습니다.`)
        } else {
          throw new Error('Failed to unlike the file.')
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/likes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path }),
        })
        if (response.ok) {
          newLikedFiles.add(file.path)
          toast.success(`${file.name}을(를) 좋아요에 추가했습니다.`)
        } else {
          throw new Error('Failed to like the file.')
        }
      }
      setLikedFiles(newLikedFiles)
    } catch (error) {
      console.error(error)
      toast.error('작업을 완료하지 못했습니다.')
    }
  }

  // 썸네일 크기에 따른 그리드 컬럼 수 설정
  const getGridColumns = () => {
    switch (settings.thumbnailSize) {
      case 'small':
        return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
      case 'medium':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      case 'large':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4'
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
    }
  }

  const getDisplayName = (file: FileItem) => {
    if (file.type === 'directory' || settings.showFileExtensions) {
      return file.name
    }

    // 확장자 제거
    const lastDotIndex = file.name.lastIndexOf('.')
    if (lastDotIndex > 0) {
      return file.name.substring(0, lastDotIndex)
    }
    return file.name
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const handleSimilarClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    filePath: string,
    mediaType: 'image' | 'video' | 'pdf' | 'text'
  ) => {
    e.stopPropagation() // Prevent onFileClick from firing
    onFindSimilar?.(filePath, mediaType)
  }

  const renderFilePreview = (file: FileItem) => {
    if (file.type === 'directory') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <Folder className="w-12 h-12 text-yellow-500" />
        </div>
      )
    }

    if (file.mediaType === 'image' || file.mediaType === 'video') {
      const isVideo = file.mediaType === 'video'
      const thumbnailUrl = isVideo
        ? `/api/thumbnail?path=${encodeURIComponent(file.path)}`
        : `/api/media${file.path}`

      const fallbackIcon = isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <svg
            className="w-8 h-8 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
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
        <>
          <LazyImage
            src={thumbnailUrl}
            alt={file.name}
            fill
            className="object-cover"
            unoptimized={!isVideo}
            fallbackIcon={fallbackIcon}
          />
          <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isVideo ? (
              <Play className="w-8 h-8 text-foreground" />
            ) : (
              <ImageIcon className="w-8 h-8 text-foreground" />
            )}
          </div>
          {onFindSimilar && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title={isVideo ? '유사한 비디오 찾기' : '유사한 이미지 찾기'}
              onClick={(e) =>
                handleSimilarClick(e, file.path, isVideo ? 'video' : 'image')
              }
            >
              <Brain className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title={likedFiles.has(file.path) ? '좋아요 취소' : '좋아요'}
            onClick={(e) => handleLikeClick(e, file)}
          >
            <Heart
              className={`w-4 h-4 ${
                likedFiles.has(file.path) ? 'text-red-500 fill-current' : ''
              }`}
            />
          </Button>
          <div className="absolute bottom-2 right-2 bg-background/70 text-foreground text-xs px-2 py-1 rounded">
            {formatFileSize(file.size)}
          </div>
        </>
      )
    }

    if (file.mediaType === 'pdf') {
      return (
        <>
          <div className="w-full h-full flex items-center justify-center bg-orange-100">
            <FileText className="w-12 h-12 text-orange-600" />
          </div>
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <FileText className="w-8 h-8 text-white" />
          </div>
          {onFindSimilar && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title="유사한 텍스트 찾기"
              onClick={(e) => handleSimilarClick(e, file.path, 'text')}
            >
              <Brain className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title={likedFiles.has(file.path) ? '좋아요 취소' : '좋아요'}
            onClick={(e) => handleLikeClick(e, file)}
          >
            <Heart
              className={`w-4 h-4 ${
                likedFiles.has(file.path) ? 'text-red-500 fill-current' : ''
              }`}
            />
          </Button>
          <div className="absolute bottom-2 right-2 bg-background/70 text-foreground text-xs px-2 py-1 rounded">
            {formatFileSize(file.size)}
          </div>
        </>
      )
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-600">
        <File className="w-8 h-8 text-gray-400" />
      </div>
    )
  }

  return (
    <div className={`grid ${getGridColumns()} gap-4 p-4`}>
      {files.map((file) => (
        <div
          key={file.path}
          className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 cursor-pointer transition-colors group"
          onClick={() => onFileClick(file)}
        >
          <div className="aspect-video bg-gray-700 relative overflow-hidden">
            {renderFilePreview(file)}
            {file.mediaType === 'image' && onFindSimilar && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="유사한 이미지 찾기"
                onClick={(e) => handleSimilarClick(e, file.path, 'image')}
              >
                <Brain className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title={likedFiles.has(file.path) ? '좋아요 취소' : '좋아요'}
              onClick={(e) => handleLikeClick(e, file)}
            >
              <Heart
                className={`w-4 h-4 ${likedFiles.has(file.path) ? 'text-red-500 fill-current' : ''}`}
              />
            </Button>
          </div>
          <div className="p-3">
            <h3
              className="text-sm font-medium text-white truncate"
              title={file.name}
            >
              {getDisplayName(file)}
            </h3>
            {file.type === 'file' && (
              <p className="text-xs text-gray-400 mt-1">
                {formatFileSize(file.size)}
              </p>
            )}
          </div>
        </div>
      ))}
      {files.length === 0 && (
        <div className="col-span-full text-center py-16 text-gray-400">
          폴더가 비어있습니다.
        </div>
      )}
    </div>
  )
}
