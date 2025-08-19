'use client'

import * as React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

import { Button } from '@repo/ui'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [title, setTitle] = useState('테마 전환')

  useEffect(() => {
    const getTitle = () => {
      switch (theme) {
        case 'light':
          return '라이트 모드 (클릭하여 다크 모드로 변경)'
        case 'dark':
          return '다크 모드 (클릭하여 시스템 모드로 변경)'
        case 'system':
          return '시스템 모드 (클릭하여 라이트 모드로 변경)'
        default:
          return '테마 전환'
      }
    }
    setTitle(getTitle())
  }, [theme])

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-[1.2rem] w-[1.2rem]" />
      case 'dark':
        return <Moon className="h-[1.2rem] w-[1.2rem]" />
      case 'system':
        return <Monitor className="h-[1.2rem] w-[1.2rem]" />
      default:
        return <Monitor className="h-[1.2rem] w-[1.2rem]" />
    }
  }

  return (
    <Button variant="outline" size="icon" onClick={cycleTheme} title={title}>
      {getIcon()}
      <span className="sr-only">테마 전환</span>
    </Button>
  )
}
