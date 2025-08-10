import FileBrowser from '@/components/file-browser'
import { Suspense } from 'react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div>Loading...</div>}>
        <FileBrowser />
      </Suspense>
    </div>
  )
}
