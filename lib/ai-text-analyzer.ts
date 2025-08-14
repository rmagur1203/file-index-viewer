import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { getVectorCache, AIEmbedding } from './vector-cache'

export interface TextAnalysisResult {
  embedding: number[]
  modelName: string
  confidence: number
  processingTime: number
  wordCount: number
  charCount: number
  language?: string
  extractedText: string
  summary?: string
}

export interface TextMetadata {
  size: number
  hash: string
  encoding: string
  wordCount: number
  charCount: number
  language?: string
}

/**
 * AI 텍스트 분석기
 * OpenAI Embeddings API 또는 로컬 모델을 사용하여 텍스트 특징을 추출
 */
export class AITextAnalyzer {
  private isInitialized = false
  private modelName = 'text-embedding-ada-002'
  private apiKey: string | null = null
  private useLocalModel = false

  /**
   * 분석기 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('📝 Initializing AI Text Analyzer...')

      // OpenAI API 키 확인
      this.apiKey = process.env.OPENAI_API_KEY || null

      if (this.apiKey) {
        console.log('🔑 OpenAI API key found, using cloud embeddings')
        this.modelName = 'text-embedding-ada-002'
        this.useLocalModel = false
      } else {
        console.log('⚠️ No OpenAI API key found, using local embeddings')
        this.modelName = 'local-text-embeddings'
        this.useLocalModel = true
      }

      console.log('✅ AI Text Analyzer initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize AI Text Analyzer:', error)
      throw new Error(
        `Text analyzer initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 텍스트 파일에서 내용 추출 및 전처리
   */
  private async extractTextContent(filePath: string): Promise<{
    text: string
    metadata: TextMetadata
  }> {
    try {
      // 파일 존재 여부 확인
      try {
        await fs.access(filePath)
      } catch (accessError) {
        console.warn(`⚠️ File not found, skipping: ${filePath}`)
        return {
          text: '',
          metadata: {
            size: 0,
            hash: '',
            encoding: '',
            wordCount: 0,
            charCount: 0,
          },
        }
      }

      // 파일 통계 정보
      const stats = await fs.stat(filePath)

      // 파일 내용 읽기 (다양한 인코딩 지원)
      let content = ''
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath)
        // 안정성을 위해 서버 사이드에서는 pdfjs-dist만 사용
        content = await this.extractPdfTextWithPdfjs(dataBuffer)
      } else {
        try {
          // UTF-8로 먼저 시도
          content = await fs.readFile(filePath, 'utf-8')
        } catch (encodingError) {
          // UTF-8 실패시 다른 인코딩 시도
          try {
            content = await fs.readFile(filePath, 'latin1')
          } catch (fallbackError) {
            console.warn(
              `⚠️ Failed to read ${filePath} with standard encodings, using buffer`
            )
            const buffer = await fs.readFile(filePath)
            content = buffer.toString(
              'utf-8',
              0,
              Math.min(buffer.length, 10000)
            ) // 처음 10KB만
          }
        }
      }

      // 텍스트 정제
      const cleanedText = this.preprocessText(content)

      // 해시 계산
      const fileBuffer = await fs.readFile(filePath)
      const fileHash = createHash('md5').update(fileBuffer).digest('hex')

      // 메타데이터 생성
      const metadata: TextMetadata = {
        size: stats.size,
        hash: fileHash,
        encoding: 'utf-8', // 추정
        wordCount: this.countWords(cleanedText),
        charCount: cleanedText.length,
        language: this.detectLanguage(cleanedText),
      }

      return { text: cleanedText, metadata }
    } catch (error) {
      throw new Error(
        `Failed to extract text from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * pdfjs-dist를 이용한 PDF 텍스트 추출 폴백
   */
  private async extractPdfTextWithPdfjs(dataBuffer: Buffer): Promise<string> {
    try {
      // Node.js 환경에서는 반드시 legacy 빌드를 사용해야 안정적
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')

      // Node 환경에서 워커를 사용하지 않도록 설정 (일부 환경에서 에러 예방)
      if (pdfjs.GlobalWorkerOptions) {
        try {
          pdfjs.GlobalWorkerOptions.workerSrc = undefined as any
        } catch {}
      }

      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(dataBuffer),
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
      })
      const doc = await loadingTask.promise
      try {
        let fullText = ''
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          const textContent = await page.getTextContent()
          const pageText = (textContent.items as any[])
            .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
            .join(' ')
          fullText += pageText + '\n'
        }
        // pdfjs가 텍스트를 추출하지 못하는 스캔본의 경우 빈 문자열이 될 수 있음
        if (fullText.trim().length > 0) {
          return fullText
        }
        // 빈 결과면 외부 도구 폴백 시도
        return await this.extractPdfTextWithPdftotext(dataBuffer)
      } finally {
        await doc.destroy()
      }
    } catch (fallbackError) {
      // pdfjs 실패 시 외부 도구 폴백 시도
      try {
        return await this.extractPdfTextWithPdftotext(dataBuffer)
      } catch (cliErr) {
        throw new Error(
          `pdfjs-dist extraction failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        )
      }
    }
  }

  /**
   * poppler의 pdftotext CLI를 사용한 폴백 추출 (설치되어 있을 때만 동작)
   */
  private async extractPdfTextWithPdftotext(
    dataBuffer: Buffer
  ): Promise<string> {
    try {
      const { execSync } = await import('child_process')
      // pdftotext 존재 확인
      const whichOutput = execSync('which pdftotext', {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim()
      if (!whichOutput) {
        return ''
      }

      const os = await import('os')
      const tmpdir = os.tmpdir()
      const inputPath = `${tmpdir}/ai-text-${Date.now()}.pdf`
      const outputPath = `${tmpdir}/ai-text-${Date.now()}.txt`
      await fs.writeFile(inputPath, dataBuffer)

      try {
        execSync(
          `pdftotext -enc UTF-8 -layout -q "${inputPath}" "${outputPath}"`,
          {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 60000,
          }
        )
      } catch {
        // 변환 실패시 빈 문자열 반환
        return ''
      } finally {
        try {
          await fs.rm(inputPath)
        } catch {}
      }

      try {
        const text = await fs.readFile(outputPath, 'utf-8')
        return text || ''
      } finally {
        try {
          await fs.rm(outputPath)
        } catch {}
      }
    } catch {
      return ''
    }
  }

  /**
   * 텍스트 전처리
   */
  private preprocessText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Windows 줄바꿈 정규화
      .replace(/\r/g, '\n') // Mac 줄바꿈 정규화
      .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 제거
      .replace(/\s+/g, ' ') // 연속된 공백 정규화
      .trim()
  }

  /**
   * 단어 수 계산
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }

  /**
   * 간단한 언어 감지
   */
  private detectLanguage(text: string): string {
    const sample = text.substring(0, 1000) // 처음 1000자만 샘플링

    // 한글 문자 비율
    const koreanChars = (sample.match(/[가-힣]/g) || []).length
    const koreanRatio = koreanChars / sample.length

    // 영어 문자 비율
    const englishChars = (sample.match(/[a-zA-Z]/g) || []).length
    const englishRatio = englishChars / sample.length

    if (koreanRatio > 0.1) return 'ko'
    if (englishRatio > 0.5) return 'en'
    return 'unknown'
  }

  /**
   * OpenAI Embeddings API 호출 (개선된 버전)
   */
  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not available')
    }

    try {
      // 텍스트 길이 제한 (OpenAI 토큰 제한 고려)
      const maxTokens = 8000 // 대략 8000 토큰
      const truncatedText =
        text.length > maxTokens ? text.substring(0, maxTokens) : text

      console.log(
        `🔑 Calling OpenAI API for text embedding (${truncatedText.length} chars)`
      )

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName, // text-embedding-ada-002
          input: truncatedText,
          encoding_format: 'float', // 명시적으로 float 형식 요청
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error?.message ||
          `${response.status} ${response.statusText}`
        throw new Error(`OpenAI API error: ${errorMessage}`)
      }

      const data = await response.json()

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response format from OpenAI API')
      }

      const embedding = data.data[0].embedding
      console.log(
        `✅ OpenAI embedding received: ${embedding.length} dimensions`
      )

      return embedding
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error)

      // API 오류시 로컬 임베딩으로 폴백
      if (
        error instanceof Error &&
        error.message.includes('API') &&
        !error.message.includes('key')
      ) {
        console.warn('🔄 Falling back to local embedding due to API error')
        return await this.getLocalEmbedding(text)
      }

      throw error
    }
  }

  /**
   * OpenAI API 배치 임베딩 (여러 텍스트를 한 번에 처리)
   */
  private async getOpenAIBatchEmbedding(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not available')
    }

    try {
      const maxTexts = 100 // OpenAI 배치 제한
      const batchTexts = texts
        .slice(0, maxTexts)
        .map((text) => (text.length > 8000 ? text.substring(0, 8000) : text))

      console.log(`🔑 Calling OpenAI Batch API for ${batchTexts.length} texts`)

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          input: batchTexts,
          encoding_format: 'float',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error?.message ||
          `${response.status} ${response.statusText}`
        throw new Error(`OpenAI Batch API error: ${errorMessage}`)
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid batch response format from OpenAI API')
      }

      const embeddings = data.data.map((item: any, index: number) => {
        if (!item.embedding) {
          throw new Error(`Missing embedding for text ${index}`)
        }
        return item.embedding
      })

      console.log(
        `✅ OpenAI batch embeddings received: ${embeddings.length} texts, ${embeddings[0]?.length} dimensions each`
      )

      return embeddings
    } catch (error) {
      console.error('❌ OpenAI Batch API call failed:', error)

      // 배치 실패시 개별 호출로 폴백
      console.warn('🔄 Falling back to individual API calls')
      const results = []
      for (const text of texts) {
        try {
          const embedding = await this.getOpenAIEmbedding(text)
          results.push(embedding)
        } catch (individualError) {
          console.warn(`⚠️ Skipping text due to error:`, individualError)
          const localEmbedding = await this.getLocalEmbedding(text)
          results.push(localEmbedding)
        }
      }
      return results
    }
  }

  /**
   * 로컬 임베딩 생성 (간단한 TF-IDF 기반)
   */
  private async getLocalEmbedding(text: string): Promise<number[]> {
    console.log('🔄 Generating local text embedding...')

    // 간단한 문자 기반 특징 벡터 생성
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
    const uniqueWords = [...new Set(words)]

    // 고정 크기 벡터 (1536차원으로 OpenAI와 호환)
    const vectorSize = 1536
    const embedding = new Array(vectorSize).fill(0)

    // 단어들을 해시하여 벡터 인덱스에 매핑
    for (const word of uniqueWords.slice(0, 100)) {
      // 상위 100개 단어만 사용
      const wordHash = this.simpleHash(word)
      const index = Math.abs(wordHash) % vectorSize
      embedding[index] += 1
    }

    // 정규화
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    )
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude
      }
    }

    return embedding
  }

  /**
   * 간단한 해시 함수
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 32bit 정수로 변환
    }
    return hash
  }

  /**
   * 텍스트 요약 생성 (간단한 버전)
   */
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 10)

    if (sentences.length <= 3) {
      return text.substring(0, 200) + (text.length > 200 ? '...' : '')
    }

    // 첫 번째와 중간, 마지막 문장 선택
    const summary =
      [
        sentences[0],
        sentences[Math.floor(sentences.length / 2)],
        sentences[sentences.length - 1],
      ].join('. ') + '.'

    return summary.length > 300 ? summary.substring(0, 300) + '...' : summary
  }

  /**
   * 텍스트 특징 추출
   */
  async extractFeatures(filePath: string): Promise<TextAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Text analyzer not initialized. Call initialize() first.')
    }

    const startTime = Date.now()

    try {
      console.log(`📄 Analyzing text file: ${path.basename(filePath)}`)

      // 텍스트 내용 추출
      const { text, metadata } = await this.extractTextContent(filePath)

      console.log(
        `📊 Text stats: ${metadata.wordCount} words, ${metadata.charCount} chars, language: ${metadata.language}`
      )

      // 임베딩 생성
      let embedding: number[]
      if (text.trim().length === 0) {
        // 빈 텍스트의 경우 1536차원 영벡터로 대체하여 파이프라인을 유지
        embedding = new Array(1536).fill(0)
      } else if (this.useLocalModel) {
        embedding = await this.getLocalEmbedding(text)
      } else {
        embedding = await this.getOpenAIEmbedding(text)
      }

      // 요약 생성
      const summary = this.generateSummary(text)

      const processingTime = Date.now() - startTime

      console.log(
        `✅ Text analysis completed: ${path.basename(filePath)} (${processingTime}ms)`
      )

      return {
        embedding,
        modelName: this.modelName,
        confidence: text.trim().length === 0 ? 0.1 : 0.9,
        processingTime,
        wordCount: metadata.wordCount,
        charCount: metadata.charCount,
        language: metadata.language,
        extractedText: text.substring(0, 1000), // 처음 1000자만 저장
        summary,
      }
    } catch (error) {
      console.error(`❌ Failed to analyze text file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 텍스트 분석 및 캐싱
   */
  async analyzeAndCache(
    filePath: string,
    fileSize: number,
    fileHash: string
  ): Promise<AIEmbedding> {
    const vectorCache = await getVectorCache()

    // 캐시에서 기존 임베딩 확인
    const existingEmbedding = await vectorCache.getEmbeddingByPath(filePath)
    if (
      existingEmbedding &&
      existingEmbedding.metadata &&
      existingEmbedding.metadata.hash === fileHash
    ) {
      console.log(
        `📋 Using cached text embedding for: ${path.basename(filePath)}`
      )
      return existingEmbedding
    }

    // 새로운 분석 수행
    const result = await this.extractFeatures(filePath)

    // 메타데이터 구성
    const metadata = {
      size: fileSize,
      hash: fileHash,
      width: 0, // 텍스트 파일에는 해당 없음
      height: 0,
      // 텍스트 특화 메타데이터
      wordCount: result.wordCount,
      charCount: result.charCount,
      language: result.language,
      processingTime: result.processingTime,
      confidence: result.confidence,
      summary: result.summary,
    } as any

    // 캐시에 저장
    const embedding: AIEmbedding = {
      id: `text_${fileHash}_${Date.now()}`,
      filePath,
      fileType: 'text',
      embedding: result.embedding,
      modelName: result.modelName,
      extractedAt: new Date().toISOString(),
      metadata,
    }

    await vectorCache.saveEmbedding(embedding)
    return embedding
  }

  /**
   * 유사한 텍스트 파일 검색
   */
  async findSimilarTexts(
    queryPath: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<
    Array<{
      file: AIEmbedding
      similarity: number
    }>
  > {
    const vectorCache = await getVectorCache()

    // 쿼리 파일 분석
    const fileStats = await fs.stat(queryPath)
    const fileBuffer = await fs.readFile(queryPath)
    const fileHash = createHash('md5').update(fileBuffer).digest('hex')

    const queryEmbedding = await this.analyzeAndCache(
      queryPath,
      fileStats.size,
      fileHash
    )

    // 유사한 텍스트 검색
    const results = await vectorCache.findSimilar(
      queryEmbedding.embedding,
      'text',
      limit + 1,
      threshold
    )

    // 자기 자신 제외
    return results
      .filter((result) => result.file.filePath !== queryPath)
      .slice(0, limit)
      .map((result) => ({
        file: result.file,
        similarity: result.similarity,
      }))
  }

  /**
   * 배치 텍스트 분석
   */
  async analyzeBatch(
    textPaths: string[],
    progressCallback?: (
      completed: number,
      total: number,
      currentFile: string
    ) => void
  ): Promise<AIEmbedding[]> {
    const results: AIEmbedding[] = []
    const total = textPaths.length

    console.log(`📚 Starting batch text analysis of ${total} files...`)

    for (let i = 0; i < textPaths.length; i++) {
      const textPath = textPaths[i]

      try {
        if (progressCallback) {
          progressCallback(i, total, textPath)
        }

        // 파일 정보 수집
        const fileStats = await fs.stat(textPath)
        const fileBuffer = await fs.readFile(textPath)
        const fileHash = createHash('md5').update(fileBuffer).digest('hex')

        // 분석 및 캐시
        const embedding = await this.analyzeAndCache(
          textPath,
          fileStats.size,
          fileHash
        )
        results.push(embedding)

        console.log(
          `✅ Processed ${i + 1}/${total}: ${path.basename(textPath)}`
        )
      } catch (error) {
        console.error(`❌ Failed to process ${textPath}:`, error)
        // 실패한 파일은 건너뛰고 계속 진행
      }
    }

    if (progressCallback) {
      progressCallback(total, total, 'Completed')
    }

    console.log(
      `🏁 Batch text analysis completed: ${results.length}/${total} files processed`
    )
    return results
  }

  /**
   * 모델 정보 반환
   */
  getModelInfo(): {
    name: string
    isInitialized: boolean
    useLocalModel: boolean
  } {
    return {
      name: this.modelName,
      isInitialized: this.isInitialized,
      useLocalModel: this.useLocalModel,
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    console.log('🧹 Disposing text analyzer resources...')
    this.isInitialized = false
  }
}

// 전역 인스턴스
let globalTextAnalyzer: AITextAnalyzer | null = null

export async function getTextAnalyzer(): Promise<AITextAnalyzer> {
  if (!globalTextAnalyzer) {
    globalTextAnalyzer = new AITextAnalyzer()
    await globalTextAnalyzer.initialize()
  }
  return globalTextAnalyzer
}
