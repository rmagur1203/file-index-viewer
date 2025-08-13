import * as tf from '@tensorflow/tfjs-node'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import { createHash } from 'crypto'
import { getVectorCache, AIEmbedding } from './vector-cache'

export interface ImageAnalysisResult {
  embedding: number[]
  modelName: string
  confidence: number
  processingTime: number
}

export class AIImageAnalyzer {
  private model: tf.LayersModel | null = null
  private modelName = 'mobilenet_v2'
  private isInitialized = false

  /**
   * 모델 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🤖 Loading TensorFlow.js MobileNet model...')

      // MobileNetV2 모델 로딩 (사전 훈련된 모델)
      this.model = await tf.loadLayersModel(
        'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v2_1.0_224/model.json'
      )

      console.log('✅ MobileNet model loaded successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to load AI model:', error)
      throw new Error('AI model initialization failed')
    }
  }

  /**
   * 이미지에서 특징 벡터 추출
   */
  async extractFeatures(imagePath: string): Promise<ImageAnalysisResult> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.')
    }

    const startTime = Date.now()

    try {
      // 이미지 전처리
      const processedImage = await this.preprocessImage(imagePath)

      // 특징 추출 (마지막 레이어 전 단계에서)
      const features = await this.extractImageFeatures(processedImage)

      // 메모리 정리
      processedImage.dispose()

      const processingTime = Date.now() - startTime

      console.log(
        `🎨 Image features extracted: ${imagePath} (${processingTime}ms)`
      )

      return {
        embedding: features,
        modelName: this.modelName,
        confidence: 1.0, // MobileNet은 confidence 점수를 직접 제공하지 않음
        processingTime,
      }
    } catch (error) {
      console.error(`❌ Failed to extract features from ${imagePath}:`, error)
      throw error
    }
  }

  /**
   * 이미지 전처리 (MobileNet 입력 형식에 맞게)
   */
  private async preprocessImage(imagePath: string): Promise<tf.Tensor4D> {
    try {
      // Sharp를 사용해서 이미지 읽기 및 리사이즈
      const imageBuffer = await sharp(imagePath)
        .resize(224, 224) // MobileNet 입력 크기
        .removeAlpha() // 알파 채널 제거
        .raw()
        .toBuffer()

      // Buffer를 Tensor로 변환
      const tensor = tf.tensor3d(
        new Uint8Array(imageBuffer),
        [224, 224, 3],
        'int32'
      )

      // 정규화 (0-255 -> 0-1) 및 배치 차원 추가
      const normalized = tensor.cast('float32').div(255.0)
      const batched = normalized.expandDims(0) as tf.Tensor4D

      // 메모리 정리
      tensor.dispose()
      normalized.dispose()

      return batched
    } catch (error) {
      console.error(`Failed to preprocess image ${imagePath}:`, error)
      throw error
    }
  }

  /**
   * MobileNet에서 특징 벡터 추출
   */
  private async extractImageFeatures(
    imageTensor: tf.Tensor4D
  ): Promise<number[]> {
    if (!this.model) throw new Error('Model not initialized')

    try {
      // MobileNet 예측 실행
      const prediction = this.model.predict(imageTensor) as tf.Tensor

      // Global Average Pooling (특징 벡터로 변환)
      const features = tf.mean(prediction, [1, 2]) // [batch, height, width, channels] -> [batch, channels]

      // 텐서를 JavaScript 배열로 변환
      const featuresArray = await features.data()
      const featuresVector = Array.from(featuresArray)

      // 메모리 정리
      prediction.dispose()
      features.dispose()

      return featuresVector
    } catch (error) {
      console.error('Failed to extract features from tensor:', error)
      throw error
    }
  }

  /**
   * 이미지 파일 분석 후 벡터 캐시에 저장
   */
  async analyzeAndCache(
    imagePath: string,
    fileSize: number,
    fileHash: string
  ): Promise<AIEmbedding> {
    try {
      // 기존 캐시 확인
      const vectorCache = await getVectorCache()
      const embeddingId = this.generateEmbeddingId(imagePath, this.modelName)

      const existingEmbedding = await vectorCache.getEmbeddingByPath(
        imagePath,
        this.modelName
      )
      if (existingEmbedding) {
        console.log(`📋 Using cached embedding for: ${imagePath}`)
        return existingEmbedding
      }

      // 새로 분석
      console.log(`🔍 Analyzing image: ${imagePath}`)
      const result = await this.extractFeatures(imagePath)

      // 이미지 메타데이터 수집
      const metadata = await this.getImageMetadata(
        imagePath,
        fileSize,
        fileHash
      )

      // AIEmbedding 객체 생성
      const embedding: AIEmbedding = {
        id: embeddingId,
        filePath: imagePath,
        fileType: 'image',
        modelName: result.modelName,
        embedding: result.embedding,
        extractedAt: new Date().toISOString(),
        metadata,
      }

      // 벡터 캐시에 저장
      await vectorCache.saveEmbedding(embedding)

      console.log(`✅ Image embedding cached: ${imagePath}`)
      return embedding
    } catch (error) {
      console.error(`❌ Failed to analyze and cache image ${imagePath}:`, error)
      throw error
    }
  }

  /**
   * 이미지 메타데이터 수집
   */
  private async getImageMetadata(
    imagePath: string,
    fileSize: number,
    fileHash: string
  ) {
    try {
      const metadata = await sharp(imagePath).metadata()
      return {
        width: metadata.width,
        height: metadata.height,
        size: fileSize,
        hash: fileHash,
      }
    } catch (error) {
      console.warn(`Failed to get image metadata for ${imagePath}:`, error)
      return {
        size: fileSize,
        hash: fileHash,
      }
    }
  }

  /**
   * 임베딩 ID 생성 (파일 경로 + 모델명 기반)
   */
  private generateEmbeddingId(filePath: string, modelName: string): string {
    const content = `${filePath}:${modelName}`
    return createHash('md5').update(content).digest('hex')
  }

  /**
   * 유사한 이미지 검색
   */
  async findSimilarImages(
    queryImagePath: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<{ file: AIEmbedding; similarity: number }[]> {
    try {
      // 쿼리 이미지 분석
      const queryResult = await this.extractFeatures(queryImagePath)

      // 벡터 캐시에서 유사한 이미지 검색
      const vectorCache = await getVectorCache()
      const results = await vectorCache.findSimilar(
        queryResult.embedding,
        'image',
        limit,
        threshold
      )

      return results.map((result) => ({
        file: result.file,
        similarity: result.similarity,
      }))
    } catch (error) {
      console.error(
        `Failed to find similar images for ${queryImagePath}:`,
        error
      )
      throw error
    }
  }

  /**
   * 배치 이미지 분석
   */
  async analyzeBatch(
    imagePaths: string[],
    progressCallback?: (
      completed: number,
      total: number,
      currentFile: string
    ) => void
  ): Promise<AIEmbedding[]> {
    const results: AIEmbedding[] = []
    const total = imagePaths.length

    console.log(`🚀 Starting batch analysis of ${total} images...`)

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i]

      try {
        if (progressCallback) {
          progressCallback(i, total, imagePath)
        }

        // 파일 정보 수집
        const stats = await fs.stat(imagePath)
        const fileBuffer = await fs.readFile(imagePath)
        const fileHash = createHash('md5').update(fileBuffer).digest('hex')

        // 분석 및 캐시
        const embedding = await this.analyzeAndCache(
          imagePath,
          stats.size,
          fileHash
        )
        results.push(embedding)

        console.log(`✅ Processed ${i + 1}/${total}: ${imagePath}`)
      } catch (error) {
        console.error(`❌ Failed to process ${imagePath}:`, error)
        // 실패한 파일은 건너뛰고 계속 진행
      }
    }

    if (progressCallback) {
      progressCallback(total, total, 'Completed')
    }

    console.log(
      `🏁 Batch analysis completed: ${results.length}/${total} images processed`
    )
    return results
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
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
    this.isInitialized = false
  }
}

// 전역 AI 이미지 분석기 인스턴스 (싱글톤 패턴)
let globalImageAnalyzer: AIImageAnalyzer | null = null

export async function getImageAnalyzer(): Promise<AIImageAnalyzer> {
  if (!globalImageAnalyzer) {
    globalImageAnalyzer = new AIImageAnalyzer()
    await globalImageAnalyzer.initialize()
  }
  return globalImageAnalyzer
}
