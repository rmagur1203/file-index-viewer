'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import VideoPlayer from './video-player'
import ImageViewer from './image-viewer'
import dynamic from 'next/dynamic'
import ListView from './list-view'
import GalleryView from './gallery-view'
import { FileItem } from '@/hooks/useFileBrowser'
import { SimilarFilesPanel } from './similar-files-panel'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'

// 웹 검색 결과에 따른 SSR 안전 PDF 뷰어 로드
const PdfJsViewer = dynamic(() => import('./pdfjs-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
        <div>PDF 뷰어 컴포넌트 로딩 중...</div>
      </div>
    </div>
  ),
})

const TextViewer = dynamic(() => import('./text-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
        <div>텍스트 뷰어 컴포넌트 로딩 중...</div>
      </div>
    </div>
  ),
})

interface SelectedMedia {
  path: string
  name: string
  type: 'video' | 'image' | 'pdf' | 'text'
  filePath?: string // 원본 파일 경로 (AI 분석용)
}

interface FileBrowserProps {
  files: FileItem[]
  loading: boolean
  navigateTo: (path: string) => void
  searchTerm: string
  viewMode: 'list' | 'gallery'
}

export default function FileBrowser({
  files,
  loading,
  navigateTo,
  searchTerm,
  viewMode,
}: FileBrowserProps) {
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null)
  const [renderPdfViewer, setRenderPdfViewer] = useState(false)
  const [showSimilarFiles, setShowSimilarFiles] = useState(false)
  const [similarFileQuery, setSimilarFileQuery] = useState<string | null>(null)

  const handlePrevVideo = () => {
    const videoFiles = files.filter((file) => file.mediaType === 'video')
    const currentIndex = videoFiles.findIndex(
      (file) => file.path === selectedMedia?.path
    )
    if (currentIndex > 0) {
      const prevVideo = videoFiles[currentIndex - 1]
      handleFileClick(prevVideo)
    }
  }

  const handleNextVideo = () => {
    const videoFiles = files.filter((file) => file.mediaType === 'video')
    const currentIndex = videoFiles.findIndex(
      (file) => file.path === selectedMedia?.path
    )
    if (currentIndex < videoFiles.length - 1) {
      const nextVideo = videoFiles[currentIndex + 1]
      handleFileClick(nextVideo)
    }
  }

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
        file.mediaType === 'pdf' ||
        file.mediaType === 'text')
    ) {
      setSelectedMedia({
        path: file.path,
        name: file.name,
        type: file.mediaType,
        filePath: file.path, // 원본 파일 경로 저장
      })
    }
  }

  const handleSimilarFileSelect = (filePath: string) => {
    // 유사한 파일이 선택되었을 때 해당 파일을 표시
    const fileName = filePath.split('/').pop() || filePath
    setShowSimilarFiles(false)
    setSimilarFileQuery(null)

    // 파일 타입 감지
    let fileType: 'image' | 'video' | 'text' | 'pdf' = 'text'
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)$/i)) {
      fileType = 'image'
    } else if (filePath.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/i)) {
      fileType = 'video'
    } else if (filePath.match(/\.pdf$/i)) {
      fileType = 'pdf'
    }

    setSelectedMedia({
      path: filePath,
      name: fileName,
      type: fileType,
      filePath: filePath,
    })
  }

  const handleFindSimilar = (
    filePath: string,
    mediaType: 'image' | 'video' | 'pdf' | 'text'
  ) => {
    setSimilarFileQuery(filePath)
    setShowSimilarFiles(true)
  }

  const filteredFiles = files.filter(
    (file) =>
      file &&
      file.name &&
      file.name
        .toLowerCase()
        .includes(searchTerm ? searchTerm.toLowerCase() : '')
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  return (
    <>
      <div className={viewMode === 'list' ? 'p-4' : ''}>
        {viewMode === 'list' ? (
          <ListView files={filteredFiles} onFileClick={handleFileClick} />
        ) : (
          <GalleryView
            files={filteredFiles}
            onFileClick={handleFileClick}
            onFindSimilar={handleFindSimilar}
          />
        )}
      </div>

      {/* Media Viewer Modals */}
      <Dialog
        open={!!selectedMedia}
        onOpenChange={() => setSelectedMedia(null)}
      >
        <DialogContent
          className={
            selectedMedia?.type === 'video'
              ? 'max-w-4xl w-full bg-background border-border'
              : selectedMedia?.type === 'text'
                ? 'max-w-4xl w-full h-[80vh] bg-background border-border flex flex-col'
                : 'max-w-[95vw] max-h-[95vh] w-full h-full bg-background border-border p-0 [&>button]:hidden'
          }
        >
          {selectedMedia?.type === 'video' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground truncate pr-10">
                  {selectedMedia?.name}
                </DialogTitle>
              </DialogHeader>
              <VideoPlayer
                src={`/api/media${selectedMedia.path}`}
                filePath={selectedMedia.filePath}
                onClose={() => setSelectedMedia(null)}
                onPrevVideo={handlePrevVideo}
                onNextVideo={handleNextVideo}
                onFindSimilar={() =>
                  handleFindSimilar(selectedMedia.path, 'video')
                }
              />
            </>
          )}
          {selectedMedia?.type === 'image' && (
            <ImageViewer
              src={`/api/media${selectedMedia.path}`}
              alt={selectedMedia.name}
              filePath={selectedMedia.filePath}
              onClose={() => setSelectedMedia(null)}
              onImageSelect={handleSimilarFileSelect}
              onFindSimilar={(filePath) => handleFindSimilar(filePath, 'image')}
            />
          )}
          {selectedMedia?.type === 'pdf' && renderPdfViewer && (
            <PdfJsViewer
              src={`/api/media${selectedMedia.path}`}
              fileName={selectedMedia.name}
              onClose={() => setSelectedMedia(null)}
              onFindSimilar={() => handleFindSimilar(selectedMedia.path, 'pdf')}
            />
          )}
          {selectedMedia?.type === 'text' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground truncate pr-10">
                  {selectedMedia?.name}
                </DialogTitle>
                <div className="absolute top-2 right-20">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleFindSimilar(selectedMedia.path, 'text')
                    }
                    className="text-muted-foreground hover:text-foreground"
                    title="유사 텍스트 찾기"
                  >
                    <Brain className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <TextViewer src={`/api/media${selectedMedia.path}`} />
              </div>
            </>
          )}
          {selectedMedia?.type === 'pdf' && !renderPdfViewer && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <div className="text-lg">모달 준비 중...</div>
                <div className="text-sm text-muted-foreground/70">
                  DOM 초기화 대기
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showSimilarFiles && similarFileQuery && (
        <SimilarFilesPanel
          filePath={similarFileQuery}
          open={showSimilarFiles}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowSimilarFiles(false)
              setSimilarFileQuery(null)
            }
          }}
          onFileSelect={handleSimilarFileSelect}
        />
      )}
    </>
  )
}
