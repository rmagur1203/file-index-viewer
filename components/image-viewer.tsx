'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize,
  X,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { SimilarImagesPanel } from './similar-images-panel'

interface ImageViewerProps {
  src: string
  alt: string
  filePath?: string // 원본 파일 경로 (AI 분석용)
  onClose?: () => void
  onImageSelect?: (imagePath: string) => void // 유사 이미지 선택 시 콜백
}

export default function ImageViewer({
  src,
  alt,
  filePath,
  onClose,
  onImageSelect,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showSimilarImages, setShowSimilarImages] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev * 1.25, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev / 1.25, 0.1))
  }, [])

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const handleReset = useCallback(() => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = src
    link.download = alt
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [src, alt])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -1 : 1
      const newScale = Math.max(0.1, Math.min(5, scale + delta * 0.1))
      setScale(newScale)
    },
    [scale]
  )

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  const handleFindSimilar = useCallback(() => {
    if (filePath) {
      setShowSimilarImages(true)
    }
  }, [filePath])

  const handleSimilarImageSelect = useCallback(
    (imagePath: string) => {
      setShowSimilarImages(false)
      onImageSelect?.(imagePath)
    },
    [onImageSelect]
  )

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Fullscreen state tracking removed to fix ESLint warnings
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            onClose?.()
          }
          break
        case '+':
        case '=':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
          e.preventDefault()
          handleZoomOut()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          handleRotate()
          break
        case '0':
          e.preventDefault()
          handleReset()
          break
        case 's':
        case 'S':
          if (filePath) {
            e.preventDefault()
            handleFindSimilar()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleZoomIn, handleZoomOut, handleRotate, handleReset, onClose])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Image Container */}
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="relative cursor-move"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          onMouseDown={handleMouseDown}
        >
          <Image
            ref={imageRef}
            src={src}
            alt={alt}
            width={800}
            height={600}
            className="max-w-full max-h-full object-contain"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            unoptimized
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
        <div className="flex gap-2 bg-black/50 rounded-lg p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="text-white hover:bg-white/20"
            title="축소 (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="text-white hover:bg-white/20"
            title="확대 (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRotate}
            className="text-white hover:bg-white/20"
            title="회전 (R)"
          >
            <RotateCw className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="text-white hover:bg-white/20"
            title="원본 크기 (0)"
          >
            <span className="text-xs font-bold">1:1</span>
          </Button>
        </div>

        <div className="flex gap-2 bg-black/50 rounded-lg p-2">
          {filePath && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFindSimilar}
              className="text-white hover:bg-white/20"
              title="유사한 이미지 찾기"
            >
              <Brain className="w-5 h-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
            title="다운로드"
          >
            <Download className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/20"
            title="전체화면"
          >
            <Maximize className="w-5 h-5" />
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              title="닫기 (ESC)"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-black/50 rounded-lg p-3 text-white text-sm">
        <div className="space-y-1">
          <div>배율: {Math.round(scale * 100)}%</div>
          <div>회전: {rotation}°</div>
          <div className="text-xs text-gray-300 mt-2">
            마우스 휠: 확대/축소 | 드래그: 이동
            <br />
            키보드: +/- (확대/축소), R (회전), 0 (리셋)
            {filePath && (
              <>
                <br />S (유사한 이미지 찾기)
              </>
            )}
            <br />
            ESC (닫기)
          </div>
        </div>
      </div>

      {/* Similar Images Panel */}
      {showSimilarImages && filePath && (
        <SimilarImagesPanel
          filePath={filePath}
          onClose={() => setShowSimilarImages(false)}
          onImageClick={handleSimilarImageSelect}
        />
      )}
    </div>
  )
}
