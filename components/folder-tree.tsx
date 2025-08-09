'use client'

import { Folder, Home } from 'lucide-react'
import { FolderTree as FolderTreeData } from '@/hooks/useFileBrowser'

interface FolderTreeProps {
  tree: FolderTreeData
  currentPath: string
  onNavigate: (path: string) => void
}

const renderTree = (
  tree: FolderTreeData,
  currentPath: string,
  onNavigate: (path: string) => void,
  basePath = ''
) => {
  return Object.entries(tree).map(([name, subtree]) => {
    const fullPath = basePath + '/' + name
    const isCurrentPath = fullPath === currentPath

    return (
      <div key={fullPath} className="ml-4">
        <button
          onClick={() => onNavigate(fullPath)}
          className={`flex items-center gap-2 p-1 rounded hover:bg-gray-700 text-sm w-full text-left ${
            isCurrentPath ? 'bg-gray-700 text-blue-400' : ''
          }`}
        >
          <Folder className="w-4 h-4 text-yellow-500" />
          <span className="truncate">{name}</span>
        </button>
        {typeof subtree === 'object' &&
          subtree !== null &&
          Object.keys(subtree).length > 0 && (
            <div className="ml-2">
              {renderTree(subtree, currentPath, onNavigate, fullPath)}
            </div>
          )}
      </div>
    )
  })
}

export function FolderTree({ tree, currentPath, onNavigate }: FolderTreeProps) {
  return (
    <div className="w-1/4 min-w-[250px] bg-gray-800 border-r border-gray-700 overflow-y-auto hidden md:block">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5 text-yellow-500" />
          폴더 구조
        </h2>
      </div>
      <div className="p-2">
        <button
          onClick={() => onNavigate('/')}
          className={`flex items-center gap-2 p-2 rounded hover:bg-gray-700 text-sm w-full text-left ${
            currentPath === '/' ? 'bg-gray-700 text-blue-400' : ''
          }`}
        >
          <Home className="w-4 h-4" />
          <span>루트</span>
        </button>
        {renderTree(tree, currentPath, onNavigate)}
      </div>
    </div>
  )
}
