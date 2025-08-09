'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Folder,
  ChevronRight,
  Home,
  ArrowLeft,
  Grid,
  List,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import VideoPlayer from './video-player'
import ImageViewer from './image-viewer'
import dynamic from 'next/dynamic'
import { Toggle } from '@/components/ui/toggle'
import ListView from './list-view'
import GalleryView from './gallery-view'
import { useFileBrowser, FileItem, FolderTree } from '@/hooks/useFileBrowser'
import { BrowserHeader } from './browser-header'
import { FolderTree as FolderTreeComponent } from './folder-tree'
import { Breadcrumb } from './breadcrumb'

// 웹 검색 결과에 따른 SSR 안전 PDF 뷰어 로드
const PdfJsViewer = dynamic(() => import('./pdfjs-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <div>PDF 뷰어 컴포넌트 로딩 중...</div>
      </div>
    </div>
  ),
})

interface SelectedMedia {
  path: string
  name: string
  type: 'video' | 'image' | 'pdf'
}

export default function FileBrowser() {
  const {
    currentPath,
    files,
    loading,
    folderTree,
    navigateTo,
    navigateToParent,
    canNavigateBack,
  } = useFileBrowser('/')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null)
  const [renderPdfViewer, setRenderPdfViewer] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')
  
  useEffect(() => {
    if (selectedMedia?.type === 'pdf') {
      setRenderPdfViewer(false)
      const timer = setTimeout(() => setRenderPdfViewer(true), 150)
      return () => clearTimeout(timer)
    } else {
      setRenderPdfViewer(false)
    }
  }, [selectedMedia])

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateTo(file.path)
    } else if (
      file.mediaType &&
      (file.mediaType === 'video' ||
        file.mediaType === 'image' ||
        file.mediaType === 'pdf')
    ) {
      setSelectedMedia({
        path: file.path,
        name: file.name,
        type: file.mediaType,
      })
    }
  }
  
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pathSegments = currentPath.split('/').filter(Boolean)

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <FolderTreeComponent 
        tree={folderTree} 
        currentPath={currentPath} 
        onNavigate={navigateTo} 
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <BrowserHeader
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onNavigateParent={navigateToParent}
            isRoot={currentPath === '/'}
          />
          
          <Breadcrumb currentPath={currentPath} onNavigate={navigateTo} />
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">로딩 중...</div>
            </div>
          ) : (
            <div className={viewMode === 'list' ? 'p-4' : ''}>
              {viewMode === 'list' ? (
                <ListView files={filteredFiles} onFileClick={handleFileClick} />
              ) : (
                <GalleryView
                  files={filteredFiles}
                  onFileClick={handleFileClick}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Viewer Modals */}
      <Dialog
        open={!!selectedMedia}
        onOpenChange={() => setSelectedMedia(null)}
      >
        <DialogContent
          className={
            selectedMedia?.type === 'video'
              ? 'max-w-4xl w-full bg-gray-900 border-gray-700'
              : 'max-w-[95vw] max-h-[95vh] w-full h-full bg-gray-900 border-gray-700 p-0'
          }
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedMedia?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedMedia?.type === 'video' && (
            <VideoPlayer
              src={`/api/media${selectedMedia.path}`}
              onClose={() => setSelectedMedia(null)}
            />
          )}
          {selectedMedia?.type === 'image' && (
            <ImageViewer
              src={`/api/media${selectedMedia.path}`}
              alt={selectedMedia.name}
              onClose={() => setSelectedMedia(null)}
            />
          )}
          {selectedMedia?.type === 'pdf' && renderPdfViewer && (
            <PdfJsViewer
              src={`/api/media${selectedMedia.path}`}
              fileName={selectedMedia.name}
              onClose={() => setSelectedMedia(null)}
            />
          )}
          {selectedMedia?.type === 'pdf' && !renderPdfViewer && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <div className="text-lg">모달 준비 중...</div>
                <div className="text-sm text-gray-500">DOM 초기화 대기</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
