"use client"

import { useState, useCallback } from 'react'
import { 
  Download, 
  Maximize2,
  Minimize2,
  X,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IframePdfViewerProps {
  src: string
  fileName: string
  onClose: () => void
}

export default function IframePdfViewer({ src, fileName, onClose }: IframePdfViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  const openInNewTab = useCallback(() => {
    window.open(src, '_blank')
  }, [src])

  return (
    <div className={`relative bg-gray-900 text-white ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* 상단 툴바 */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium truncate max-w-xs">{fileName}</h3>
          <div className="text-sm text-gray-400">
            브라우저 내장 PDF 뷰어
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 새 탭에서 열기 */}
          <Button variant="ghost" size="sm" onClick={openInNewTab} title="새 탭에서 열기">
            <RotateCw className="w-4 h-4" />
          </Button>
          
          {/* 다운로드 */}
          <Button variant="ghost" size="sm" onClick={handleDownload} title="다운로드">
            <Download className="w-4 h-4" />
          </Button>
          
          {/* 전체화면 */}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} title="전체화면">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          {/* 닫기 */}
          <Button variant="ghost" size="sm" onClick={onClose} title="닫기">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 bg-gray-800" style={{ height: 'calc(100% - 73px)' }}>
        <iframe
          src={src}
          className="w-full h-full border-0"
          title={fileName}
          style={{ minHeight: '500px' }}
        />
      </div>
      
      {/* 하단 상태바 */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-400 flex justify-between items-center">
        <div>
          브라우저 내장 PDF 뷰어 - 모든 기본 기능 사용 가능 (줌, 검색, 인쇄 등)
        </div>
        <div className="text-xs">
          {fileName}
        </div>
      </div>
    </div>
  )
}
