'use client'

import { useState, useEffect } from 'react'
import FileBrowser from '@/components/file-browser'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { useBrowser } from '@/contexts/BrowserContext'
import { FileItem } from '@/types'
import { toast } from 'sonner'
import { Frown } from 'lucide-react'

export default function LikesPage() {
  const [initialFiles, setInitialFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { viewMode, searchTerm } = useBrowser()
  const { files, loading, navigateTo } = useFileBrowser(undefined, initialFiles)

  useEffect(() => {
    const fetchLikedFiles = async () => {
      setIsLoading(true)
      try {
        const API_BASE_URL =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await fetch(`${API_BASE_URL}/api/likes`)
        if (response.ok) {
          const likedPaths: string[] = await response.json()
          const fileDetailsResponse = await fetch(`${API_BASE_URL}/api/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: likedPaths }),
          })
          if (fileDetailsResponse.ok) {
            const fileDetails = await fileDetailsResponse.json()
            setInitialFiles(fileDetails.files)
          } else {
            throw new Error('Failed to fetch file details')
          }
        } else {
          throw new Error('Failed to fetch liked files')
        }
      } catch (err) {
        toast.error('좋아요 목록을 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLikedFiles()
  }, [])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        로딩 중...
      </div>
    )
  }

  if (initialFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <Frown className="w-16 h-16 mb-4" />
        <p className="text-lg">좋아요한 파일이 없습니다.</p>
        <p className="text-sm">
          파일 탐색기에서 하트 아이콘을 눌러 파일을 추가해보세요.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold p-4">좋아요한 파일</h1>
      <div className="flex-1 overflow-y-auto">
        <FileBrowser
          files={files}
          loading={loading}
          navigateTo={navigateTo}
          searchTerm={searchTerm}
          viewMode={viewMode}
        />
      </div>
    </div>
  )
}
