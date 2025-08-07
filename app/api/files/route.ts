import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 비디오 서버의 루트 디렉토리 경로를 설정하세요
const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'

const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv']
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.ico']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path') || '/'
    
    // 보안: 상위 디렉토리 접근 방지
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '')
    const fullPath = path.join(VIDEO_ROOT, safePath)
    
    // 경로가 VIDEO_ROOT 내부에 있는지 확인
    if (!fullPath.startsWith(VIDEO_ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const stats = await fs.stat(fullPath)
    
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 })
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true })
    
    const files = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(fullPath, item.name)
        const relativePath = path.join(safePath, item.name).replace(/\\/g, '/')
        
        try {
          const itemStats = await fs.stat(itemPath)
          const isVideo = item.isFile() && videoExtensions.some(ext => 
            item.name.toLowerCase().endsWith(ext)
          )
          const isImage = item.isFile() && imageExtensions.some(ext => 
            item.name.toLowerCase().endsWith(ext)
          )
          
          return {
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: item.isFile() ? itemStats.size : undefined,
            modified: itemStats.mtime.toISOString(),
            path: relativePath.startsWith('/') ? relativePath : '/' + relativePath,
            isVideo,
            isImage
          }
        } catch (error) {
          console.error(`Error getting stats for ${itemPath}:`, error)
          return null
        }
      })
    )

    const validFiles = files.filter(Boolean).sort((a, b) => {
      // 폴더를 먼저, 그 다음 파일을 알파벳 순으로
      if (a!.type !== b!.type) {
        return a!.type === 'directory' ? -1 : 1
      }
      return a!.name.localeCompare(b!.name)
    })

    return NextResponse.json({ files: validFiles })
  } catch (error) {
    console.error('Error reading directory:', error)
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 })
  }
}
