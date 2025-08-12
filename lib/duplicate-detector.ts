import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { isImage, isVideo } from './utils'

export interface DuplicateGroup {
  id: string
  type: 'image' | 'video'
  files: DuplicateFile[]
  similarity: number
}

export interface DuplicateFile {
  path: string
  relativePath: string // VIDEO_ROOT를 기준으로 한 상대 경로
  name: string
  size: number
  hash: string
  perceptualHash?: string
  modifiedAt: string
}

/**
 * 파일의 MD5 해시를 계산합니다
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath)
    return createHash('md5').update(buffer).digest('hex')
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error)
    throw error
  }
}

/**
 * 이미지의 perceptual hash를 계산합니다
 */
export async function calculatePerceptualHash(
  filePath: string
): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath)

    // Sharp를 동적으로 import (서버 사이드에서만 사용)
    const { default: sharp } = await import('sharp')

    // 이미지를 8x8 그레이스케일로 변환
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 평균값 계산
    const avg =
      Array.from(data).reduce((sum, val) => sum + val, 0) / data.length

    // 각 픽셀이 평균보다 큰지 여부로 해시 생성
    let hash = ''
    for (let i = 0; i < data.length; i++) {
      hash += data[i] > avg ? '1' : '0'
    }

    return hash
  } catch (error) {
    console.error(`Error calculating perceptual hash for ${filePath}:`, error)
    throw error
  }
}

/**
 * 두 perceptual hash 간의 해밍 거리를 계산합니다
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity
  }

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }

  return distance
}

/**
 * 해밍 거리를 유사도 퍼센티지로 변환합니다
 */
export function hammingDistanceToSimilarity(
  distance: number,
  hashLength: number
): number {
  return Math.max(0, ((hashLength - distance) / hashLength) * 100)
}

/**
 * 디렉토리를 재귀적으로 스캔하여 모든 이미지와 비디오 파일을 찾습니다
 */
export async function scanMediaFiles(
  dirPath: string,
  progressCallback?: (step: string, current: number, total: number) => void
): Promise<DuplicateFile[]> {
  const files: DuplicateFile[] = []
  let processedFiles = 0
  let totalFilesEstimate = 0

  // 먼저 총 파일 수를 추정
  async function countFiles(currentPath: string): Promise<number> {
    let count = 0
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) {
          count += await countFiles(entryPath)
        } else if (
          entry.isFile() &&
          (isImage(entry.name) || isVideo(entry.name))
        ) {
          count++
        }
      }
    } catch (error) {
      console.warn(`Failed to count files in ${currentPath}:`, error)
    }
    return count
  }

  // 총 파일 수 계산
  if (progressCallback) {
    progressCallback('파일 개수 계산 중', 0, 0)
    totalFilesEstimate = await countFiles(dirPath)
    progressCallback('파일 스캔 시작', 0, totalFilesEstimate)
  }

  async function scanDir(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
          await scanDir(entryPath)
        } else if (
          entry.isFile() &&
          (isImage(entry.name) || isVideo(entry.name))
        ) {
          try {
            const stats = await fs.stat(entryPath)
            const fileHash = await calculateFileHash(entryPath)

            // 상대 경로 계산 (dirPath 기준)
            const relativePath = path
              .relative(dirPath, entryPath)
              .replace(/\\/g, '/')

            const file: DuplicateFile = {
              path: entryPath,
              relativePath: relativePath.startsWith('/')
                ? relativePath
                : '/' + relativePath,
              name: entry.name,
              size: stats.size,
              hash: fileHash,
              modifiedAt: stats.mtime.toISOString(),
            }

            // 이미지인 경우 perceptual hash도 계산
            if (isImage(entry.name)) {
              try {
                file.perceptualHash = await calculatePerceptualHash(entryPath)
              } catch (error) {
                console.warn(
                  `Failed to calculate perceptual hash for ${entryPath}:`,
                  error
                )
              }
            }

            files.push(file)
            processedFiles++

            // 프로그래스 업데이트
            if (progressCallback && totalFilesEstimate > 0) {
              progressCallback(
                `파일 처리 중: ${entry.name}`,
                processedFiles,
                totalFilesEstimate
              )
            }
          } catch (error) {
            console.warn(`Skipping file ${entryPath}:`, error)
            processedFiles++
            if (progressCallback && totalFilesEstimate > 0) {
              progressCallback(
                `파일 처리 중`,
                processedFiles,
                totalFilesEstimate
              )
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${currentPath}:`, error)
    }
  }

  await scanDir(dirPath)

  if (progressCallback) {
    progressCallback('파일 스캔 완료', totalFilesEstimate, totalFilesEstimate)
  }

  return files
}

/**
 * 중복 파일 그룹을 찾습니다
 */
export function findDuplicateGroups(files: DuplicateFile[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const processedFiles = new Set<string>()

  // 1. 정확한 중복 (같은 해시)
  const hashGroups = new Map<string, DuplicateFile[]>()
  for (const file of files) {
    if (!hashGroups.has(file.hash)) {
      hashGroups.set(file.hash, [])
    }
    hashGroups.get(file.hash)!.push(file)
  }

  // 정확한 중복 그룹 추가
  for (const [hash, groupFiles] of hashGroups) {
    if (groupFiles.length > 1) {
      const firstFile = groupFiles[0]
      const type = isImage(firstFile.name) ? 'image' : 'video'

      groups.push({
        id: `exact-${hash}`,
        type,
        files: groupFiles,
        similarity: 100,
      })

      groupFiles.forEach((file) => processedFiles.add(file.path))
    }
  }

  // 2. 이미지의 유사한 중복 (perceptual hash 기반)
  const imageFiles = files.filter(
    (f) => isImage(f.name) && f.perceptualHash && !processedFiles.has(f.path)
  )

  const imageProcessed = new Set<string>()

  for (let i = 0; i < imageFiles.length; i++) {
    if (imageProcessed.has(imageFiles[i].path)) continue

    const similarFiles = [imageFiles[i]]
    imageProcessed.add(imageFiles[i].path)

    for (let j = i + 1; j < imageFiles.length; j++) {
      if (imageProcessed.has(imageFiles[j].path)) continue

      const distance = calculateHammingDistance(
        imageFiles[i].perceptualHash!,
        imageFiles[j].perceptualHash!
      )

      const similarity = hammingDistanceToSimilarity(distance, 64) // 8x8 = 64 bits

      // 90% 이상 유사하면 중복으로 간주
      if (similarity >= 90) {
        similarFiles.push(imageFiles[j])
        imageProcessed.add(imageFiles[j].path)
      }
    }

    if (similarFiles.length > 1) {
      const maxSimilarity = Math.min(
        ...similarFiles.slice(1).map((file) => {
          const distance = calculateHammingDistance(
            similarFiles[0].perceptualHash!,
            file.perceptualHash!
          )
          return hammingDistanceToSimilarity(distance, 64)
        })
      )

      groups.push({
        id: `similar-${similarFiles[0].hash}`,
        type: 'image',
        files: similarFiles,
        similarity: Math.round(maxSimilarity),
      })
    }
  }

  // 3. 비디오의 유사한 중복 (크기 기반)
  const videoFiles = files.filter(
    (f) => isVideo(f.name) && !processedFiles.has(f.path)
  )

  const sizeGroups = new Map<number, DuplicateFile[]>()
  for (const file of videoFiles) {
    if (!sizeGroups.has(file.size)) {
      sizeGroups.set(file.size, [])
    }
    sizeGroups.get(file.size)!.push(file)
  }

  for (const [size, groupFiles] of sizeGroups) {
    if (groupFiles.length > 1) {
      groups.push({
        id: `size-${size}`,
        type: 'video',
        files: groupFiles,
        similarity: 95, // 크기가 같으면 95% 유사하다고 가정
      })
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity)
}
