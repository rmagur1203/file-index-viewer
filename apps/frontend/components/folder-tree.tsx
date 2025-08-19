'use client'

import { Folder, Home, Heart, Sparkles, Settings } from 'lucide-react'
import { FolderTree as FolderTreeData } from '@/hooks/useFileBrowser'
import { useRouter, usePathname } from 'next/navigation'

interface FolderTreeProps {
  tree: FolderTreeData
  currentPath: string
  onNavigate: (path: string) => void
}

const renderTree = (
  tree: FolderTreeData,
  currentPath: string,
  onNavigate: (path: string) => void,
  pathname: string,
  router: any,
  basePath = ''
) => {
  return Object.entries(tree).map(([name, subtree]) => {
    const fullPath = basePath + '/' + name
    const isCurrentPath = fullPath === currentPath

    const handleClick = () => {
      // 설정 페이지나 다른 페이지에서 폴더를 클릭하면 메인 페이지로 이동
      if (pathname !== '/') {
        router.push(`/?path=${encodeURIComponent(fullPath)}`)
      } else {
        onNavigate(fullPath)
      }
    }

    return (
      <div key={fullPath} className="ml-4">
        <button
          onClick={handleClick}
          className={`flex items-center gap-2 p-1 rounded hover:bg-muted text-sm w-full text-left ${
            isCurrentPath ? 'bg-muted text-primary' : ''
          }`}
        >
          <Folder className="w-4 h-4 text-yellow-500" />
          <span className="truncate">{name}</span>
        </button>
        {typeof subtree === 'object' &&
          subtree !== null &&
          Object.keys(subtree).length > 0 && (
            <div className="ml-2">
              {renderTree(
                subtree,
                currentPath,
                onNavigate,
                pathname,
                router,
                fullPath
              )}
            </div>
          )}
      </div>
    )
  })
}

export function FolderTree({ tree, currentPath, onNavigate }: FolderTreeProps) {
  const router = useRouter()
  const pathname = usePathname()
  const safePathname = pathname || '/'

  const handleRootClick = () => {
    // 설정 페이지나 다른 페이지에서 루트를 클릭하면 메인 페이지로 이동
    if (safePathname !== '/') {
      router.push('/?path=%2F')
    } else {
      onNavigate('/')
    }
  }

  return (
    <div className="w-1/4 min-w-[250px] bg-card border-r border-border overflow-y-auto hidden md:block">
      {/* 네비게이션 메뉴 */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">탐색</h2>
        <div className="space-y-1">
          <button
            onClick={() => router.push('/recommendations')}
            className={`flex items-center gap-2 p-2 rounded hover:bg-muted text-sm w-full text-left transition-colors ${
              safePathname === '/recommendations' ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI 추천</span>
          </button>
          <button
            onClick={() => router.push('/likes')}
            className={`flex items-center gap-2 p-2 rounded hover:bg-muted text-sm w-full text-left transition-colors ${
              safePathname === '/likes' ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>좋아요</span>
          </button>
          <button
            onClick={() => router.push('/ai-recommendations')}
            className={`flex items-center gap-2 p-2 rounded hover:bg-muted text-sm w-full text-left transition-colors ${
              safePathname === '/ai-recommendations' ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>AI 분석</span>
          </button>
        </div>
      </div>
      
      {/* 폴더 구조 */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5 text-yellow-500" />
          폴더 구조
        </h2>
      </div>
      <div className="p-2">
        <button
          onClick={handleRootClick}
          className={`flex items-center gap-2 p-2 rounded hover:bg-muted text-sm w-full text-left ${
            currentPath === '/' && safePathname === '/' ? 'bg-muted text-primary' : ''
          }`}
        >
          <Home className="w-4 h-4" />
          <span>루트</span>
        </button>
        {renderTree(tree, currentPath, onNavigate, safePathname, router)}
      </div>
    </div>
  )
}
