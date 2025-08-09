"use client"

import { useState, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  X 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.js 워커 설정 (브라우저에서만)
if (typeof window !== 'undefined') {
  // 다양한 워커 경로 시도
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
}

interface PdfViewerProps {
  src: string
  fileName: string
  onClose: () => void
}

export default function PdfViewer({ src, fileName, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 컴포넌트 마운트 시 PDF.js 설정 확인
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('PDF.js 버전:', pdfjs.version)
      console.log('워커 경로:', pdfjs.GlobalWorkerOptions.workerSrc)
      console.log('PDF 파일 경로:', src)
    }
  }, [src])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF 로드 성공:', numPages, '페이지')
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF 로드 오류:', error)
    setError(`PDF 파일을 로드할 수 없습니다: ${error.message}`)
    setLoading(false)
  }

  const onPageLoadSuccess = () => {
    console.log('페이지 로드 완료:', pageNumber)
  }

  const onPageLoadError = (error: Error) => {
    console.error('페이지 로드 오류:', error)
  }

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 3.0))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.3))
  }, [])

  const handleRotateClockwise = useCallback(() => {
    setRotation(prev => (prev + 90) % 360)
  }, [])

  const handleRotateCounterclockwise = useCallback(() => {
    setRotation(prev => (prev - 90 + 360) % 360)
  }, [])

  const handlePrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPageNumber(prev => numPages ? Math.min(prev + 1, numPages) : prev)
  }, [numPages])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = src
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [src, fileName])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  const handleScaleChange = useCallback((value: number[]) => {
    setScale(value[0])
  }, [])

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false)
          } else {
            onClose()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevPage()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNextPage()
          break
        case '=':
        case '+':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
          e.preventDefault()
          handleZoomOut()
          break
        case 'r':
          e.preventDefault()
          if (e.shiftKey) {
            handleRotateCounterclockwise()
          } else {
            handleRotateClockwise()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, onClose, handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut, handleRotateClockwise, handleRotateCounterclockwise])

  return (
    <div className={`relative bg-gray-900 text-white ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* 상단 툴바 */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium truncate max-w-xs">{fileName}</h3>
          {numPages && (
            <div className="text-sm text-gray-400">
              페이지 {pageNumber} / {numPages}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 페이지 네비게이션 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          {/* 줌 컨트롤 */}
          <div className="flex items-center space-x-2 ml-4">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="w-24">
              <Slider
                value={[scale]}
                onValueChange={handleScaleChange}
                min={0.3}
                max={3.0}
                step={0.1}
                className="w-full"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-400 min-w-[4rem]">
              {Math.round(scale * 100)}%
            </span>
          </div>
          
          {/* 회전 */}
          <Button variant="ghost" size="sm" onClick={handleRotateCounterclockwise}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRotateClockwise}>
            <RotateCw className="w-4 h-4" />
          </Button>
          
          {/* 다운로드 */}
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
          
          {/* 전체화면 */}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          {/* 닫기 */}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF 콘텐츠 */}
      <div className="flex-1 overflow-auto bg-gray-800 flex items-center justify-center p-4">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <div className="text-gray-400">PDF 로딩 중...</div>
            <div className="text-xs text-gray-500 mt-2">파일: {fileName}</div>
          </div>
        )}
        
        {error && (
          <div className="text-center py-8">
            <div className="text-red-400 mb-4">{error}</div>
            <div className="text-xs text-gray-500">
              브라우저 개발자 도구에서 자세한 오류를 확인하세요.
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <div className="bg-white shadow-lg">
            <Document
              file={src}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              error=""
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                loading={<div className="text-gray-600 p-4">페이지 로딩 중...</div>}
                error={<div className="text-red-600 p-4">페이지 로드 실패</div>}
                onLoadSuccess={onPageLoadSuccess}
                onLoadError={onPageLoadError}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        )}
      </div>
      
      {/* 하단 상태바 */}
      {numPages && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-400 flex justify-between items-center">
          <div>
            키보드 단축키: ← → (페이지), +/- (줌), R (회전), Esc (닫기)
          </div>
          <div>
            크기: {Math.round(scale * 100)}% | 회전: {rotation}°
          </div>
        </div>
      )}
    </div>
  )
}
