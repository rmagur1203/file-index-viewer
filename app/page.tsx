'use client'

import FileBrowser from '@/components/file-browser'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { useBrowser } from '@/contexts/BrowserContext'

export default function Home() {
  const { files, loading, navigateTo } = useFileBrowser()
  const { searchTerm, viewMode } = useBrowser()

  return (
    <FileBrowser
      files={files}
      loading={loading}
      navigateTo={navigateTo}
      searchTerm={searchTerm}
      viewMode={viewMode}
    />
  )
}
