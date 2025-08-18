import { NextRequest, NextResponse } from 'next/server'
import { getLikeCache } from '@/lib/like-cache'

export async function GET() {
  try {
    const likeCache = await getLikeCache()
    const likes = await likeCache.getAllLikes()
    return NextResponse.json(likes)
  } catch (error) {
    console.error('Error getting likes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (typeof path !== 'string') {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const likeCache = await getLikeCache()
    await likeCache.addLike(path)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding like:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
