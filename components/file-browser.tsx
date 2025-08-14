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
import { SimilarImagesPanel } from './similar-images-panel'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'
import { SimilarVideosPanel } from './similar-videos-panel'
import { SimilarTextsPanel } from './similar-texts-panel'

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
  const [showSimilarImages, setShowSimilarImages] = useState(false)
  const [similarImageQuery, setSimilarImageQuery] = useState<string | null>(
    null
  )
  const [showSimilarVideos, setShowSimilarVideos] = useState(false)
  const [similarVideoQuery, setSimilarVideoQuery] = useState<string | null>(
    null
  )
  const [showSimilarTexts, setShowSimilarTexts] = useState(false)
  const [similarTextQuery, setSimilarTextQuery] = useState<string | null>(null)

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

  const handleSimilarImageSelect = (imagePath: string) => {
    // 유사한 이미지가 선택되었을 때 해당 이미지를 표시
    const fileName = imagePath.split('/').pop() || imagePath
    setShowSimilarImages(false)
    setSimilarImageQuery(null)
    setSelectedMedia({
      path: imagePath,
      name: fileName,
      type: 'image',
      filePath: imagePath,
    })
  }

  const handleFindSimilar = (
    filePath: string,
    mediaType: 'image' | 'video' | 'pdf' | 'text'
  ) => {
    if (mediaType === 'image') {
      setSimilarImageQuery(filePath)
      setShowSimilarImages(true)
    } else if (mediaType === 'video') {
      setSimilarVideoQuery(filePath)
      setShowSimilarVideos(true)
    } else {
      // pdf -> text 로 취급
      setSimilarTextQuery(filePath)
      setShowSimilarTexts(true)
    }
  }

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
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
              onImageSelect={handleSimilarImageSelect}
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

      {showSimilarImages && similarImageQuery && (
        <SimilarImagesPanel
          filePath={similarImageQuery}
          open={showSimilarImages}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowSimilarImages(false)
              setSimilarImageQuery(null)
            }
          }}
          onImageSelect={handleSimilarImageSelect}
        />
      )}
      {showSimilarVideos && similarVideoQuery && (
        <SimilarVideosPanel
          filePath={similarVideoQuery}
          open={showSimilarVideos}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowSimilarVideos(false)
              setSimilarVideoQuery(null)
            }
          }}
          onVideoSelect={(videoPath) => {
            setShowSimilarVideos(false)
            setSimilarVideoQuery(null)
            setSelectedMedia({
              path: videoPath,
              name: videoPath.split('/').pop() || videoPath,
              type: 'video',
              filePath: videoPath,
            })
          }}
        />
      )}
      {showSimilarTexts && similarTextQuery && (
        <SimilarTextsPanel
          filePath={similarTextQuery}
          open={showSimilarTexts}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowSimilarTexts(false)
              setSimilarTextQuery(null)
            }
          }}
          onTextSelect={(textPath) => {
            setShowSimilarTexts(false)
            setSimilarTextQuery(null)
            const directory = textPath.substring(0, textPath.lastIndexOf('/'))
            const fileName = textPath.substring(textPath.lastIndexOf('/') + 1)
            setSelectedMedia({
              path: textPath,
              name: fileName,
              type: 'text',
              filePath: textPath,
            })
          }}
        />
      )}
    </>
  )
}
