'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  style?: React.CSSProperties
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  unoptimized?: boolean
  fallbackIcon?: React.ReactNode
  loadingComponent?: React.ReactNode
}

export default function LazyImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  style,
  onError,
  unoptimized,
  fallbackIcon,
  loadingComponent,
}: LazyImageProps) {
  const [isInView, setIsInView] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px', // 화면에서 50px 전에 미리 로딩 시작
        threshold: 0.1,
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false)
    setHasError(true)
    onError?.(e)
  }

  const defaultLoadingComponent = (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  const defaultFallbackIcon = (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <svg
        className="w-8 h-8 text-muted-foreground"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )

  return (
    <div
      ref={imgRef}
      className={cn('relative h-full w-full', className)}
      style={style}
    >
      {!isInView ? (
        // 이미지가 화면에 보이지 않을 때 로딩 플레이스홀더
        loadingComponent || defaultLoadingComponent
      ) : hasError ? (
        // 이미지 로딩 에러 시 폴백
        fallbackIcon || defaultFallbackIcon
      ) : (
        <>
          {isLoading && (loadingComponent || defaultLoadingComponent)}
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            fill={fill}
            className={`${className || ''} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            style={{
              ...style,
              position: fill ? 'absolute' : undefined,
            }}
            onLoad={handleLoad}
            onError={handleError}
            unoptimized={unoptimized}
          />
        </>
      )}
    </div>
  )
}
