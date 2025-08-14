import * as tf from '@tensorflow/tfjs-node'
import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { getVectorCache, AIEmbedding } from './vector-cache'
import { getImageAnalyzer } from './ai-image-analyzer'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { Worker } from 'worker_threads'
import os from 'os'
import { AIImageAnalyzer } from './ai-image-analyzer'

export interface VideoAnalysisResult {
  embedding: number[]
  modelName: string
  confidence: number
  processingTime: number
  frameCount: number
  keyframes: Array<{
    timestamp: number
    embedding: number[]
    confidence: number
  }>
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  frameRate: number
  size: number
  hash: string
  frameCount?: number
  processingTime?: number
  confidence?: number
}

/**
 * 성능 최적화를 위한 동시 처리 관리자
 */
class ConcurrencyManager {
  private static instance: ConcurrencyManager
  private maxConcurrency: number
  private currentJobs = 0
  private memoryThreshold = 0.8 // 80% 메모리 사용량 임계점

  private constructor() {
    // CPU 코어 수에 기반한 최적 동시 처리 수 계산
    const cpuCount = os.cpus().length
    this.maxConcurrency = Math.min(4, Math.max(2, Math.floor(cpuCount * 0.75)))
    console.log(
      `🔧 ConcurrencyManager initialized with max concurrency: ${this.maxConcurrency}`
    )
  }

  static getInstance(): ConcurrencyManager {
    if (!ConcurrencyManager.instance) {
      ConcurrencyManager.instance = new ConcurrencyManager()
    }
    return ConcurrencyManager.instance
  }

  async acquireSlot(): Promise<void> {
    while (this.currentJobs >= this.maxConcurrency || this.isMemoryHigh()) {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms 대기
    }
    this.currentJobs++
  }

  releaseSlot(): void {
    this.currentJobs = Math.max(0, this.currentJobs - 1)
  }

  private isMemoryHigh(): boolean {
    const memUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const usedMemory = memUsage.heapUsed + memUsage.external
    const memoryRatio = usedMemory / totalMemory

    if (memoryRatio > this.memoryThreshold) {
      console.warn(
        `⚠️ High memory usage detected: ${(memoryRatio * 100).toFixed(1)}%`
      )
      return true
    }
    return false
  }

  getStats(): {
    concurrency: number
    maxConcurrency: number
    memoryUsage: number
  } {
    const memUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const usedMemory = memUsage.heapUsed + memUsage.external
    const memoryUsagePercent = (usedMemory / totalMemory) * 100

    return {
      concurrency: this.currentJobs,
      maxConcurrency: this.maxConcurrency,
      memoryUsage: memoryUsagePercent,
    }
  }

  setMaxConcurrency(max: number): void {
    this.maxConcurrency = Math.max(1, Math.min(8, max))
    console.log(`🔧 Max concurrency updated to: ${this.maxConcurrency}`)
  }
}

export class AIVideoAnalyzer {
  private isInitialized = false
  private modelName = 'video_mobilenet_v2'
  private maxKeyframes = 10 // 최대 키프레임 수
  private concurrencyManager = ConcurrencyManager.getInstance()
  private imageAnalyzer: AIImageAnalyzer | null = null

  /**
   * 비디오 분석기 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🎬 Initializing AI Video Analyzer...')

      // 이미지 분석기가 필요함 (키프레임 분석용)
      await this.ensureImageAnalyzer()

      console.log('✅ AI Video Analyzer initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize AI Video Analyzer:', error)
      throw new Error(
        `Video analyzer initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 이미지 분석기 초기화 확인
   */
  private async ensureImageAnalyzer(): Promise<void> {
    try {
      this.imageAnalyzer = await getImageAnalyzer()
      console.log('🖼️ Image analyzer ready for video frame analysis')
    } catch (error) {
      console.warn(
        '⚠️ Image analyzer initialization failed:',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }

  /**
   * 비디오에서 키프레임 추출
   */
  private async extractKeyframes(
    videoPath: string,
    outputDir: string,
    frameCount: number = this.maxKeyframes
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const framePaths: string[] = []

      // 출력 디렉토리 생성
      fs.mkdir(outputDir, { recursive: true }).catch(() => {})

      console.log(
        `🎯 Extracting ${frameCount} keyframes from: ${path.basename(videoPath)}`
      )

      ffmpeg(videoPath)
        .on('start', () => {
          console.log('🎬 Starting keyframe extraction...')
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(
              `📊 Extraction progress: ${Math.round(progress.percent)}%`
            )
          }
        })
        .on('end', () => {
          console.log(
            `✅ Keyframe extraction completed: ${framePaths.length} frames`
          )
          resolve(framePaths)
        })
        .on('error', (error) => {
          console.error('❌ FFmpeg keyframe extraction error:', error)
          reject(error)
        })
        .output(path.join(outputDir, 'frame-%03d.jpg'))
        .outputOptions([
          '-vf',
          `select=eq(pict_type\\,I),scale=224:224`, // I-프레임만 선택하고 224x224로 리사이즈
          '-vsync',
          'vfr',
          '-frames:v',
          frameCount.toString(),
          '-q:v',
          '2', // 높은 품질
        ])
        .run()

      // 예상 프레임 경로 생성
      for (let i = 1; i <= frameCount; i++) {
        framePaths.push(
          path.join(outputDir, `frame-${i.toString().padStart(3, '0')}.jpg`)
        )
      }
    })
  }

  /**
   * 키프레임들을 AI로 분석 (병렬 처리)
   */
  private async analyzeKeyframes(framePaths: string[]): Promise<
    Array<{
      timestamp: number
      embedding: number[]
      confidence: number
    }>
  > {
    if (!this.imageAnalyzer) {
      throw new Error('Image analyzer is not initialized.')
    }

    const imageAnalyzer = this.imageAnalyzer // 지역 변수로 참조

    console.log(
      `🔍 Analyzing ${framePaths.length} keyframes with AI in parallel...`
    )

    // 병렬 처리 제한 (메모리 사용량 고려)
    const concurrency = Math.min(4, framePaths.length) // 최대 4개 동시 처리
    const results: Array<{
      timestamp: number
      embedding: number[]
      confidence: number
    }> = []

    // 프레임을 청크로 나누어 처리
    for (let i = 0; i < framePaths.length; i += concurrency) {
      const chunk = framePaths.slice(i, i + concurrency)

      const chunkPromises = chunk.map(async (framePath, chunkIndex) => {
        const globalIndex = i + chunkIndex

        try {
          // 파일이 존재하는지 확인
          await fs.access(framePath)

          console.log(
            `🖼️ Analyzing frame ${globalIndex + 1}/${
              framePaths.length
            }: ${path.basename(framePath)}`
          )

          const result = await imageAnalyzer.extractFeatures(framePath)

          const frameResult = {
            timestamp: globalIndex * 5, // 5초 간격으로 가정 (실제로는 비디오 길이에 따라 계산해야 함)
            embedding: result.embedding,
            confidence: result.confidence,
            index: globalIndex, // 정렬을 위한 인덱스
          }

          console.log(`✅ Frame ${globalIndex + 1} analyzed successfully`)
          return frameResult
        } catch (error) {
          console.warn(
            `⚠️ Failed to analyze frame ${framePath}:`,
            error instanceof Error ? error.message : String(error)
          )
          return null
        }
      })

      // 현재 청크의 모든 프레임을 병렬로 처리
      const chunkResults = await Promise.all(chunkPromises)

      // null이 아닌 결과만 추가
      chunkResults.forEach((result) => {
        if (result) {
          results.push(result as any)
        }
      })
    }

    // 인덱스 순서로 정렬하고 index 속성 제거
    return results
      .sort((a, b) => (a as any).index - (b as any).index)
      .map(({ timestamp, embedding, confidence }) => ({
        timestamp,
        embedding,
        confidence,
      }))
  }

  /**
   * 키프레임 임베딩들을 하나의 비디오 임베딩으로 집계
   */
  private aggregateFrameEmbeddings(
    frameResults: Array<{
      timestamp: number
      embedding: number[]
      confidence: number
    }>
  ): { embedding: number[]; confidence: number } {
    if (frameResults.length === 0) {
      throw new Error('No valid frame embeddings to aggregate')
    }

    const embeddingSize = frameResults[0].embedding.length
    const aggregatedEmbedding = new Array(embeddingSize).fill(0)
    let totalConfidence = 0

    // 가중 평균 계산 (confidence 기반)
    let totalWeight = 0

    for (const frame of frameResults) {
      const weight = frame.confidence
      totalWeight += weight
      totalConfidence += frame.confidence

      for (let i = 0; i < embeddingSize; i++) {
        aggregatedEmbedding[i] += frame.embedding[i] * weight
      }
    }

    // 정규화
    if (totalWeight > 0) {
      for (let i = 0; i < embeddingSize; i++) {
        aggregatedEmbedding[i] /= totalWeight
      }
    }

    return {
      embedding: aggregatedEmbedding,
      confidence: totalConfidence / frameResults.length,
    }
  }

  /**
   * 비디오 메타데이터 추출
   */
  private async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error)
          return
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video'
        )
        if (!videoStream) {
          reject(new Error('No video stream found'))
          return
        }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          frameRate: eval(videoStream.r_frame_rate || '0') || 0,
          size: metadata.format.size || 0,
          hash: '', // 별도로 계산해야 함
        })
      })
    })
  }

  /**
   * 비디오 파일 분석
   */
  async extractFeatures(videoPath: string): Promise<VideoAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error(
        'Video analyzer not initialized. Call initialize() first.'
      )
    }

    const startTime = Date.now()

    try {
      console.log(`🎬 Starting video analysis: ${path.basename(videoPath)}`)

      // 임시 디렉토리 생성
      const tempDir = path.join(
        process.cwd(),
        'temp',
        'video-frames',
        `${path.basename(videoPath, path.extname(videoPath))}-${Date.now()}`
      )

      // 키프레임 추출
      const framePaths = await this.extractKeyframes(
        videoPath,
        tempDir,
        this.maxKeyframes
      )

      // 각 키프레임 분석
      const frameResults = await this.analyzeKeyframes(framePaths)

      if (frameResults.length === 0) {
        throw new Error('No valid frames could be analyzed')
      }

      // 프레임 임베딩들을 비디오 임베딩으로 집계
      const { embedding, confidence } =
        this.aggregateFrameEmbeddings(frameResults)

      // 임시 파일들 정리
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
        console.log('🧹 Cleaned up temporary frame files')
      } catch (cleanupError) {
        console.warn(
          '⚠️ Failed to cleanup temporary files:',
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError)
        )
      }

      const processingTime = Date.now() - startTime

      console.log(
        `✅ Video analysis completed: ${path.basename(videoPath)} (${processingTime}ms)`
      )

      return {
        embedding,
        modelName: this.modelName,
        confidence,
        processingTime,
        frameCount: frameResults.length,
        keyframes: frameResults,
      }
    } catch (error) {
      console.error(`❌ Failed to analyze video ${videoPath}:`, error)
      throw error
    }
  }

  /**
   * 비디오 분석 후 캐시에 저장
   */
  async analyzeAndCache(
    videoPath: string,
    fileSize: number,
    fileHash: string
  ): Promise<AIEmbedding> {
    try {
      // 기존 캐시 확인
      const vectorCache = await getVectorCache()
      const embeddingId = this.generateEmbeddingId(videoPath, this.modelName)

      const existingEmbedding = await vectorCache.getEmbeddingByPath(
        videoPath,
        this.modelName
      )
      if (existingEmbedding) {
        console.log(
          `📋 Using cached video embedding for: ${path.basename(videoPath)}`
        )
        return existingEmbedding
      }

      // 새로 분석
      console.log(`🎬 Analyzing video: ${path.basename(videoPath)}`)
      const result = await this.extractFeatures(videoPath)

      // 비디오 메타데이터 수집
      const metadata = await this.getVideoMetadata(videoPath)
      metadata.hash = fileHash

      // AIEmbedding 객체 생성
      const embedding: AIEmbedding = {
        id: embeddingId,
        filePath: videoPath,
        fileType: 'video',
        modelName: result.modelName,
        embedding: result.embedding,
        extractedAt: new Date().toISOString(),
        metadata: {
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          size: metadata.size,
          hash: metadata.hash,
          // Video-specific metadata stored as additional properties
          frameRate: metadata.frameRate,
          frameCount: result.frameCount,
          processingTime: result.processingTime,
          confidence: result.confidence,
        } as any, // Type assertion to allow additional properties
      }

      // 벡터 캐시에 저장
      await vectorCache.saveEmbedding(embedding)

      console.log(`✅ Video embedding cached: ${path.basename(videoPath)}`)
      return embedding
    } catch (error) {
      console.error(`❌ Failed to analyze and cache video ${videoPath}:`, error)
      throw error
    }
  }

  /**
   * 유사한 비디오 검색
   */
  async findSimilarVideos(
    queryVideoPath: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<{ file: AIEmbedding; similarity: number }[]> {
    try {
      // 쿼리 비디오 분석
      const queryResult = await this.extractFeatures(queryVideoPath)

      // 벡터 캐시에서 유사한 비디오 검색
      const vectorCache = await getVectorCache()
      const results = await vectorCache.findSimilar(
        queryResult.embedding,
        'video',
        limit,
        threshold
      )

      return results.map((result) => ({
        file: result.file,
        similarity: result.similarity,
      }))
    } catch (error) {
      console.error(
        `Failed to find similar videos for ${queryVideoPath}:`,
        error
      )
      throw error
    }
  }

  /**
   * 배치 비디오 분석 (병렬 처리)
   */
  async analyzeBatch(
    videoPaths: string[],
    progressCallback?: (
      completed: number,
      total: number,
      currentFile: string
    ) => void,
    maxConcurrency: number = 2 // 기본적으로 2개 비디오를 동시에 처리
  ): Promise<AIEmbedding[]> {
    const results: AIEmbedding[] = []
    const total = videoPaths.length
    let completed = 0

    console.log(
      `🚀 Starting batch video analysis of ${total} videos with concurrency ${maxConcurrency}...`
    )

    const processVideo = async (
      videoPath: string,
      index: number
    ): Promise<AIEmbedding | null> => {
      try {
        if (progressCallback) {
          progressCallback(completed, total, videoPath)
        }

        console.log(`🎬 Starting analysis: ${path.basename(videoPath)}`)

        // 파일 정보 수집
        const stats = await fs.stat(videoPath)
        const fileBuffer = await fs.readFile(videoPath)
        const fileHash = createHash('md5').update(fileBuffer).digest('hex')

        // 분석 및 캐시
        const embedding = await this.analyzeAndCache(
          videoPath,
          stats.size,
          fileHash
        )

        completed++

        console.log(
          `✅ Processed ${completed}/${total}: ${path.basename(videoPath)}`
        )

        if (progressCallback) {
          progressCallback(completed, total, videoPath)
        }

        return embedding
      } catch (error) {
        console.error(`❌ Failed to process ${videoPath}:`, error)
        completed++

        if (progressCallback) {
          progressCallback(
            completed,
            total,
            `Failed: ${path.basename(videoPath)}`
          )
        }

        return null
      }
    }

    // 비디오들을 청크로 나누어 병렬 처리
    for (let i = 0; i < videoPaths.length; i += maxConcurrency) {
      const chunk = videoPaths.slice(i, i + maxConcurrency)

      // 현재 청크의 모든 비디오를 병렬로 처리
      const chunkPromises = chunk.map((videoPath, chunkIndex) =>
        processVideo(videoPath, i + chunkIndex)
      )

      const chunkResults = await Promise.all(chunkPromises)

      // null이 아닌 결과만 results에 추가
      chunkResults.forEach((result) => {
        if (result) {
          results.push(result)
        }
      })
    }

    if (progressCallback) {
      progressCallback(total, total, 'Completed')
    }

    console.log(
      `🏁 Batch video analysis completed: ${results.length}/${total} videos processed`
    )
    return results
  }

  /**
   * 고급 배치 비디오 분석 (동적 동시 처리 조정)
   */
  async analyzeBatchAdvanced(
    videoPaths: string[],
    progressCallback?: (
      completed: number,
      total: number,
      currentFile: string,
      stats?: { concurrency: number; memoryUsage: number }
    ) => void
  ): Promise<AIEmbedding[]> {
    const results: AIEmbedding[] = []
    const total = videoPaths.length
    let completed = 0

    console.log(
      `🚀 Starting advanced batch video analysis of ${total} videos...`
    )

    const processVideo = async (
      videoPath: string
    ): Promise<AIEmbedding | null> => {
      // 동시 처리 슬롯 획득
      await this.concurrencyManager.acquireSlot()

      try {
        const stats = this.concurrencyManager.getStats()
        if (progressCallback) {
          progressCallback(completed, total, videoPath, {
            concurrency: stats.concurrency,
            memoryUsage: stats.memoryUsage,
          })
        }

        console.log(
          `🎬 Starting analysis [${stats.concurrency}/${stats.maxConcurrency}]: ${path.basename(videoPath)}`
        )

        // 파일 정보 수집
        const fileStats = await fs.stat(videoPath)
        const fileBuffer = await fs.readFile(videoPath)
        const fileHash = createHash('md5').update(fileBuffer).digest('hex')

        // 분석 및 캐시
        const embedding = await this.analyzeAndCache(
          videoPath,
          fileStats.size,
          fileHash
        )

        completed++
        const currentStats = this.concurrencyManager.getStats()

        console.log(
          `✅ Processed ${completed}/${total} [Mem: ${currentStats.memoryUsage.toFixed(1)}%]: ${path.basename(videoPath)}`
        )

        if (progressCallback) {
          progressCallback(completed, total, videoPath, {
            concurrency: currentStats.concurrency,
            memoryUsage: currentStats.memoryUsage,
          })
        }

        return embedding
      } catch (error) {
        console.error(`❌ Failed to process ${videoPath}:`, error)
        completed++

        if (progressCallback) {
          const stats = this.concurrencyManager.getStats()
          progressCallback(
            completed,
            total,
            `Failed: ${path.basename(videoPath)}`,
            {
              concurrency: stats.concurrency,
              memoryUsage: stats.memoryUsage,
            }
          )
        }

        return null
      } finally {
        // 슬롯 해제
        this.concurrencyManager.releaseSlot()
      }
    }

    // 모든 비디오를 병렬로 처리 (ConcurrencyManager가 동시 처리 수를 제어)
    const allPromises = videoPaths.map((videoPath) => processVideo(videoPath))
    const allResults = await Promise.all(allPromises)

    // null이 아닌 결과만 results에 추가
    allResults.forEach((result) => {
      if (result) {
        results.push(result)
      }
    })

    const finalStats = this.concurrencyManager.getStats()
    if (progressCallback) {
      progressCallback(total, total, 'Completed', {
        concurrency: 0,
        memoryUsage: finalStats.memoryUsage,
      })
    }

    console.log(
      `🏁 Advanced batch video analysis completed: ${results.length}/${total} videos processed`
    )
    return results
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(): {
    concurrency: number
    maxConcurrency: number
    memoryUsage: number
  } {
    return this.concurrencyManager.getStats()
  }

  /**
   * 동시 처리 수 조정
   */
  setConcurrency(maxConcurrency: number): void {
    this.concurrencyManager.setMaxConcurrency(maxConcurrency)
  }

  /**
   * 임베딩 ID 생성
   */
  private generateEmbeddingId(filePath: string, modelName: string): string {
    const content = `${filePath}:${modelName}`
    return createHash('md5').update(content).digest('hex')
  }

  /**
   * 모델 정보 조회
   */
  getModelInfo(): { name: string; isInitialized: boolean } {
    return {
      name: this.modelName,
      isInitialized: this.isInitialized,
    }
  }

  /**
   * 메모리 정리
   */
  dispose(): void {
    this.isInitialized = false
  }
}

// 전역 AI 비디오 분석기 인스턴스 (싱글톤 패턴)
let globalVideoAnalyzer: AIVideoAnalyzer | null = null

export async function getVideoAnalyzer(): Promise<AIVideoAnalyzer> {
  if (!globalVideoAnalyzer) {
    globalVideoAnalyzer = new AIVideoAnalyzer()
    await globalVideoAnalyzer.initialize()
  }
  return globalVideoAnalyzer
}
