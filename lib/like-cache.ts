import Database from 'better-sqlite3'
import path from 'path'
import { promises as fs } from 'fs'

export class LikeCache {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'temp', 'likes.db')
  }

  async initialize(): Promise<void> {
    const tempDir = path.dirname(this.dbPath)
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {})

    this.db = new Database(this.dbPath)

    await this.createTables()
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const createLikesTable = `
      CREATE TABLE IF NOT EXISTS likes (
        path TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
    this.db.exec(createLikesTable)
  }

  async addLike(filePath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'INSERT OR IGNORE INTO likes (path) VALUES (?)'
    this.db.prepare(query).run(filePath)
  }

  async removeLike(filePath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'DELETE FROM likes WHERE path = ?'
    this.db.prepare(query).run(filePath)
  }

  async isLiked(filePath: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'SELECT path FROM likes WHERE path = ?'
    const row = this.db.prepare(query).get(filePath)
    return !!row
  }

  async getAllLikes(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const query = 'SELECT path FROM likes ORDER BY created_at DESC'
    const rows = this.db.prepare(query).all() as { path: string }[]
    return rows.map((row) => row.path)
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

let globalLikeCache: LikeCache | null = null

export async function getLikeCache(): Promise<LikeCache> {
  if (!globalLikeCache) {
    globalLikeCache = new LikeCache()
    await globalLikeCache.initialize()
  }
  return globalLikeCache
}
