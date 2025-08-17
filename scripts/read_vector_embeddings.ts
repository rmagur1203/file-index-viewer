import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

function readVectorEmbeddings() {
  // 데이터베이스 파일 경로. 실제 경로로 수정해주세요.
  const dbPath = 'temp/vector-cache.db'
  const tableName = 'vec_embeddings_media'

  let db
  try {
    db = new Database(dbPath)
    console.log(`Successfully connected to database at ${dbPath}`)

    // sqlite-vec 확장을 데이터베이스 연결에 로드합니다.
    sqliteVec.load(db)

    // 데이터베이스의 모든 테이블 목록을 가져옵니다.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
    console.log(
      'Tables in database:',
      tables.map((t) => t.name)
    )

    // 테이블의 모든 데이터를 가져옵니다.
    const stmt = db.prepare(`SELECT * FROM ${tableName}`)
    const rows = stmt.all()

    console.log(`Found ${rows.length} rows in '${tableName}':`)
    rows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row)
    })
  } catch (error) {
    console.error('Error reading vector embeddings:', error)
  } finally {
    if (db) {
      db.close()
      console.log('Database connection closed.')
    }
  }
}

readVectorEmbeddings()
