'use client'

import {
  Folder,
  File,
  Video,
  ImageIcon,
  Lock,
  FileText,
  Heart,
} from 'lucide-react'
import Image from 'next/image'
import type { FileItem } from '@/types'
import { useSettings } from '@/contexts/SettingsContext'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'

interface ListViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

export default function ListView({ files, onFileClick }: ListViewProps) {
  const { settings } = useSettings()
  const [likedFiles, setLikedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchLikedFiles = async () => {
      try {
        const response = await fetch('/api/likes')
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
      if (isLiked) {
        const response = await fetch(`/api/likes/${file.path}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          newLikedFiles.delete(file.path)
          toast.success(`${file.name}을(를) 좋아요에서 제거했습니다.`)
        } else {
          throw new Error('Failed to unlike the file.')
        }
      } else {
        const response = await fetch('/api/likes', {
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

  // 썸네일 크기에 따른 이미지 크기 설정
  const getThumbnailSize = () => {
    switch (settings.thumbnailSize) {
      case 'small':
        return 'w-12 h-9'
      case 'medium':
        return 'w-16 h-12'
      case 'large':
        return 'w-20 h-16'
      default:
        return 'w-16 h-12'
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

  const getIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
    }

    switch (file.mediaType) {
      case 'video':
        return <Video className="w-5 h-5 text-red-500 flex-shrink-0" />
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
      case 'pdf':
        return <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
      default:
        return <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderIcon = (file: FileItem) => {
    if (file.accessDenied) {
      return <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
    }
    if (file.type === 'directory') {
      return <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
    }
    if (file.mediaType === 'video' || file.mediaType === 'image') {
      const isVideo = file.mediaType === 'video'
      const thumbnailUrl = isVideo
        ? `/api/thumbnail?path=${encodeURIComponent(file.path)}`
        : `/api/media${file.path}`
      return (
        <div
          className={`relative ${getThumbnailSize()} bg-muted rounded overflow-hidden flex-shrink-0`}
        >
          <Image
            src={thumbnailUrl}
            alt={`${file.name} preview`}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                const icon = document.createElement('div')
                icon.className =
                  'w-full h-full flex items-center justify-center'
                icon.innerHTML = isVideo
                  ? '<svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>'
                  : '<svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>'
                parent.appendChild(icon)
              }
            }}
            unoptimized={!isVideo}
          />
        </div>
      )
    }
    if (file.mediaType === 'pdf') {
      return <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
    }
    return <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />
  }

  return (
    <div className="bg-card rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3 font-medium">이름</th>
            <th className="text-left p-3 font-medium w-24">크기</th>
            <th className="text-left p-3 font-medium w-40">수정일</th>
            <th className="text-left p-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => (
            <tr
              key={file.path}
              className={`border-t border-border hover:bg-muted cursor-pointer ${
                index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
              }`}
              onClick={() => onFileClick(file)}
            >
              <td className="p-3">
                <div className="flex items-center gap-3">
                  {renderIcon(file)}
                  <span
                    className={`truncate ${file.accessDenied ? 'text-muted-foreground' : ''}`}
                    title={
                      file.accessDenied ? '권한이 필요한 파일입니다' : file.name
                    }
                  >
                    {getDisplayName(file)}
                    {file.accessDenied && (
                      <span className="ml-2 text-xs text-red-400">
                        (권한 필요)
                      </span>
                    )}
                  </span>
                </div>
              </td>
              <td className="p-3 text-muted-foreground text-sm">
                {file.type === 'directory' ? '-' : formatFileSize(file.size)}
              </td>
              <td className="p-3 text-muted-foreground text-sm">
                {formatDate(file.modifiedAt)}
              </td>
              <td className="p-3">
                {file.type === 'file' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleLikeClick(e, file)}
                    className="text-muted-foreground hover:text-foreground"
                    title={likedFiles.has(file.path) ? '좋아요 취소' : '좋아요'}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        likedFiles.has(file.path)
                          ? 'text-red-500 fill-current'
                          : ''
                      }`}
                    />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          폴더가 비어있습니다.
        </div>
      )}
    </div>
  )
}
