"use client"

import { Folder, Play, ImageIcon, FileText } from 'lucide-react'
import Image from 'next/image'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  path: string
  isVideo?: boolean
  isImage?: boolean
  isPdf?: boolean
}

interface GalleryViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

export default function GalleryView({ files, onFileClick }: GalleryViewProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
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
            {file.type === 'directory' ? (
              <div className="w-full h-full flex items-center justify-center">
                <Folder className="w-12 h-12 text-yellow-500" />
              </div>
            ) : file.isVideo ? (
              <>
                <Image
                  src={`/api/thumbnail?path=${encodeURIComponent(file.path)}`}
                  alt={`${file.name} 썸네일`}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      const fallback = document.createElement('div')
                      fallback.className = 'w-full h-full flex items-center justify-center bg-gray-600'
                      fallback.innerHTML = '<svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>'
                      parent.appendChild(fallback)
                    }
                  }}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatFileSize(file.size)}
                </div>
              </>
            ) : file.isImage ? (
              <>
                <Image
                  src={`/api/video${file.path}`}
                  alt={file.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      const fallback = document.createElement('div')
                      fallback.className = 'w-full h-full flex items-center justify-center bg-gray-600'
                      fallback.innerHTML = '<svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>'
                      parent.appendChild(fallback)
                    }
                  }}
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatFileSize(file.size)}
                </div>
              </>
            ) : file.isPdf ? (
              <>
                <div className="w-full h-full flex items-center justify-center bg-orange-100">
                  <FileText className="w-12 h-12 text-orange-600" />
                </div>
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatFileSize(file.size)}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-600">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="text-sm font-medium text-white truncate" title={file.name}>
              {file.name}
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
