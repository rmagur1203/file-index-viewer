'use client'

import { Folder, Play, ImageIcon, FileText, File } from 'lucide-react'
import Image from 'next/image'
import type { FileItem } from '@/types'
import { useSettings } from '@/contexts/SettingsContext'

interface GalleryViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

export default function GalleryView({ files, onFileClick }: GalleryViewProps) {
  const { settings } = useSettings()

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
      return (
        <>
          <Image
            src={thumbnailUrl}
            alt={file.name}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                const fallback = document.createElement('div')
                fallback.className =
                  'w-full h-full flex items-center justify-center bg-muted'
                fallback.innerHTML = isVideo
                  ? '<svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>'
                  : '<svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>'
                parent.appendChild(fallback)
              }
            }}
            unoptimized={!isVideo}
          />
          <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isVideo ? (
              <Play className="w-8 h-8 text-foreground" />
            ) : (
              <ImageIcon className="w-8 h-8 text-foreground" />
            )}
          </div>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {files.map((file) => (
        <div
          key={file.path}
          className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 cursor-pointer transition-colors group"
          onClick={() => onFileClick(file)}
        >
          <div className="aspect-video bg-gray-700 relative overflow-hidden">
            {renderFilePreview(file)}
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
