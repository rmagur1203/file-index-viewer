'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useSettings } from '@/contexts/SettingsContext'
import { BACKEND_API_URL } from '@/lib/config'
import { Badge } from './ui/badge'

interface VideoPlayerProps {
  src: string
  filePath?: string // 원본 파일 경로 (AI 분석용)
  onClose: () => void
  onPrevVideo?: () => void
  onNextVideo?: () => void
  onFindSimilar?: () => void
}

interface ClassificationResult {
  className: string
  probability: number
}

export default function VideoPlayer({
  src,
  filePath,
  onClose,
  onPrevVideo,
  onNextVideo,
  onFindSimilar,
}: VideoPlayerProps) {
  const { settings } = useSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(settings.videoVolume)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(settings.showVideoControls)
  const [classification, setClassification] = useState<ClassificationResult[]>(
    []
  )
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  useEffect(() => {
    const classifyVideo = async () => {
      if (!filePath) return
      setIsLoadingTags(true)
      try {
        const response = await fetch(
          `${BACKEND_API_URL}/api/ai-recommendations/classify-video`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoPath: filePath }),
          }
        )
        if (response.ok) {
          const data = await response.json()
          setClassification(data)
        } else {
          console.error('Failed to classify video')
        }
      } catch (error) {
        console.error('Error classifying video:', error)
      } finally {
        setIsLoadingTags(false)
      }
    }

    classifyVideo()
  }, [filePath])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      // 설정에 따라 자동 재생
      if (settings.autoplayVideo) {
        video.play().catch(console.error)
      }
    }

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', () => setIsPlaying(true))
    video.addEventListener('pause', () => setIsPlaying(false))

    // 초기 볼륨 설정
    video.volume = settings.videoVolume

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', () => setIsPlaying(true))
      video.removeEventListener('pause', () => setIsPlaying(false))
    }
  }, [settings.autoplayVideo, settings.videoVolume])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }, [isPlaying])

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const video = videoRef.current
      if (!video) return

      const newVolume = value[0]
      video.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    },
    [setVolume, setIsMuted]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }, [])

  const skip = useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video) return

      video.currentTime = Math.max(
        0,
        Math.min(duration, video.currentTime + seconds)
      )
    },
    [duration]
  )

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl 또는 Meta(Mac의 Command) 키가 눌렸는지 확인
      const isModifierKeyPressed = e.ctrlKey || e.metaKey

      if (isModifierKeyPressed) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onPrevVideo?.()
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          onNextVideo?.()
          return
        }
      }

      // 일반 키보드 컨트롤 (모디파이어 키 없이)
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose?.()
          break
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          skip(5)
          break
        case 'ArrowUp':
          e.preventDefault()
          const newVolumeUp = Math.min(1, volume + 0.1)
          handleVolumeChange([newVolumeUp])
          break
        case 'ArrowDown':
          e.preventDefault()
          const newVolumeDown = Math.max(0, volume - 0.1)
          handleVolumeChange([newVolumeDown])
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlay,
    skip,
    volume,
    handleVolumeChange,
    toggleMute,
    toggleFullscreen,
    onPrevVideo,
    onNextVideo,
    onClose,
  ])

  return (
    <div
      className="relative bg-black rounded-lg overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      {settings.showVideoControls && (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress Bar */}
          <div className="absolute bottom-16 left-4 right-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="w-full [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:bg-red-500 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-red-500"
            />
          </div>

          {/* Control Buttons */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-10)}
                className="text-white hover:bg-white/20"
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(10)}
                className="text-white hover:bg-white/20"
              >
                <SkipForward className="w-5 h-5" />
              </Button>

              {onFindSimilar && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFindSimilar}
                  className="text-white hover:bg-white/20"
                  title="유사 비디오 찾기"
                >
                  <Brain className="w-5 h-5" />
                </Button>
              )}

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>

                <div className="w-20">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="[&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
                title="전체화면 (F)"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Keyboard Controls Info */}
          <div className="absolute top-4 right-4 bg-black/60 rounded-lg p-3 text-white text-xs max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold mb-2">키보드 컨트롤</div>
              <div>스페이스: 재생/일시정지</div>
              <div>← →: 5초 이동</div>
              <div>↑ ↓: 볼륨 조절</div>
              <div>M: 음소거</div>
              <div>F: 전체화면</div>
              <div className="border-t border-white/20 pt-2 mt-2">
                <div>Ctrl + ← →: 이전/다음 영상</div>
              </div>
            </div>
          </div>

          {/* Classification Info */}
          {filePath && (
            <div className="absolute top-4 left-4 bg-black/60 rounded-lg p-3 text-white text-xs max-w-xs">
              <div className="space-y-1">
                <div className="font-semibold mb-2">인식된 정보</div>
                {isLoadingTags ? (
                  <div>분석 중...</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {classification.map(({ className, probability }) => (
                      <Badge
                        key={className}
                        variant="secondary"
                        title={`정확도: ${Math.round(probability * 100)}%`}
                      >
                        {className.split(',')[0]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
