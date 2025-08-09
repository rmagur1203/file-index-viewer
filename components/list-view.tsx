'use client'

import { Folder, File, Video, ImageIcon, Lock, FileText } from 'lucide-react'
import Image from 'next/image'
import type { FileItem } from '@/types'

interface ListViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

export default function ListView({ files, onFileClick }: ListViewProps) {
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
        return <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
        <div className="relative w-16 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
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
    return <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="text-left p-3 font-medium">이름</th>
            <th className="text-left p-3 font-medium w-24">크기</th>
            <th className="text-left p-3 font-medium w-40">수정일</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => (
            <tr
              key={file.path}
              className={`border-t border-gray-700 hover:bg-gray-700 cursor-pointer ${
                index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'
              }`}
              onClick={() => onFileClick(file)}
            >
              <td className="p-3">
                <div className="flex items-center gap-3">
                  {renderIcon(file)}
                  <span
                    className={`truncate ${file.accessDenied ? 'text-gray-500' : ''}`}
                    title={
                      file.accessDenied ? '권한이 필요한 파일입니다' : file.name
                    }
                  >
                    {file.name}
                    {file.accessDenied && (
                      <span className="ml-2 text-xs text-red-400">
                        (권한 필요)
                      </span>
                    )}
                  </span>
                </div>
              </td>
              <td className="p-3 text-gray-400 text-sm">
                {file.type === 'directory' ? '-' : formatFileSize(file.size)}
              </td>
              <td className="p-3 text-gray-400 text-sm">
                {formatDate(file.modified)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          폴더가 비어있습니다.
        </div>
      )}
    </div>
  )
}
