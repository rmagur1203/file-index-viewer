'use client'

import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '../components/theme-provider'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { FolderTree } from '@/components/folder-tree'
import { useFileBrowser } from '@/hooks/useFileBrowser'
import { BrowserHeader } from '@/components/browser-header'
import { Breadcrumb } from '@/components/breadcrumb'
import { BrowserProvider, useBrowser } from '@/contexts/BrowserContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { Suspense } from 'react'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    currentPath,
    folderTree,
    navigateTo,
    navigateToParent,
    canNavigateBack,
  } = useFileBrowser()
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SettingsProvider>
              <BrowserProvider>
                <Suspense fallback={<div>Loading...</div>}>
                  <AppLayout>{children}</AppLayout>
                </Suspense>
              </BrowserProvider>
            </SettingsProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
