"use client"

import { useState, useEffect } from 'react'
import { Search, Folder, File, Video, ChevronRight, Home, ArrowLeft, Grid, List, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import VideoPlayer from './video-player'
import { Toggle } from '@/components/ui/toggle'
import ListView from './list-view'
import GalleryView from './gallery-view'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  path: string
  isVideo?: boolean
}

interface ListViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

const ListViewOriginal: React.FC<ListViewProps> = ({ files, onFileClick }) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="text-left p-3 font-medium">이름</th>
            <th className="text-left p-3 font-medium w-24">크기</th>
            <th className="text-left p-3 font-medium w-40">수정일</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => (
            <tr
              key={file.path}
              className={`border-t border-gray-700 hover:bg-gray-700 cursor-pointer ${
                index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'
              }`}
              onClick={() => onFileClick(file)}
            >
              <td className="p-3">
                <div className="flex items-center gap-3">
                  {file.type === 'directory' ? (
                    <Folder className="w-5 h-5 text-yellow-500" />
                  ) : file.isVideo ? (
                    <Video className="w-5 h-5 text-red-500" />
                  ) : (
                    <File className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
              </td>
              <td className="p-3 text-gray-400 text-sm">
                {file.type === 'directory' ? '-' : formatFileSize(file.size)}
              </td>
              <td className="p-3 text-gray-400 text-sm">
                {formatDate(file.modified)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}

interface GalleryViewProps {
  files: FileItem[]
  onFileClick: (file: FileItem) => void
}

const GalleryViewOriginal: React.FC<GalleryViewProps> = ({ files, onFileClick }) => {
  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {files.map(file => (
        <div
          key={file.path}
          className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onFileClick(file)}
        >
          {file.isVideo ? (
            <div className="relative">
              <Video className="absolute top-2 left-2 w-6 h-6 text-red-500" />
              <img
                src={`/api/thumbnail?path=${encodeURIComponent(file.path)}`}
                alt={file.name}
                className="w-full h-32 object-cover rounded-md"
              />
            </div>
          ) : file.type === 'directory' ? (
            <Folder className="w-12 h-12 text-yellow-500 mx-auto" />
          ) : (
            <File className="w-12 h-12 text-gray-400 mx-auto" />
          )}
          <div className="text-center mt-2 truncate">{file.name}</div>
        </div>
      ))}
      {files.length === 0 && (
        <div className="text-center py-8 text-gray-400 col-span-4">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}

export default function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<any>({})
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')

  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']

  useEffect(() => {
    fetchFiles(currentPath)
    fetchFolderTree()
  }, [currentPath])

  const fetchFiles = async (path: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
      setFiles([])
    }
    setLoading(false)
  }

  const fetchFolderTree = async () => {
    try {
      const response = await fetch('/api/files/tree')
      const data = await response.json()
      setFolderTree(data.tree || {})
    } catch (error) {
      console.error('Error fetching folder tree:', error)
    }
  }

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path)
    } else if (file.isVideo) {
      setSelectedVideo(file.path)
    }
  }

  const navigateToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    setCurrentPath(parentPath)
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pathSegments = currentPath.split('/').filter(Boolean)

  const renderFolderTree = (tree: any, basePath = '') => {
    return Object.entries(tree).map(([name, subtree]) => {
      const fullPath = basePath + '/' + name
      const isCurrentPath = fullPath === currentPath
      
      return (
        <div key={fullPath} className="ml-4">
          <button
            onClick={() => navigateToPath(fullPath)}
            className={`flex items-center gap-2 p-1 rounded hover:bg-gray-700 text-sm w-full text-left ${
              isCurrentPath ? 'bg-gray-700 text-blue-400' : ''
            }`}
          >
            <Folder className="w-4 h-4 text-yellow-500" />
            <span className="truncate">{name}</span>
          </button>
          {typeof subtree === 'object' && Object.keys(subtree).length > 0 && (
            <div className="ml-2">
              {renderFolderTree(subtree, fullPath)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
    {/* Left Sidebar - Folder Tree */}
    <div className="w-1/4 min-w-[250px] bg-gray-800 border-r border-gray-700 overflow-y-auto hidden md:block">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5 text-yellow-500" />
          폴더 구조
        </h2>
      </div>
      <div className="p-2">
        <button
          onClick={() => navigateToPath('/')}
          className={`flex items-center gap-2 p-2 rounded hover:bg-gray-700 text-sm w-full text-left ${
            currentPath === '/' ? 'bg-gray-700 text-blue-400' : ''
          }`}
        >
          <Home className="w-4 h-4" />
          <span>루트</span>
        </button>
        {renderFolderTree(folderTree)}
      </div>
    </div>

    {/* Right Content Area */}
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToParent}
              disabled={currentPath === '/'}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              상위 폴더
            </Button>
          </div>
          
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="파일 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={() => setViewMode('list')}
                aria-label="리스트 뷰"
                className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                size="sm"
              >
                <List className="w-4 h-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === 'gallery'}
                onPressedChange={() => setViewMode('gallery')}
                aria-label="갤러리 뷰"
                className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                size="sm"
              >
                <Grid className="w-4 h-4" />
              </Toggle>
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-gray-300 overflow-x-auto">
          <Home className="w-4 h-4 flex-shrink-0" />
          <button
            onClick={() => navigateToPath('/')}
            className="hover:text-white whitespace-nowrap"
          >
            루트
          </button>
          {pathSegments.map((segment, index) => {
            const path = '/' + pathSegments.slice(0, index + 1).join('/')
            return (
              <div key={path} className="flex items-center gap-1 flex-shrink-0">
                <ChevronRight className="w-4 h-4" />
                <button
                  onClick={() => navigateToPath(path)}
                  className="hover:text-white whitespace-nowrap"
                >
                  {segment}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        ) : (
          <div className={viewMode === 'list' ? 'p-4' : ''}>
            {viewMode === 'list' ? (
              <ListView files={filteredFiles} onFileClick={handleFileClick} />
            ) : (
              <GalleryView files={filteredFiles} onFileClick={handleFileClick} />
            )}
          </div>
        )}
      </div>
    </div>

    {/* Video Player Modal */}
    <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
      <DialogContent className="max-w-4xl w-full bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {selectedVideo?.split('/').pop()}
          </DialogTitle>
        </DialogHeader>
        {selectedVideo && (
          <VideoPlayer
            src={`/api/video${selectedVideo}`}
            onClose={() => setSelectedVideo(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  </div>
  )
}
