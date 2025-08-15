import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { getVectorCache, AIEmbedding } from './vector-cache'
import { pipeline, env, Pipeline } from '@xenova/transformers'
import pdfParse from 'pdf-parse'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { Canvas, createCanvas, Image, ImageData } from 'canvas'
import 'pdfjs-dist/legacy/build/pdf.mjs' // Import for side-effects
import 'pdfjs-dist/legacy/build/pdf.worker.mjs' // Import for side-effects

// Node.js 환경에서 pdf.js가 필요로 하는 DOM API 및 헬퍼를 설정합니다.
// 이는 pdfjs-dist의 'node_utils.mjs' 헬퍼 스크립트의 핵심 로직을 재현한 것입니다.
if (typeof window === 'undefined') {
  const globalScope = globalThis as any

  // DOMMatrix 폴리필
  if (!globalScope.DOMMatrix) {
    class DOMMatrix {
      private m: number[]
      constructor(init?: number[] | string) {
        this.m = Array.isArray(init) ? [...init] : [1, 0, 0, 1, 0, 0]
      }
      translate(tx: number, ty: number): DOMMatrix {
        return new DOMMatrix([
          this.m[0],
          this.m[1],
          this.m[2],
          this.m[3],
          this.m[4] + tx * this.m[0] + ty * this.m[2],
          this.m[5] + tx * this.m[1] + ty * this.m[3],
        ])
      }
      // pdf.js 렌더링에 필요한 다른 DOMMatrix 메소드들을 여기에 추가할 수 있습니다.
    }
    globalScope.DOMMatrix = DOMMatrix
  }

  // node-canvas의 Image와 ImageData를 전역으로 설정
  globalScope.Image = Image
  globalScope.ImageData = ImageData

  // Canvas 객체에서 createImageData를 사용할 수 있도록 래핑
  const originalCreateCanvas = createCanvas
  ;(globalScope as any).createCanvas = (width: number, height: number) => {
    const canvas = originalCreateCanvas(width, height)
    ;(canvas as any).createImageData = function (
      width: number,
      height: number
    ) {
      return new ImageData(width, height)
    }
    return canvas
  }
}

env.allowLocalModels = true

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return {
      canvas,
      context,
    }
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

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
  private localEmbeddingPipeline: any | null = null

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
        this.modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
        this.useLocalModel = true
        this.localEmbeddingPipeline = await pipeline(
          'feature-extraction',
          this.modelName
        )
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
        try {
          const data = await pdfParse(dataBuffer)
          if (data.text && data.text.trim().length > 0) {
            content = data.text
          }
        } catch (pdfParseError) {
          console.warn(`⚠️ pdf-parse failed for ${filePath}:`, pdfParseError)
          content = ''
        }

        // 텍스트 추출에 실패했다면 OCR 시도
        if (!content || content.trim().length === 0) {
          console.log(
            `📝 pdf-parse found no text, attempting OCR for ${filePath}`
          )
          try {
            content = await this.extractPdfTextWithOcr(dataBuffer)
          } catch (ocrError) {
            console.error(`❌ OCR failed for ${filePath}:`, ocrError)
            content = '' // OCR 실패 시 빈 내용으로 처리
          }
        }
      } else {
        // For non-PDF files, read them as plain text
        content = await fs.readFile(filePath, 'utf-8')
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

  private async extractPdfTextWithOcr(pdfBuffer: Buffer): Promise<string> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

    // 환경에 따라 워커 설정
    if (typeof window !== 'undefined') {
      // 클라이언트 환경: 복사된 워커 파일 경로 지정
      pdfjs.GlobalWorkerOptions.workerSrc =
        '/_next/static/chunks/pdf.worker.mjs'
    }

    const canvasFactory = new NodeCanvasFactory()
    // @ts-ignore
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableFontFace: true,
      // 서버 환경에서는 워커를 명시적으로 비활성화
      disableWorker: typeof window === 'undefined',
      // Node.js 환경에서 canvas를 생성할 수 있도록 팩토리를 제공
      canvasFactory,
    })
    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    let fullText = ''

    const worker = await createWorker('kor+eng', OEM.LSTM_ONLY, {
      // logger: (m) => console.log(m), // OCR 진행률 로깅
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO_OSD,
    })

    console.log(`🚀 Starting OCR process for ${numPages} pages...`)

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 }) // 해상도를 높여 인식률 향상
      const { canvas, context } = canvasFactory.create(
        viewport.width,
        viewport.height
      )

      await page.render({ canvasContext: context as any, viewport }).promise
      const imageBuffer = (canvas as Canvas).toBuffer('image/png')

      const {
        data: { text },
      } = await worker.recognize(imageBuffer)
      fullText += text + '\n'
      console.log(`🔍 OCR progress: Page ${i}/${numPages} completed.`)

      // 메모리 정리
      page.cleanup()
      canvasFactory.destroy({ canvas, context })
    }

    await worker.terminate()
    console.log('✅ OCR process finished.')
    return fullText
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
    if (!this.localEmbeddingPipeline) {
      throw new Error(
        'Local embedding pipeline not initialized. Call initialize() first.'
      )
    }

    console.log('🔄 Generating local text embedding...')

    // 텍스트 길이 제한 (모델 성능 및 메모리 사용량 고려)
    const maxLength = 512
    const truncatedText =
      text.length > maxLength ? text.substring(0, maxLength) : text

    const result = await this.localEmbeddingPipeline(truncatedText, {
      pooling: 'mean',
      normalize: true,
    })

    // 결과 텐서에서 데이터를 추출하여 일반 배열로 변환
    const embedding = Array.from(result.data as Float32Array)

    console.log(`✅ Local embedding generated: ${embedding.length} dimensions`)

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
    this.localEmbeddingPipeline = null
  }
}

// 전역 인스턴스
let globalTextAnalyzer: AITextAnalyzer | null = null

export async function getTextAnalyzer(): Promise<AITextAnalyzer> {
  if (!globalTextAnalyzer) {
    globalTextAnalyzer = new AITextAnalyzer()
  }

  // AITextAnalyzer 클래스에 isInitialized 속성이 이미 존재함
  if (!globalTextAnalyzer.getModelInfo().isInitialized) {
    await globalTextAnalyzer.initialize()
  }

  return globalTextAnalyzer
}
