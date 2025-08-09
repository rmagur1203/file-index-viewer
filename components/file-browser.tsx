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
import { Toggle } from '@/components/ui/toggle'
import ListView from './list-view'
import GalleryView from './gallery-view'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  path: string
  mediaType?: 'video' | 'image' | 'pdf' | 'file'
  accessDenied?: boolean
}

interface SelectedMedia {
  path: string
  name: string
  type: 'video' | 'image' | 'pdf'
}

interface FolderTree {
  [key: string]: FolderTree
}

export default function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null)
  const [renderPdfViewer, setRenderPdfViewer] = useState(false)
  const [folderTree, setFolderTree] = useState<FolderTree>({})
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')

  useEffect(() => {
    fetchFiles(currentPath)
    fetchFolderTree()
  }, [currentPath])

  // 웹 검색 결과: 모달 열린 후 PDF 뷰어 렌더링 지연
  useEffect(() => {
    if (selectedMedia?.type === 'pdf') {
      setRenderPdfViewer(false) // 먼저 리셋
      const timer = setTimeout(() => {
        setRenderPdfViewer(true)
        console.log('🎯 PDF 뷰어 렌더링 시작 (DOM 준비 완료)')
      }, 150) // 150ms 지연으로 DOM 준비 대기
      return () => clearTimeout(timer)
    } else {
      setRenderPdfViewer(false)
    }
  }, [selectedMedia])

  const fetchFiles = async (path: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/files?path=${encodeURIComponent(path)}`
      )
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
      setFiles([])
    }
    setLoading(false)
  }

  const fetchFolderTree = async () => {
    try {
      const response = await fetch('/api/files/tree')
      const data = await response.json()
      setFolderTree(data.tree || {})
    } catch (error) {
      console.error('Error fetching folder tree:', error)
    }
  }

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path)
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

  const navigateToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    setCurrentPath(parentPath)
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
  }

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pathSegments = currentPath.split('/').filter(Boolean)

  const renderFolderTree = (tree: FolderTree, basePath = '') => {
    return Object.entries(tree).map(([name, subtree]) => {
      const fullPath = basePath + '/' + name
      const isCurrentPath = fullPath === currentPath

      return (
        <div key={fullPath} className="ml-4">
          <button
            onClick={() => navigateToPath(fullPath)}
            className={`flex items-center gap-2 p-1 rounded hover:bg-gray-700 text-sm w-full text-left ${
              isCurrentPath ? 'bg-gray-700 text-blue-400' : ''
            }`}
          >
            <Folder className="w-4 h-4 text-yellow-500" />
            <span className="truncate">{name}</span>
          </button>
          {typeof subtree === 'object' &&
            subtree !== null &&
            Object.keys(subtree).length > 0 && (
              <div className="ml-2">{renderFolderTree(subtree, fullPath)}</div>
            )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left Sidebar - Folder Tree */}
      <div className="w-1/4 min-w-[250px] bg-gray-800 border-r border-gray-700 overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Folder className="w-5 h-5 text-yellow-500" />
            폴더 구조
          </h2>
        </div>
        <div className="p-2">
          <button
            onClick={() => navigateToPath('/')}
            className={`flex items-center gap-2 p-2 rounded hover:bg-gray-700 text-sm w-full text-left ${
              currentPath === '/' ? 'bg-gray-700 text-blue-400' : ''
            }`}
          >
            <Home className="w-4 h-4" />
            <span>루트</span>
          </button>
          {renderFolderTree(folderTree)}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToParent}
                disabled={currentPath === '/'}
                className="text-gray-300 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                상위 폴더
              </Button>
            </div>

            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="파일 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
                <Toggle
                  pressed={viewMode === 'list'}
                  onPressedChange={() => setViewMode('list')}
                  aria-label="리스트 뷰"
                  className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                  size="sm"
                >
                  <List className="w-4 h-4" />
                </Toggle>
                <Toggle
                  pressed={viewMode === 'gallery'}
                  onPressedChange={() => setViewMode('gallery')}
                  aria-label="갤러리 뷰"
                  className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                  size="sm"
                >
                  <Grid className="w-4 h-4" />
                </Toggle>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-300 overflow-x-auto">
            <Home className="w-4 h-4 flex-shrink-0" />
            <button
              onClick={() => navigateToPath('/')}
              className="hover:text-white whitespace-nowrap"
            >
              루트
            </button>
            {pathSegments.map((segment, index) => {
              const path = '/' + pathSegments.slice(0, index + 1).join('/')
              return (
                <div
                  key={path}
                  className="flex items-center gap-1 flex-shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                  <button
                    onClick={() => navigateToPath(path)}
                    className="hover:text-white whitespace-nowrap"
                  >
                    {segment}
                  </button>
                </div>
              )
            })}
          </div>
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
