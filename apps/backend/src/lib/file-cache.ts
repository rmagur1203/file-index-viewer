import Database from 'better-sqlite3'
import path from 'path'
import { promises as fs } from 'fs'
import { DuplicateFile, VideoFingerprint } from '../types'

interface CachedFileInfo {
  path: string
  size: number
  modifiedAt: string
  hash: string
  perceptualHash?: string
  videoFingerprintJson?: string
  lastChecked: string
}

export class FileCache {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dbPath?: string) {
    // 기본적으로 temp 디렉토리에 데이터베이스 저장
    this.dbPath = dbPath || path.join(process.cwd(), 'temp', 'file-cache.db')
  }

  /**
   * 데이터베이스 연결 및 초기화
   */
  async initialize(): Promise<void> {
    // temp 디렉토리 생성
    const tempDir = path.dirname(this.dbPath)
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {
      // 이미 존재하는 경우 무시
    })

    // 데이터베이스 열기
    this.db = new Database(this.dbPath)

    // 테이블 생성
    await this.createTables()
  }

  /**
   * 데이터베이스 테이블 생성
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const createFilesCacheTable = `
      CREATE TABLE IF NOT EXISTS file_cache (
        path TEXT PRIMARY KEY,
        size INTEGER NOT NULL,
        modified_at TEXT NOT NULL,
        hash TEXT NOT NULL,
        perceptual_hash TEXT,
        video_fingerprint_json TEXT,
        last_checked TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_file_cache_hash ON file_cache(hash)',
      'CREATE INDEX IF NOT EXISTS idx_file_cache_perceptual_hash ON file_cache(perceptual_hash)',
      'CREATE INDEX IF NOT EXISTS idx_file_cache_modified_at ON file_cache(modified_at)',
      'CREATE INDEX IF NOT EXISTS idx_file_cache_last_checked ON file_cache(last_checked)',
    ]

    this.db.exec(createFilesCacheTable)
    createIndexes.forEach((index) => this.db!.exec(index))
  }

  /**
   * 파일 정보를 캐시에서 가져옴
   */
  async getCachedFileInfo(filePath: string): Promise<CachedFileInfo | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'SELECT * FROM file_cache WHERE path = ?'
    const row = this.db.prepare(query).get(filePath) as any

    if (row) {
      return {
        path: row.path,
        size: row.size,
        modifiedAt: row.modified_at,
        hash: row.hash,
        perceptualHash: row.perceptual_hash,
        videoFingerprintJson: row.video_fingerprint_json,
        lastChecked: row.last_checked,
      }
    }

    return null
  }

  /**
   * 파일 정보를 캐시에 저장
   */
  async cacheFileInfo(fileInfo: DuplicateFile): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const videoFingerprintJson = fileInfo.videoFingerprint
      ? JSON.stringify(fileInfo.videoFingerprint)
      : null

    const query = `
      INSERT OR REPLACE INTO file_cache 
      (path, size, modified_at, hash, perceptual_hash, video_fingerprint_json, last_checked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    const now = new Date().toISOString()

    this.db
      .prepare(query)
      .run(
        fileInfo.path,
        fileInfo.size,
        fileInfo.modifiedAt,
        fileInfo.hash,
        fileInfo.perceptualHash || null,
        videoFingerprintJson,
        now
      )
  }

  /**
   * 파일이 변경되었는지 확인
   */
  async isFileChanged(
    filePath: string,
    currentSize: number,
    currentModifiedAt: string
  ): Promise<boolean> {
    const cached = await this.getCachedFileInfo(filePath)
    if (!cached) {
      return true // 캐시에 없으면 변경된 것으로 간주
    }

    return (
      cached.size !== currentSize || cached.modifiedAt !== currentModifiedAt
    )
  }

  /**
   * 캐시에서 DuplicateFile 객체 생성
   */
  cachedInfoToDuplicateFile(
    cached: CachedFileInfo,
    relativePath: string,
    name: string
  ): DuplicateFile {
    const file: DuplicateFile = {
      path: cached.path,
      relativePath,
      name,
      size: cached.size,
      hash: cached.hash,
      modifiedAt: cached.modifiedAt,
    }

    if (cached.perceptualHash) {
      file.perceptualHash = cached.perceptualHash
    }

    if (cached.videoFingerprintJson) {
      try {
        file.videoFingerprint = JSON.parse(
          cached.videoFingerprintJson
        ) as VideoFingerprint
      } catch (error) {
        console.warn(
          `Failed to parse video fingerprint for ${cached.path}:`,
          error
        )
      }
    }

    return file
  }

  /**
   * 특정 디렉토리의 오래된 캐시 항목 정리
   */
  async cleanupOldCache(
    directoryPath: string,
    olderThanDays = 30
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    const cutoffDateStr = cutoffDate.toISOString()

    // 특정 디렉토리 하위의 오래된 캐시 삭제
    const query = `
      DELETE FROM file_cache 
      WHERE path LIKE ? AND last_checked < ?
    `

    const result = this.db
      .prepare(query)
      .run(`${directoryPath}%`, cutoffDateStr)
    console.log(`Cleaned up ${result.changes} old cache entries`)
  }

  /**
   * 해시값으로 캐시된 파일들 검색
   */
  async getFilesByHash(hash: string): Promise<CachedFileInfo[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'SELECT * FROM file_cache WHERE hash = ?'
    const rows = this.db.prepare(query).all(hash) as any[]

    return rows.map((row) => ({
      path: row.path,
      size: row.size,
      modifiedAt: row.modified_at,
      hash: row.hash,
      perceptualHash: row.perceptual_hash,
      videoFingerprintJson: row.video_fingerprint_json,
      lastChecked: row.last_checked,
    }))
  }

  /**
   * 캐시 통계 정보 조회
   */
  async getCacheStats(): Promise<{
    totalFiles: number
    filesWithPerceptualHash: number
    filesWithVideoFingerprint: number
    oldestEntry: string | null
    newestEntry: string | null
  }> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(perceptual_hash) as files_with_perceptual_hash,
        COUNT(video_fingerprint_json) as files_with_video_fingerprint,
        MIN(last_checked) as oldest_entry,
        MAX(last_checked) as newest_entry
      FROM file_cache
    `

    const row = this.db.prepare(query).get() as any

    return {
      totalFiles: row.total_files || 0,
      filesWithPerceptualHash: row.files_with_perceptual_hash || 0,
      filesWithVideoFingerprint: row.files_with_video_fingerprint || 0,
      oldestEntry: row.oldest_entry,
      newestEntry: row.newest_entry,
    }
  }

  /**
   * 데이터베이스 연결 종료
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// 전역 캐시 인스턴스 (싱글톤 패턴)
let globalFileCache: FileCache | null = null

export async function getFileCache(): Promise<FileCache> {
  if (!globalFileCache) {
    globalFileCache = new FileCache()
    await globalFileCache.initialize()
  }
  return globalFileCache
}
