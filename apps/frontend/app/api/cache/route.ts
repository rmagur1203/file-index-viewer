import { NextRequest, NextResponse } from 'next/server'
import { getFileCache } from '@/lib/file-cache'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const fileCache = await getFileCache()
    const stats = await fileCache.getCacheStats()

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const directory = searchParams.get('directory')
    const daysStr = searchParams.get('days')
    const days = daysStr ? parseInt(daysStr) : 30

    if (!directory) {
      return NextResponse.json(
        { error: 'Directory parameter is required' },
        { status: 400 }
      )
    }

    const fileCache = await getFileCache()
    await fileCache.cleanupOldCache(directory, days)

    const newStats = await fileCache.getCacheStats()

    return NextResponse.json({
      success: true,
      message: `Cleaned up cache entries older than ${days} days for directory: ${directory}`,
      stats: newStats,
    })
  } catch (error) {
    console.error('Error cleaning up cache:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup cache' },
      { status: 500 }
    )
  }
}
