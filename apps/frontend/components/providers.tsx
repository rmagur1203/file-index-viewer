'use client'

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from './theme-provider'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { BrowserProvider } from '@/contexts/BrowserContext'
import { Suspense } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SettingsProvider>
          <BrowserProvider>
            <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
          </BrowserProvider>
        </SettingsProvider>
      </ThemeProvider>
    </NuqsAdapter>
  )
}
