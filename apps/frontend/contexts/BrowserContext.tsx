'use client'

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react'
import { useSettings } from './SettingsContext'

type ViewMode = 'list' | 'gallery'

interface BrowserContextType {
  searchTerm: string
  setSearchTerm: (term: string) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const BrowserContext = createContext<BrowserContextType | undefined>(undefined)

export const BrowserProvider = ({ children }: { children: ReactNode }) => {
  const { settings } = useSettings()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(settings.defaultViewMode)

  // 설정이 변경되면 뷰 모드 업데이트
  useEffect(() => {
    setViewMode(settings.defaultViewMode)
  }, [settings.defaultViewMode])

  return (
    <BrowserContext.Provider
      value={{ searchTerm, setSearchTerm, viewMode, setViewMode }}
    >
      {children}
    </BrowserContext.Provider>
  )
}

export const useBrowser = () => {
  const context = useContext(BrowserContext)
  if (context === undefined) {
    throw new Error('useBrowser must be used within a BrowserProvider')
  }
  return context
}
