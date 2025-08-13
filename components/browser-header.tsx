'use client'

import {
  Search,
  List,
  Grid,
  ArrowLeft,
  Settings,
  Copy,
  Brain,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ThemeToggle } from './theme-toggle'
import Link from 'next/link'

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
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          상위 폴더
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="파일 검색..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10 bg-secondary border-border text-foreground placeholder-muted-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => onViewModeChange('list')}
            aria-label="리스트 뷰"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            size="sm"
          >
            <List className="w-4 h-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'gallery'}
            onPressedChange={() => onViewModeChange('gallery')}
            aria-label="갤러리 뷰"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            size="sm"
          >
            <Grid className="w-4 h-4" />
          </Toggle>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/ai-recommendations" passHref>
            <Button variant="ghost" size="icon" title="AI 파일 추천">
              <Brain className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </Link>
          <Link href="/duplicates" passHref>
            <Button variant="ghost" size="icon" title="중복 파일 관리">
              <Copy className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </Link>
          <Link href="/settings" passHref>
            <Button variant="ghost" size="icon" title="설정">
              <Settings className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
