import { NextRequest, NextResponse } from 'next/server'
import { getLikeCache } from '@/lib/like-cache'

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: Promise<{ path: string[] }> }
) {
  const params = await _params
  try {
    const filePath = '/' + params.path.join('/')
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const likeCache = await getLikeCache()
    await likeCache.removeLike(filePath)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing like:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
