'use client'

import { Home, ChevronRight } from 'lucide-react'

interface BreadcrumbProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export function Breadcrumb({ currentPath, onNavigate }: BreadcrumbProps) {
  const pathSegments = currentPath.split('/').filter(Boolean)

  return (
    <div className="flex items-center gap-1 text-sm text-gray-300 overflow-x-auto">
      <Home className="w-4 h-4 flex-shrink-0" />
      <button
        onClick={() => onNavigate('/')}
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
              onClick={() => onNavigate(path)}
              className="hover:text-white whitespace-nowrap"
            >
              {segment}
            </button>
          </div>
        )
      })}
    </div>
  )
}
