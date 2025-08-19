'use client'

import { FolderTree } from '@/components/folder-tree'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { BrowserHeader } from '@/components/browser-header'
import { Breadcrumb } from '@/components/breadcrumb'
import { useBrowser } from '@/contexts/BrowserContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentPath, folderTree, navigateTo, navigateToParent } =
    useFileBrowser()
  const { searchTerm, setSearchTerm, viewMode, setViewMode } = useBrowser()

  return (
    <div className="flex h-screen bg-background text-foreground">
      <FolderTree
        tree={folderTree}
        currentPath={currentPath}
        onNavigate={navigateTo}
      />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border p-4">
          <BrowserHeader
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onNavigateParent={navigateToParent}
            isRoot={currentPath === '/'}
          />
          <Breadcrumb currentPath={currentPath} onNavigate={navigateTo} />
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
