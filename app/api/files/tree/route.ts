import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const VIDEO_ROOT = process.env.VIDEO_ROOT || '/path/to/your/videos'

async function buildFolderTree(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<any> {
  if (currentDepth >= maxDepth) return {}
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    const tree: any = {}
    
    for (const item of items) {
      if (item.isDirectory()) {
        const subPath = path.join(dirPath, item.name)
        tree[item.name] = await buildFolderTree(subPath, maxDepth, currentDepth + 1)
      }
    }
    
    return tree
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error)
    return {}
  }
}

export async function GET() {
  try {
    const tree = await buildFolderTree(VIDEO_ROOT)
    return NextResponse.json({ tree })
  } catch (error) {
    console.error('Error building folder tree:', error)
    return NextResponse.json({ error: 'Failed to build folder tree' }, { status: 500 })
  }
}
