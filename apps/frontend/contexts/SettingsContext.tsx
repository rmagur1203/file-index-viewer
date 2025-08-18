'use client'

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react'

export interface SettingsState {
  // 비디오 설정
  autoplayVideo: boolean
  videoVolume: number
  showVideoControls: boolean

  // 갤러리 설정
  defaultViewMode: 'list' | 'gallery'
  thumbnailSize: 'small' | 'medium' | 'large'
  showFileExtensions: boolean

  // 일반 설정
  theme: 'light' | 'dark' | 'system'
  language: 'ko' | 'en'
  showHiddenFiles: boolean
}

const defaultSettings: SettingsState = {
  autoplayVideo: false,
  videoVolume: 0.8,
  showVideoControls: true,
  defaultViewMode: 'list',
  thumbnailSize: 'medium',
  showFileExtensions: true,
  theme: 'system',
  language: 'ko',
  showHiddenFiles: false,
}

interface SettingsContextType {
  settings: SettingsState
  updateSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
)

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)

  // localStorage에서 설정 로드
  useEffect(() => {
    const savedSettings = localStorage.getItem('file-browser-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
      }
    }
  }, [])

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('file-browser-settings', JSON.stringify(settings))
  }, [settings])

  const updateSetting = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    localStorage.removeItem('file-browser-settings')
  }

  return (
    <SettingsContext.Provider
      value={{ settings, updateSetting, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
