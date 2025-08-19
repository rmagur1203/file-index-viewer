import { Database } from "bun:sqlite";
import { getLikeCache, LikeCache } from "./like-cache";
import {
  getVectorCache,
  AIEmbedding,
  SimilarityResult,
  VectorCache,
} from "./vector-cache";
import { VIDEO_ROOT } from "./config";
import { safePath } from "./sudo-fs";
import path from "path";

export interface RecommendationResult {
  file: AIEmbedding;
  score: number;
  reason: string;
}

export interface RecommendationOptions {
  limit?: number;
  minSimilarity?: number;
  diversityFactor?: number;
  fileTypes?: ("image" | "video" | "text")[];
}

export class RecommendationEngine {
  private vectorCache: VectorCache = null as any;
  private likeCache: LikeCache = null as any;

  constructor() {}

  async initialize(): Promise<void> {
    this.vectorCache = await getVectorCache();
    this.likeCache = await getLikeCache();
  }

  /**
   * 좋아요한 파일들을 기반으로 추천 파일들을 생성
   */
  async generateRecommendations(
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const {
      limit = 20,
      minSimilarity = 0.3,
      diversityFactor = 0.7,
      fileTypes = ["image", "video"],
    } = options;

    // 1. 좋아요한 파일 목록 가져오기
    const likedFiles = await this.likeCache.getAllLikes();
    if (likedFiles.length === 0) {
      return [];
    }

    const absolutePaths = likedFiles.map((filePath) =>
      safePath(VIDEO_ROOT, filePath)
    );

    // 2. 좋아요한 파일들의 임베딩 가져오기
    const likedEmbeddings = await this.getLikedEmbeddings(
      absolutePaths,
      fileTypes
    );
    if (likedEmbeddings.length === 0) {
      return [];
    }

    // 3. 선호 벡터 계산 (가중 평균)
    const preferenceVector = this.calculatePreferenceVector(likedEmbeddings);

    // 4. 유사한 파일들 검색
    const candidates = await this.findSimilarFiles(
      preferenceVector,
      likedFiles,
      fileTypes,
      limit * 3 // 다양성을 위해 더 많이 가져온 후 필터링
    );

    // 5. 다양성 필터링 및 최종 추천 생성
    const recommendations = this.applyDiversityFilter(
      candidates,
      limit,
      diversityFactor,
      minSimilarity,
      likedEmbeddings
    );

    return recommendations;
  }

  /**
   * 좋아요한 파일들의 임베딩 정보 가져오기
   */
  private async getLikedEmbeddings(
    likedFiles: string[],
    fileTypes: string[]
  ): Promise<AIEmbedding[]> {
    const embeddings: AIEmbedding[] = [];

    for (const filePath of likedFiles) {
      try {
        const embedding = await this.vectorCache.getEmbedding(filePath);
        if (embedding && fileTypes.includes(embedding.fileType)) {
          embeddings.push(embedding);
        }
      } catch (error) {
        console.warn(`Failed to get embedding for ${filePath}:`, error);
      }
    }

    return embeddings;
  }

  /**
   * 좋아요한 파일들의 임베딩을 바탕으로 선호 벡터 계산
   */
  private calculatePreferenceVector(embeddings: AIEmbedding[]): number[] {
    if (embeddings.length === 0) return [];

    const firstEmbedding = embeddings[0];
    if (!firstEmbedding) return [];

    const embeddingDim = firstEmbedding.embedding.length;
    const preferenceVector = new Array(embeddingDim).fill(0);

    // 최근 좋아요한 파일에 더 높은 가중치 부여
    const totalWeight = embeddings.length;

    embeddings.forEach((embedding, index) => {
      const weight = (index + 1) / totalWeight; // 최근 파일일수록 높은 가중치

      embedding.embedding.forEach((value, dim) => {
        preferenceVector[dim] += value * weight;
      });
    });

    // 정규화
    const magnitude = Math.sqrt(
      preferenceVector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude > 0) {
      return preferenceVector.map((val) => val / magnitude);
    }

    return preferenceVector;
  }

  /**
   * 선호 벡터와 유사한 파일들 찾기
   */
  private async findSimilarFiles(
    preferenceVector: number[],
    likedFiles: string[],
    fileTypes: string[],
    limit: number
  ): Promise<SimilarityResult[]> {
    const results: SimilarityResult[] = [];

    try {
      // 각 파일 타입별로 검색
      for (const fileType of fileTypes) {
        const similarFiles =
          (await this.vectorCache?.findSimilarByVector(
            preferenceVector,
            fileType as "image" | "video" | "text",
            Math.ceil(limit / fileTypes.length)
          )) || [];

        // 이미 좋아요한 파일들 제외
        const filteredFiles = similarFiles.filter(
          (result: SimilarityResult) =>
            !likedFiles.includes(result.file.filePath)
        );

        results.push(...filteredFiles);
      }
    } catch (error) {
      console.error("Error finding similar files:", error);
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 다양성 필터 적용하여 최종 추천 목록 생성
   */
  private applyDiversityFilter(
    candidates: SimilarityResult[],
    limit: number,
    diversityFactor: number,
    minSimilarity: number,
    likedEmbeddings: AIEmbedding[]
  ): RecommendationResult[] {
    const recommendations: RecommendationResult[] = [];
    const usedPaths = new Set<string>();
    const typeDistribution: Map<string, number> = new Map();

    // 파일 타입별 최대 추천 수 계산
    const maxPerType = Math.ceil(limit / 2); // 이미지와 비디오 균형

    for (const candidate of candidates) {
      if (recommendations.length >= limit) break;
      if (candidate.similarity < minSimilarity) break;
      if (usedPaths.has(candidate.file.filePath)) continue;

      const fileType = candidate.file.fileType;
      const currentTypeCount = typeDistribution.get(fileType) || 0;

      if (currentTypeCount >= maxPerType) continue;

      // 다양성 점수 계산 (이미 추천된 파일들과의 유사도 확인)
      const diversityScore = this.calculateDiversityScore(
        candidate.file,
        recommendations.map((r) => r.file),
        diversityFactor
      );

      // 선호도 점수 계산
      const preferenceScore = this.calculatePreferenceScore(
        candidate.file,
        likedEmbeddings
      );

      // 최종 점수 = 유사도 * 다양성 점수 * 선호도 점수
      const finalScore =
        candidate.similarity * diversityScore * preferenceScore;

      // 파일 경로를 상대 경로로 변환 (VIDEO_ROOT 제거)
      let relativePath = candidate.file.filePath;
      if (relativePath.startsWith(VIDEO_ROOT)) {
        relativePath = relativePath.substring(VIDEO_ROOT.length);
        // 앞에 / 가 없으면 추가
        if (!relativePath.startsWith("/")) {
          relativePath = "/" + relativePath;
        }
      }

      const relativeFile: AIEmbedding = {
        ...candidate.file,
        filePath: relativePath,
      };

      recommendations.push({
        file: relativeFile,
        score: finalScore,
        reason: this.generateRecommendationReason(candidate, preferenceScore),
      });

      usedPaths.add(candidate.file.filePath);
      typeDistribution.set(fileType, currentTypeCount + 1);
    }

    // 최종 점수로 정렬
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * 다양성 점수 계산 (이미 추천된 파일들과 너무 비슷하지 않도록)
   */
  private calculateDiversityScore(
    candidate: AIEmbedding,
    existingRecommendations: AIEmbedding[],
    diversityFactor: number
  ): number {
    if (existingRecommendations.length === 0) return 1.0;

    let maxSimilarity = 0;

    for (const existing of existingRecommendations) {
      const similarity = this.calculateCosineSimilarity(
        candidate.embedding,
        existing.embedding
      );
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // 기존 추천과 유사할수록 점수 감소
    return Math.max(0.1, 1.0 - maxSimilarity * diversityFactor);
  }

  /**
   * 선호도 점수 계산 (좋아요한 파일들과의 평균 유사도)
   */
  private calculatePreferenceScore(
    candidate: AIEmbedding,
    likedEmbeddings: AIEmbedding[]
  ): number {
    if (likedEmbeddings.length === 0) return 1.0;

    const similarities = likedEmbeddings.map((liked) =>
      this.calculateCosineSimilarity(candidate.embedding, liked.embedding)
    );

    return (
      similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
    );
  }

  /**
   * 코사인 유사도 계산
   */
  private calculateCosineSimilarity(
    vectorA: number[],
    vectorB: number[]
  ): number {
    if (vectorA.length !== vectorB.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      const valueA = vectorA[i] ?? 0;
      const valueB = vectorB[i] ?? 0;
      dotProduct += valueA * valueB;
      magnitudeA += valueA * valueA;
      magnitudeB += valueB * valueB;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * 추천 이유 생성
   */
  private generateRecommendationReason(
    candidate: SimilarityResult,
    preferenceScore: number
  ): string {
    if (candidate.similarity > 0.8) {
      return "당신이 좋아하는 스타일과 매우 유사합니다";
    } else if (candidate.similarity > 0.6) {
      return "당신의 취향과 잘 맞을 것 같습니다";
    } else if (preferenceScore > 0.7) {
      return "당신이 선호하는 특징을 가지고 있습니다";
    } else {
      return "새로운 스타일을 발견해보세요";
    }
  }

  /**
   * 파일 타입별 추천 통계 가져오기
   */
  async getRecommendationStats(): Promise<{
    totalLikedFiles: number;
    likedByType: Record<string, number>;
    availableForRecommendation: Record<string, number>;
  }> {
    const likedFiles = await this.likeCache.getAllLikes();
    const likedEmbeddings = await this.getLikedEmbeddings(likedFiles, [
      "image",
      "video",
      "text",
    ]);

    const likedByType: Record<string, number> = {};
    likedEmbeddings.forEach((embedding) => {
      likedByType[embedding.fileType] =
        (likedByType[embedding.fileType] || 0) + 1;
    });

    const availableForRecommendation =
      (await this.vectorCache?.getEmbeddingCounts()) || {};

    return {
      totalLikedFiles: likedFiles.length,
      likedByType,
      availableForRecommendation,
    };
  }
}

let globalRecommendationEngine: RecommendationEngine | null = null;

export async function getRecommendationEngine(): Promise<RecommendationEngine> {
  if (!globalRecommendationEngine) {
    globalRecommendationEngine = new RecommendationEngine();
    await globalRecommendationEngine.initialize();
  }
  return globalRecommendationEngine;
}
