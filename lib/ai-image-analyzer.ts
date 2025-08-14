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
  private isInitializing = false

  /**
   * 모델 초기화
   */
  async initialize(): Promise<void> {
    // 이미 초기화되었거나 초기화 중인 경우
    if (this.isInitialized) return
    if (this.isInitializing) {
      // 초기화가 진행 중이면 완료될 때까지 대기
      while (this.isInitializing && !this.isInitialized) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return
    }

    this.isInitializing = true

    try {
      console.log('🤖 Loading TensorFlow.js MobileNet model...')

      // 기존 모델이 있다면 정리
      if (this.model) {
        console.log('🧹 Disposing existing model...')
        this.model.dispose()
        this.model = null
      }

      // TensorFlow.js 메모리 정리 및 백엔드 준비
      tf.disposeVariables()
      await tf.ready()

      console.log(`🔧 TensorFlow.js backend: ${tf.getBackend()}`)
      console.log(`📊 Memory info: ${JSON.stringify(tf.memory())}`)

      // MobileNet v1 모델 로딩 (안정적인 URL)
      console.log('📥 Downloading MobileNet model...')

      // 여러 안정적인 모델 URL 시도
      const modelUrls = [
        'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json',
        'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@1.0.0/dist/model.json',
      ]

      let modelLoaded = false
      for (const modelUrl of modelUrls) {
        try {
          console.log(`📥 Trying model URL: ${modelUrl}`)

          // 모델 로딩 (메모리 관리 개선)
          this.model = await tf.loadLayersModel(modelUrl)

          modelLoaded = true
          console.log(`✅ Model loaded successfully from: ${modelUrl}`)
          break
        } catch (error) {
          console.warn(
            `⚠️ Failed to load model from ${modelUrl}:`,
            (error as Error).message
          )
        }
      }

      if (!modelLoaded) {
        throw new Error(
          'Failed to load MobileNet model from all available URLs'
        )
      }

      console.log('✅ MobileNet model loaded successfully')
      console.log(`📊 Model input shape: ${this.model?.inputs[0].shape}`)
      console.log(`📊 Updated memory info: ${JSON.stringify(tf.memory())}`)

      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to load AI model:', error)
      console.error('Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        backend: tf.getBackend(),
        tfVersion: tf.version.tfjs,
        memoryInfo: tf.memory(),
      })

      this.isInitialized = false
      throw new Error(
        `AI model initialization failed: ${(error as Error).message}`
      )
    } finally {
      this.isInitializing = false
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

      // 텐서 shape 로깅 (디버깅용)
      console.log(
        `📊 Prediction tensor shape: [${prediction.shape.join(', ')}]`
      )
      console.log(`📊 Prediction tensor rank: ${prediction.rank}`)

      let features: tf.Tensor

      // 텐서 차원에 따라 적절한 처리 방법 선택
      if (prediction.rank === 4) {
        // 4차원 텐서 [batch, height, width, channels]의 경우
        console.log('🔧 Processing 4D tensor with Global Average Pooling...')
        features = tf.mean(prediction, [1, 2]) // [batch, height, width, channels] -> [batch, channels]
      } else if (prediction.rank === 2) {
        // 2차원 텐서 [batch, features]의 경우 (이미 flatten된 상태)
        console.log('🔧 Processing 2D tensor (already flattened)...')
        features = prediction
      } else if (prediction.rank === 3) {
        // 3차원 텐서 [batch, 1, channels] 또는 [batch, height, channels]의 경우
        console.log('🔧 Processing 3D tensor...')
        // 마지막 차원만 남기고 평균화
        features = tf.mean(prediction, [1])
      } else {
        throw new Error(
          `Unsupported tensor rank: ${prediction.rank}. Expected 2, 3, or 4 dimensions.`
        )
      }

      // 배치 차원 제거 (단일 이미지 처리)
      const squeezed = features.squeeze([0])

      // 텐서를 JavaScript 배열로 변환
      const featuresArray = await squeezed.data()
      const featuresVector = Array.from(featuresArray)

      console.log(`✅ Features extracted: ${featuresVector.length} dimensions`)

      // 메모리 정리
      prediction.dispose()
      if (features !== prediction) {
        features.dispose()
      }
      squeezed.dispose()

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
    this.isInitializing = false
  }
}

// 전역 AI 이미지 분석기 인스턴스 (싱글톤 패턴)
let globalImageAnalyzer: AIImageAnalyzer | null = null
let initializationPromise: Promise<AIImageAnalyzer> | null = null

export async function getImageAnalyzer(): Promise<AIImageAnalyzer> {
  // 이미 인스턴스가 있고 초기화되었다면 반환
  if (globalImageAnalyzer?.getModelInfo().isInitialized) {
    return globalImageAnalyzer
  }

  // 초기화가 진행 중이라면 기다림
  if (initializationPromise) {
    return await initializationPromise
  }

  // 새로운 초기화 시작
  initializationPromise = (async () => {
    try {
      // 기존 인스턴스가 있다면 정리
      if (globalImageAnalyzer) {
        globalImageAnalyzer.dispose()
      }

      console.log('🔄 Creating new AI Image Analyzer instance...')
      globalImageAnalyzer = new AIImageAnalyzer()
      await globalImageAnalyzer.initialize()

      console.log('✅ AI Image Analyzer ready for use')
      return globalImageAnalyzer
    } catch (error) {
      // 초기화 실패시 정리
      globalImageAnalyzer = null
      initializationPromise = null
      throw error
    }
  })()

  try {
    const analyzer = await initializationPromise
    initializationPromise = null
    return analyzer
  } catch (error) {
    initializationPromise = null
    throw error
  }
}
