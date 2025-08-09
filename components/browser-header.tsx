'use client'

import { Search, List, Grid, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'

type ViewMode = 'list' | 'gallery'

interface BrowserHeaderProps {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onNavigateParent: () => void
  isRoot: boolean
}

export function BrowserHeader({
  searchTerm,
  onSearchTermChange,
  viewMode,
  onViewModeChange,
  onNavigateParent,
  isRoot,
}: BrowserHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateParent}
          disabled={isRoot}
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
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => onViewModeChange('list')}
            aria-label="리스트 뷰"
            className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            size="sm"
          >
            <List className="w-4 h-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'gallery'}
            onPressedChange={() => onViewModeChange('gallery')}
            aria-label="갤러리 뷰"
            className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            size="sm"
          >
            <Grid className="w-4 h-4" />
          </Toggle>
        </div>
      </div>
    </div>
  )
}
