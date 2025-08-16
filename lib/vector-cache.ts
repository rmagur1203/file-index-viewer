import Database from 'better-sqlite3'
import path from 'path'
import { promises as fs } from 'fs'
import * as sqliteVec from 'sqlite-vec'

export interface AIEmbedding {
  id: string
  filePath: string
  fileType: 'image' | 'video' | 'text'
  modelName: string
  embedding: number[]
  extractedAt: string
  metadata?: {
    width?: number
    height?: number
    duration?: number
    size: number
    hash: string
  }
}

export interface SimilarityResult {
  file: AIEmbedding
  similarity: number
  distance: number
}

export class VectorCache {
  private db: Database.Database | null = null
  private dbPath: string
  private vecLoaded = false

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'temp', 'vector-cache.db')
  }

  isInitialized(): boolean {
    return this.db !== null
  }

  /**
   * 데이터베이스 연결 및 sqlite-vec 로딩
   */
  async initialize(): Promise<void> {
    try {
      // temp 디렉토리 생성
      const tempDir = path.dirname(this.dbPath)
      await fs.mkdir(tempDir, { recursive: true }).catch(() => {
        // 이미 존재하는 경우 무시
      })

      // 데이터베이스 열기
      this.db = new Database(this.dbPath)
      this.db.defaultSafeIntegers(true)

      // sqlite-vec 확장 로딩 시도
      try {
        await this.loadSqliteVec()
        console.log('✅ sqlite-vec extension loaded successfully')
      } catch (error) {
        console.warn('⚠️ sqlite-vec extension failed to load:', error)
        console.log('💡 Vector search will use fallback cosine similarity')
      }

      // 테이블 생성
      await this.createTables()
      await this.rebuildVectorTable()
    } catch (error) {
      console.error('Failed to initialize VectorCache:', error)
      throw error
    }
  }

  /**
   * sqlite-vec 확장 로딩
   */
  private async loadSqliteVec(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    try {
      // Node.js에서 sqlite-vec 모듈 동적 로딩 시도
      sqliteVec.load(this.db)
      this.vecLoaded = true
    } catch (error) {
      console.warn('sqlite-vec module not found, using fallback methods', error)
      this.vecLoaded = false
    }
  }

  /**
   * 데이터베이스 테이블 생성
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const createEmbeddingsTable = `
      CREATE TABLE IF NOT EXISTS ai_embeddings (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK(file_type IN ('image', 'video', 'text')),
        model_name TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_ai_embeddings_file_path ON ai_embeddings(file_path)',
      'CREATE INDEX IF NOT EXISTS idx_ai_embeddings_file_type ON ai_embeddings(file_type)',
      'CREATE INDEX IF NOT EXISTS idx_ai_embeddings_model ON ai_embeddings(model_name)',
      'CREATE INDEX IF NOT EXISTS idx_ai_embeddings_extracted_at ON ai_embeddings(extracted_at)',
    ]

    this.db.exec(createEmbeddingsTable)
    createIndexes.forEach((index) => this.db!.exec(index))

    // sqlite-vec 벡터 테이블 생성 (확장이 로딩된 경우)
    if (this.vecLoaded) {
      try {
        const createVectorTable = `
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
            embedding float[384]
          )
        `
        this.db.exec(createVectorTable)
        console.log('✅ Vector table created with sqlite-vec')
      } catch (error) {
        console.warn('Failed to create vector table:', error)
        this.vecLoaded = false
      }
    }
  }

  async rebuildVectorTable(): Promise<void> {
    if (!this.db || !this.vecLoaded) return

    // 1. 차원이 맞지 않는 임베딩 찾기
    const allEmbeddings = this.db
      .prepare('SELECT id, embedding_json FROM ai_embeddings')
      .all() as { id: string; embedding_json: string }[]

    const idsToDelete: string[] = []
    for (const embedding of allEmbeddings) {
      try {
        const parsedEmbedding = JSON.parse(embedding.embedding_json)
        if (parsedEmbedding.length !== 384) {
          idsToDelete.push(embedding.id)
        }
      } catch {
        // JSON 파싱 실패 시에도 삭제 대상에 추가
        idsToDelete.push(embedding.id)
      }
    }

    // 2. 오래된 임베딩 데이터 삭제
    if (idsToDelete.length > 0) {
      console.warn(
        `🗑️ Deleting ${idsToDelete.length} embeddings with mismatched dimensions...`
      )
      const placeholders = idsToDelete.map(() => '?').join(',')
      const deleteQuery = `DELETE FROM ai_embeddings WHERE id IN (${placeholders})`
      this.db.prepare(deleteQuery).run(...idsToDelete)
    }

    // 3. 가상 테이블 초기화 및 재생성
    this.db.exec('DROP TABLE IF EXISTS vec_embeddings')
    this.db.exec(`
      CREATE VIRTUAL TABLE vec_embeddings USING vec0(
        embedding float[384]
      )
    `)

    // 4. 정리된 데이터를 바탕으로 가상 테이블 다시 채우기
    const embeddingsToRepopulate = this.db
      .prepare('SELECT rowid, embedding_json FROM ai_embeddings')
      .all() as { rowid: bigint; embedding_json: string }[]

    if (embeddingsToRepopulate.length > 0) {
      console.log(
        ` Rebuilding vector table with ${embeddingsToRepopulate.length} items...`
      )

      const insert = this.db.prepare(
        'INSERT INTO vec_embeddings(rowid, embedding) VALUES (?, ?)'
      )
      const insertMany = this.db.transaction((embeddings) => {
        for (const embedding of embeddings) {
          insert.run(embedding.rowid, embedding.embedding_json)
        }
      })
      insertMany(embeddingsToRepopulate)
    }
    console.log('✅ Vector table rebuild complete')
  }

  /**
   * 임베딩 저장
   */
  async saveEmbedding(embedding: AIEmbedding): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction(() => {
      // 기본 테이블에 저장
      const query = `
        INSERT OR REPLACE INTO ai_embeddings 
        (id, file_path, file_type, model_name, embedding_json, extracted_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `

      this.db!.prepare(query).run(
        embedding.id,
        embedding.filePath,
        embedding.fileType,
        embedding.modelName,
        JSON.stringify(embedding.embedding),
        embedding.extractedAt,
        embedding.metadata ? JSON.stringify(embedding.metadata) : null
      )

      // sqlite-vec 테이블에도 저장 (사용 가능한 경우)
      if (this.vecLoaded) {
        if (embedding.embedding.length !== 384) {
          return // 차원이 다른 벡터는 저장하지 않음
        }
        try {
          const { rowid } = this.db!.prepare(
            'SELECT rowid FROM ai_embeddings WHERE id = ?'
          ).get(embedding.id) as { rowid: bigint }

          if (rowid) {
            const vectorQuery = `
              INSERT OR REPLACE INTO vec_embeddings(rowid, embedding) 
              VALUES (?, ?)
            `
            this.db!.prepare(vectorQuery).run(
              rowid,
              JSON.stringify(embedding.embedding)
            )
          }
        } catch (error) {
          console.warn('Failed to save to vector table:', error)
        }
      }
    })

    transaction()
  }

  /**
   * 유사한 임베딩 검색
   */
  async findSimilar(
    queryEmbedding: number[],
    fileType?: 'image' | 'video' | 'text',
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error('Database not initialized')

    // sqlite-vec 사용 가능한 경우 (더 빠름)
    if (this.vecLoaded) {
      return this.findSimilarWithVec(queryEmbedding, fileType, limit, threshold)
    }

    // Fallback: 코사인 유사도 계산
    return this.findSimilarWithCosine(
      queryEmbedding,
      fileType,
      limit,
      threshold
    )
  }

  /**
   * sqlite-vec를 사용한 유사도 검색
   */
  private async findSimilarWithVec(
    queryEmbedding: number[],
    fileType?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SimilarityResult[]> {
    try {
      let query = `
        SELECT 
          e.id, e.file_path, e.file_type, e.model_name, 
          e.embedding_json, e.extracted_at, e.metadata_json,
          vec.distance
        FROM vec_embeddings vec
        JOIN ai_embeddings e ON e.rowid = vec.rowid
        WHERE vec.embedding MATCH ? AND k = ?
      `

      const params: any[] = [JSON.stringify(queryEmbedding), limit]

      if (fileType) {
        query += ` AND e.file_type = ?`
        params.push(fileType)
      }

      const rows = this.db!.prepare(query).all(...params) as any[]

      return rows
        .map((row) => ({
          file: this.rowToEmbedding(row),
          similarity: 1 - row.distance, // distance를 similarity로 변환
          distance: row.distance,
        }))
        .filter((result) => result.similarity >= threshold)
    } catch (error) {
      console.warn(
        'sqlite-vec search failed, falling back to cosine similarity:',
        error
      )
      return this.findSimilarWithCosine(
        queryEmbedding,
        fileType,
        limit,
        threshold
      )
    }
  }

  /**
   * 코사인 유사도를 사용한 검색 (Fallback)
   */
  private async findSimilarWithCosine(
    queryEmbedding: number[],
    fileType?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SimilarityResult[]> {
    let query = `
      SELECT id, file_path, file_type, model_name, embedding_json, extracted_at, metadata_json
      FROM ai_embeddings
    `

    const params: any[] = []

    if (fileType) {
      query += ` WHERE file_type = ?`
      params.push(fileType)
    }

    const rows = this.db!.prepare(query).all(...params) as any[]

    const results: SimilarityResult[] = []

    for (const row of rows) {
      const embedding = JSON.parse(row.embedding_json) as number[]
      const similarity = this.cosineSimilarity(queryEmbedding, embedding)

      if (similarity >= threshold) {
        results.push({
          file: this.rowToEmbedding(row),
          similarity,
          distance: 1 - similarity,
        })
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 데이터베이스 행을 AIEmbedding 객체로 변환
   */
  private rowToEmbedding(row: any): AIEmbedding {
    return {
      id: row.id,
      filePath: row.file_path,
      fileType: row.file_type,
      modelName: row.model_name,
      embedding: JSON.parse(row.embedding_json),
      extractedAt: row.extracted_at,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }
  }

  /**
   * 파일 경로로 임베딩 조회
   */
  async getEmbeddingByPath(
    filePath: string,
    modelName?: string
  ): Promise<AIEmbedding | null> {
    if (!this.db) throw new Error('Database not initialized')

    let query = 'SELECT * FROM ai_embeddings WHERE file_path = ?'
    const params: any[] = [filePath]

    if (modelName) {
      query += ' AND model_name = ?'
      params.push(modelName)
    }

    query += ' ORDER BY extracted_at DESC LIMIT 1'

    const row = this.db.prepare(query).get(...params) as any
    return row ? this.rowToEmbedding(row) : null
  }

  /**
   * 특정 파일 타입의 모든 임베딩 삭제
   */
  async clearEmbeddingsByType(
    fileType: 'image' | 'video' | 'text'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    console.log(`🗑️ Clearing all embeddings for file type: ${fileType}...`)

    const transaction = this.db.transaction(() => {
      // 삭제할 임베딩의 ID와 rowid 목록 가져오기
      const rowsToDelete = this.db!.prepare(
        'SELECT id, rowid FROM ai_embeddings WHERE file_type = ?'
      ).all(fileType) as { id: string; rowid: bigint }[]

      if (rowsToDelete.length === 0) {
        console.log(`👍 No embeddings to clear for type: ${fileType}`)
        return
      }

      const idsToDelete = rowsToDelete.map((row) => row.id)
      const rowIdsToDelete = rowsToDelete.map((row) => row.rowid)

      // sqlite-vec 테이블에서 삭제 (사용 가능한 경우)
      if (this.vecLoaded) {
        try {
          const placeholders = rowIdsToDelete.map(() => '?').join(',')
          const deleteVecQuery = `DELETE FROM vec_embeddings WHERE rowid IN (${placeholders})`
          this.db!.prepare(deleteVecQuery).run(...rowIdsToDelete)
        } catch (error) {
          console.warn('Failed to clear from vector table:', error)
        }
      }

      // 기본 테이블에서 삭제
      const placeholders = idsToDelete.map(() => '?').join(',')
      const deleteQuery = `DELETE FROM ai_embeddings WHERE id IN (${placeholders})`
      const result = this.db!.prepare(deleteQuery).run(...idsToDelete)

      console.log(
        `✅ Cleared ${result.changes} embeddings for file type: ${fileType}`
      )
    })

    transaction()
  }

  /**
   * 통계 정보 조회
   */
  async getStats(): Promise<{
    totalEmbeddings: number
    imageEmbeddings: number
    videoEmbeddings: number
    textEmbeddings: number
    models: { [modelName: string]: number }
  }> {
    if (!this.db) throw new Error('Database not initialized')

    const totalQuery = 'SELECT COUNT(*) as total FROM ai_embeddings'
    const typeQuery = `
      SELECT file_type, COUNT(*) as count 
      FROM ai_embeddings 
      GROUP BY file_type
    `
    const modelQuery = `
      SELECT model_name, COUNT(*) as count 
      FROM ai_embeddings 
      GROUP BY model_name
    `

    const totalResult = this.db.prepare(totalQuery).get() as { total: bigint }
    const typeResults = this.db.prepare(typeQuery).all() as {
      file_type: string
      count: bigint
    }[]
    const modelResults = this.db.prepare(modelQuery).all() as {
      model_name: string
      count: bigint
    }[]

    const stats = {
      totalEmbeddings: Number(totalResult.total),
      imageEmbeddings: 0,
      videoEmbeddings: 0,
      textEmbeddings: 0,
      models: {} as { [modelName: string]: number },
    }

    typeResults.forEach((row) => {
      if (row.file_type === 'image') stats.imageEmbeddings = Number(row.count)
      if (row.file_type === 'video') stats.videoEmbeddings = Number(row.count)
      if (row.file_type === 'text') stats.textEmbeddings = Number(row.count)
    })

    modelResults.forEach((row) => {
      stats.models[row.model_name] = Number(row.count)
    })

    return stats
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

// 전역 벡터 캐시 인스턴스 (싱글톤 패턴)
let vectorCacheInstance: VectorCache | null = null

export async function getVectorCache(): Promise<VectorCache> {
  if (!vectorCacheInstance) {
    vectorCacheInstance = new VectorCache()
  }

  if (!vectorCacheInstance.isInitialized()) {
    await vectorCacheInstance.initialize()
  }

  return vectorCacheInstance
}
