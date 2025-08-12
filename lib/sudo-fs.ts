import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

interface FileStats {
  isDirectory: () => boolean
  isFile: () => boolean
  size: number
  mtime: Date
}

interface DirEntry {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}

/**
 * 일반 권한으로 파일/디렉토리에 접근을 시도하고, 실패하면 sudo를 사용
 */
export async function sudoStat(filePath: string): Promise<FileStats> {
  try {
    // 먼저 일반 권한으로 시도
    const stats = await fs.stat(filePath)
    return {
      isDirectory: () => stats.isDirectory(),
      isFile: () => stats.isFile(),
      size: stats.size,
      mtime: stats.mtime,
    }
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
      // 권한 문제인 경우 sudo 사용
      try {
        const { stdout } = await execAsync(
          `sudo stat -c "%F,%s,%Y" "${filePath}"`
        )
        const [type, size, mtime] = stdout.trim().split(',')

        return {
          isDirectory: () => type === 'directory',
          isFile: () => type === 'regular file',
          size: parseInt(size, 10) || 0,
          mtime: new Date(parseInt(mtime, 10) * 1000),
        }
      } catch (sudoError) {
        throw new Error(`Cannot access ${filePath}: ${sudoError}`)
      }
    }
    throw error
  }
}

/**
 * 일반 권한으로 디렉토리를 읽고, 실패하면 sudo를 사용
 */
export async function sudoReaddir(dirPath: string): Promise<DirEntry[]> {
  try {
    // 먼저 일반 권한으로 시도
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    return items
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
      // 권한 문제인 경우 sudo 사용
      try {
        const { stdout } = await execAsync(
          `sudo find "${dirPath}" -maxdepth 1 -mindepth 1 -printf "%f,%y\\n"`
        )

        if (!stdout.trim()) {
          return []
        }

        return stdout
          .trim()
          .split('\n')
          .map((line) => {
            const [name, type] = line.split(',')
            return {
              name,
              isDirectory: () => type === 'd',
              isFile: () => type === 'f',
            }
          })
      } catch (sudoError) {
        throw new Error(`Cannot read directory ${dirPath}: ${sudoError}`)
      }
    }
    throw error
  }
}

/**
 * 파일 존재 여부 확인 (sudo 포함)
 */
export async function sudoExists(filePath: string): Promise<boolean> {
  try {
    await sudoStat(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 일반 권한으로 파일을 읽고, 실패하면 sudo를 사용
 */
export async function sudoReadFile(filePath: string): Promise<Buffer> {
  try {
    // 먼저 일반 권한으로 시도
    return await fs.readFile(filePath)
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
      // 권한 문제인 경우 sudo 사용
      try {
        const { stdout } = await execAsync(`sudo cat "${filePath}" | base64`)
        return Buffer.from(stdout.trim(), 'base64')
      } catch (sudoError) {
        throw new Error(`Cannot read file ${filePath}: ${sudoError}`)
      }
    }
    throw error
  }
}

/**
 * 안전한 경로 결합 (보안: 상위 디렉토리 접근 방지)
 */
export function safePath(basePath: string, relativePath: string): string {
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '')
  const fullPath = path.join(basePath, safePath)

  // 경로가 basePath 내부에 있는지 확인
  if (!fullPath.startsWith(basePath)) {
    throw new Error('Access denied: path outside of allowed directory')
  }

  return fullPath
}
