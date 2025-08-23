import { Hono } from "hono";
import { getImageAnalyzer } from "../lib/ai-image-analyzer";
import { getVideoAnalyzer } from "../lib/ai-video-analyzer";
import { getTextAnalyzer } from "../lib/ai-text-analyzer";
import { getVectorCache } from "../lib/vector-cache";
import { getLikeCache } from "../lib/like-cache";
import { isImage, isVideo, isText } from "../lib/utils";
import { promises as fs } from "fs";
import { scanMediaFiles } from "../lib/duplicate-detector";
import path from "path";

const aiRecommendations = new Hono();
const mediaRoot = process.env.VIDEO_ROOT || "";

// GET /api/ai-recommendations - AI 추천 조회
aiRecommendations.get("/", async (c) => {
  try {
    const filePath = c.req.query("filePath");
    const fileType = c.req.query("fileType") as
      | "image"
      | "video"
      | "text"
      | undefined;
    const limit = parseInt(c.req.query("limit") || "10");
    const threshold = parseFloat(c.req.query("threshold") || "0.7");

    if (!filePath) {
      return c.json({ error: "filePath parameter is required" }, 400);
    }

    // 웹 경로를 실제 파일 시스템 경로로 변환
    const fullPath = path.join(
      mediaRoot,
      filePath.startsWith("/") ? filePath.substring(1) : filePath
    );

    // 실제 파일 타입 감지
    const actualIsImage = isImage(filePath);
    const actualIsVideo = isVideo(filePath);
    const actualIsText = isText(filePath);

    // 텍스트 파일에 대한 크로스 미디어 요청은 지원하지 않음
    if (
      actualIsText &&
      fileType &&
      (fileType === "image" || fileType === "video")
    ) {
      return c.json(
        {
          error: "지원되지 않는 요청입니다",
          message:
            "텍스트 파일에 대해서는 이미지나 비디오 분석을 수행할 수 없습니다.",
          actualFileType: "text",
        },
        400
      );
    }

    // 텍스트가 아닌 파일에 대해 텍스트 분석 요청 시 거부
    if (!actualIsText && fileType === "text") {
      return c.json(
        {
          error: "지원되지 않는 요청입니다",
          message:
            "이미지나 비디오 파일에 대해서는 텍스트 분석을 수행할 수 없습니다.",
          actualFileType: actualIsImage
            ? "image"
            : actualIsVideo
              ? "video"
              : "unknown",
        },
        400
      );
    }

    // 파일 타입별 추천 처리 (크로스 미디어 검색 지원)
    if (fileType === "image") {
      if (actualIsImage) {
        // 이미지 파일에서 이미지 검색 (기본)
        return await handleImageRecommendations(
          fullPath,
          limit,
          threshold,
          "image"
        );
      } else if (actualIsVideo) {
        // 비디오 파일에서 이미지 검색 (크로스 미디어)
        return await handleCrossMediaRecommendations(
          fullPath,
          limit,
          threshold,
          "video",
          "image"
        );
      }
    } else if (fileType === "video") {
      if (actualIsVideo) {
        // 비디오 파일에서 비디오 검색 (기본)
        return await handleVideoRecommendations(
          fullPath,
          limit,
          threshold,
          "video"
        );
      } else if (actualIsImage) {
        // 이미지 파일에서 비디오 검색 (크로스 미디어)
        return await handleCrossMediaRecommendations(
          fullPath,
          limit,
          threshold,
          "image",
          "video"
        );
      }
    } else if (fileType === "text" || (!fileType && actualIsText)) {
      // 텍스트 분석 (크로스 미디어 없음)
      return await handleTextRecommendations(fullPath, limit, threshold);
    } else if (!fileType) {
      // 자동 감지 (기본 동작)
      if (actualIsImage) {
        return await handleImageRecommendations(
          fullPath,
          limit,
          threshold,
          "image"
        );
      } else if (actualIsVideo) {
        return await handleVideoRecommendations(
          fullPath,
          limit,
          threshold,
          "video"
        );
      }
    }

    return c.json(
      { error: "Unsupported file type or request combination" },
      400
    );
  } catch (error) {
    console.error("AI recommendations error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

async function handleImageRecommendations(
  filePath: string,
  limit: number,
  threshold: number,
  searchFileType: "image" | "video" = "image"
) {
  try {
    const imageAnalyzer = await getImageAnalyzer();

    // 벡터 캐시에서 먼저 기존 임베딩 확인
    const vectorCache = await getVectorCache();
    let queryEmbedding: number[];

    const existingEmbedding = await vectorCache.getEmbeddingByPath(
      filePath,
      imageAnalyzer.getModelInfo().name
    );

    if (existingEmbedding) {
      console.log(`📋 Using cached embedding for query: ${filePath}`);
      queryEmbedding = existingEmbedding.embedding;
    } else {
      console.log(`🔍 Analyzing query image: ${filePath}`);
      const queryResult = await imageAnalyzer.extractFeatures(filePath);
      queryEmbedding = queryResult.embedding;
    }

    // 유사한 파일 검색 (지정된 타입에서)
    const similarFiles = await vectorCache.findSimilar(
      queryEmbedding,
      searchFileType,
      limit * 2, // 좋아요한 파일 제외를 위해 더 많이 가져옴
      threshold
    );

    // 좋아요한 파일들 가져오기
    const likeCache = await getLikeCache();
    const likedFiles = await likeCache.getAllLikes();
    const likedFilesSet = new Set(likedFiles);

    // 좋아요한 파일들과 쿼리 파일 자체 제외
    const filteredFiles = similarFiles
      .filter((result) => {
        const relativePath = result.file.filePath.replace(mediaRoot, "");
        const queryRelativePath = filePath.replace(mediaRoot, "");
        return (
          !likedFilesSet.has(relativePath) && relativePath !== queryRelativePath
        );
      })
      .slice(0, limit); // 원하는 개수만큼만 선택

    const recommendations = filteredFiles.map((result) => ({
      file: {
        filePath: result.file.filePath.replace(mediaRoot, ""), // 상대 경로로 변환
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
      similarity: result.similarity,
      reason:
        searchFileType === "image"
          ? "AI 시각적 특징 유사성"
          : "AI 크로스 미디어 유사성",
      modelUsed: result.file.modelName,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        queryFile: filePath.replace(mediaRoot, ""), // 상대 경로로 변환
        recommendations,
        total: recommendations.length,
        parameters: {
          limit,
          threshold,
          model: imageAnalyzer.getModelInfo().name,
          searchFileType,
          crossMedia: searchFileType !== "image",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Image recommendations error:", error);
    throw error;
  }
}

async function handleVideoRecommendations(
  filePath: string,
  limit: number,
  threshold: number,
  searchFileType: "image" | "video" = "video"
) {
  try {
    const videoAnalyzer = await getVideoAnalyzer();

    console.log(`🎬 Finding similar videos for: ${filePath}`);

    // 벡터 캐시에서 먼저 기존 임베딩 확인
    const vectorCache = await getVectorCache();
    let queryEmbedding: number[];

    const existingEmbedding = await vectorCache.getEmbeddingByPath(
      filePath,
      videoAnalyzer.getModelInfo().name
    );

    if (existingEmbedding) {
      console.log(`📋 Using cached embedding for query: ${filePath}`);
      queryEmbedding = existingEmbedding.embedding;
    } else {
      console.log(`🔍 Analyzing query video: ${filePath}`);
      const queryResult = await videoAnalyzer.extractFeatures(filePath);
      queryEmbedding = queryResult.embedding;
    }

    // 유사한 파일 검색 (지정된 타입에서)
    const similarFiles = await vectorCache.findSimilar(
      queryEmbedding,
      searchFileType,
      limit * 2, // 좋아요한 파일 제외를 위해 더 많이 가져옴
      threshold
    );

    // 좋아요한 파일들 가져오기
    const likeCache = await getLikeCache();
    const likedFiles = await likeCache.getAllLikes();
    const likedFilesSet = new Set(likedFiles);

    // 좋아요한 파일들과 쿼리 파일 자체 제외
    const filteredFiles = similarFiles
      .filter((result) => {
        const relativePath = result.file.filePath.replace(mediaRoot, "");
        const queryRelativePath = filePath.replace(mediaRoot, "");
        return (
          !likedFilesSet.has(relativePath) && relativePath !== queryRelativePath
        );
      })
      .slice(0, limit); // 원하는 개수만큼만 선택

    console.log(
      `✅ Found ${filteredFiles.length} similar ${searchFileType}s (after excluding liked files)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        query: {
          filePath: filePath.replace(mediaRoot, ""), // 상대 경로로 변환
          fileType: "video",
          limit,
          threshold,
        },
        recommendations: filteredFiles.map((result) => ({
          file: {
            filePath: result.file.filePath.replace(mediaRoot, ""), // 상대 경로로 변환
            name: result.file.filePath.split("/").pop(),
            type: result.file.fileType,
            metadata: result.file.metadata,
          },
          similarity: result.similarity,
          confidence: (result.file.metadata as any)?.confidence || 0,
          analysis: {
            modelName: result.file.modelName,
            extractedAt: result.file.extractedAt,
            embeddingDimensions: result.file.embedding.length,
            frameCount: (result.file.metadata as any)?.frameCount || 0,
            processingTime: (result.file.metadata as any)?.processingTime || 0,
          },
        })),
        total: filteredFiles.length,
        processingInfo: {
          analyzer: "video_mobilenet_v2",
          method: "keyframe_feature_extraction",
          threshold: threshold,
          searchFileType,
          crossMedia: searchFileType !== "video",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Video recommendations error:", error);

    if (
      (error as Error).message?.includes("not found") ||
      (error as Error).message?.includes("does not exist")
    ) {
      return new Response(
        JSON.stringify({ error: "Video file not found or inaccessible" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to generate video recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleTextRecommendations(
  filePath: string,
  limit: number,
  threshold: number
) {
  try {
    const textAnalyzer = await getTextAnalyzer();

    console.log(`📝 Finding similar texts for: ${filePath}`);

    // 유사한 텍스트 검색
    const similarTexts = await textAnalyzer.findSimilarTexts(
      filePath,
      limit * 2, // 좋아요한 파일 제외를 위해 더 많이 가져옴
      threshold
    );

    // 좋아요한 파일들 가져오기
    const likeCache = await getLikeCache();
    const likedFiles = await likeCache.getAllLikes();
    const likedFilesSet = new Set(likedFiles);

    // 좋아요한 파일들과 쿼리 파일 자체 제외
    const filteredTexts = similarTexts
      .filter((result) => {
        const relativePath = result.file.filePath.replace(mediaRoot, "");
        const queryRelativePath = filePath.replace(mediaRoot, "");
        return (
          !likedFilesSet.has(relativePath) && relativePath !== queryRelativePath
        );
      })
      .slice(0, limit); // 원하는 개수만큼만 선택

    console.log(
      `✅ Found ${filteredTexts.length} similar texts (after excluding liked files)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        query: {
          filePath: filePath.replace(mediaRoot, ""), // 상대 경로로 변환
          fileType: "text",
          limit,
          threshold,
        },
        recommendations: filteredTexts.map((result) => ({
          file: {
            filePath: result.file.filePath.replace(mediaRoot, ""), // 상대 경로로 변환
            name: result.file.filePath.split("/").pop(),
            type: "text",
            metadata: result.file.metadata,
          },
          similarity: result.similarity, // 백분율로 변환
          confidence: (result.file.metadata as any)?.confidence || 0,
          analysis: {
            modelName: result.file.modelName,
            extractedAt: result.file.extractedAt,
            embeddingDimensions: result.file.embedding.length,
            wordCount: (result.file.metadata as any)?.wordCount || 0,
            charCount: (result.file.metadata as any)?.charCount || 0,
            language: (result.file.metadata as any)?.language || "unknown",
            summary: (result.file.metadata as any)?.summary || "",
            processingTime: (result.file.metadata as any)?.processingTime || 0,
          },
        })),
        total: filteredTexts.length,
        processingInfo: {
          analyzer: textAnalyzer.getModelInfo().name,
          method: textAnalyzer.getModelInfo().useLocalModel
            ? "local_text_embeddings"
            : "openai_embeddings",
          threshold: threshold,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Text recommendations error:", error);

    if (
      (error as Error).message?.includes("not found") ||
      (error as Error).message?.includes("does not exist")
    ) {
      return new Response(
        JSON.stringify({ error: "Text file not found or inaccessible" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to generate text recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST /api/ai-recommendations - 배치 분석 및 벡터 검색
aiRecommendations.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { action, files, options } = body;

    if (action === "analyze") {
      return await handleBatchAnalysis(files, options);
    } else if (action === "search") {
      return await handleVectorSearch(body.query, options);
    } else {
      return c.json({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    console.error("AI recommendations POST error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

async function handleBatchAnalysis(files: string[], _options: any) {
  try {
    const imageFiles = files.filter((file) => isImage(file));
    const videoFiles = files.filter((file) => isVideo(file));
    const textFiles = files.filter((file) => isText(file));

    let allResults: any[] = [];
    let totalProcessed = 0;

    if (
      imageFiles.length === 0 &&
      videoFiles.length === 0 &&
      textFiles.length === 0
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No image, video, or text files to analyze",
          processed: 0,
          total: files.length,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 이미지 배치 분석
    if (imageFiles.length > 0) {
      console.log(`🖼️ Analyzing ${imageFiles.length} image files...`);
      const imageAnalyzer = await getImageAnalyzer();
      const imageResults = await imageAnalyzer.analyzeBatch(
        imageFiles,
        (completed, total, currentFile) => {
          console.log(`Image Progress: ${completed}/${total} - ${currentFile}`);
        }
      );
      allResults.push(...imageResults);
      totalProcessed += imageResults.length;
    }

    // 비디오 배치 분석
    if (videoFiles.length > 0) {
      console.log(`🎬 Analyzing ${videoFiles.length} video files...`);
      const videoAnalyzer = await getVideoAnalyzer();
      const videoResults = await videoAnalyzer.analyzeBatch(
        videoFiles,
        (completed, total, currentFile) => {
          console.log(`Video Progress: ${completed}/${total} - ${currentFile}`);
        }
      );
      allResults.push(...videoResults);
      totalProcessed += videoResults.length;
    }

    // 텍스트 배치 분석
    if (textFiles.length > 0) {
      console.log(`📝 Analyzing ${textFiles.length} text files...`);
      const textAnalyzer = await getTextAnalyzer();
      const textResults = await textAnalyzer.analyzeBatch(
        textFiles,
        (completed, total, currentFile) => {
          console.log(`Text Progress: ${completed}/${total} - ${currentFile}`);
        }
      );
      allResults.push(...textResults);
      totalProcessed += textResults.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        total: imageFiles.length + videoFiles.length + textFiles.length,
        breakdown: {
          images: imageFiles.length,
          videos: videoFiles.length,
          texts: textFiles.length,
        },
        results: allResults.map((r) => ({
          filePath: r.filePath,
          fileType: r.fileType,
          modelName: r.modelName,
          embeddingDimensions: r.embedding.length,
          extractedAt: r.extractedAt,
          metadata: r.metadata,
        })),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Batch analysis error:", error);
    throw error;
  }
}

async function handleVectorSearch(query: any, options: any) {
  try {
    const vectorCache = await getVectorCache();

    if (query.embedding && Array.isArray(query.embedding)) {
      // 임베딩 벡터로 직접 검색
      const results = await vectorCache.findSimilar(
        query.embedding,
        query.fileType,
        options?.limit || 10,
        options?.threshold || 0.7
      );

      return new Response(
        JSON.stringify({
          success: true,
          results: results.map((r) => ({
            file: {
              path: r.file.filePath,
              type: r.file.fileType,
              metadata: r.file.metadata,
            },
            similarity: Math.round(r.similarity * 100),
            distance: r.distance,
          })),
          total: results.length,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid query format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Vector search error:", error);
    throw error;
  }
}

async function handleCrossMediaRecommendations(
  filePath: string,
  limit: number,
  threshold: number,
  sourceType: "image" | "video",
  targetType: "image" | "video"
) {
  try {
    console.log(
      `🔄 Cross-media search: ${sourceType} → ${targetType} for: ${filePath}`
    );

    if (sourceType === "image" && targetType === "video") {
      // 이미지 파일에서 비디오 검색
      return await handleImageRecommendations(
        filePath,
        limit,
        threshold,
        "video"
      );
    } else if (sourceType === "video" && targetType === "image") {
      // 비디오 파일에서 이미지 검색
      return await handleVideoRecommendations(
        filePath,
        limit,
        threshold,
        "image"
      );
    } else {
      throw new Error(
        `Unsupported cross-media combination: ${sourceType} → ${targetType}`
      );
    }
  } catch (error) {
    console.error("Cross-media recommendations error:", error);
    throw error;
  }
}

// POST /api/ai-recommendations/classify - 이미지 분류
aiRecommendations.post("/classify", async (c) => {
  try {
    const { imagePath: relativePath } = await c.req.json();

    if (!relativePath || typeof relativePath !== "string") {
      return c.json({ error: "Invalid imagePath provided" }, 400);
    }

    const imagePath = path.join(mediaRoot, relativePath);
    console.log("imagePath", imagePath);

    try {
      await fs.access(imagePath);
    } catch {
      return c.json({ error: `File not found: ${imagePath}` }, 404);
    }

    const analyzer = await getImageAnalyzer();
    const classificationResults = await analyzer.classifyImage(imagePath);

    return c.json(classificationResults);
  } catch (error: any) {
    console.error("Image classification failed:", error);
    return c.json(
      { error: "Internal server error during image classification" },
      500
    );
  }
});

// POST /api/ai-recommendations/classify-video - 비디오 분류
aiRecommendations.post("/classify-video", async (c) => {
  try {
    const { videoPath: relativePath } = await c.req.json();

    if (!relativePath || typeof relativePath !== "string") {
      return c.json({ error: "Invalid videoPath provided" }, 400);
    }

    const videoPath = path.join(mediaRoot, relativePath);

    try {
      await fs.access(videoPath);
    } catch {
      return c.json({ error: `File not found: ${videoPath}` }, 404);
    }

    const analyzer = await getVideoAnalyzer();
    const classificationResults = await analyzer.classifyVideo(videoPath);

    return c.json(classificationResults);
  } catch (error: any) {
    console.error("Video classification failed:", error);
    return c.json(
      { error: "Internal server error during video classification" },
      500
    );
  }
});

// GET /api/ai-recommendations/stats - AI 통계 조회
aiRecommendations.get("/stats", async (c) => {
  try {
    const vectorCache = await getVectorCache();
    const vectorStats = await vectorCache.getStats();

    // AI 모델 정보 수집
    const modelInfo: any[] = [];

    try {
      const imageAnalyzer = await getImageAnalyzer();
      const imageModelInfo = imageAnalyzer.getModelInfo();
      modelInfo.push({
        type: "image",
        name: imageModelInfo.name,
        isInitialized: imageModelInfo.isInitialized,
        status: imageModelInfo.isInitialized ? "ready" : "not_loaded",
      });
    } catch (error) {
      modelInfo.push({
        type: "image",
        name: "mobilenet_v2",
        isInitialized: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // 비디오 분석기 정보
    let videoAnalyzerInitialized = false;
    try {
      const videoAnalyzer = await getVideoAnalyzer();
      const videoModelInfo = videoAnalyzer.getModelInfo();
      videoAnalyzerInitialized = videoModelInfo.isInitialized;
      modelInfo.push({
        type: "video",
        name: videoModelInfo.name,
        isInitialized: videoModelInfo.isInitialized,
        status: videoModelInfo.isInitialized ? "ready" : "not_loaded",
      });
    } catch (error) {
      modelInfo.push({
        type: "video",
        name: "video-features",
        isInitialized: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // 텍스트 분석기 정보
    let textAnalyzerInitialized = false;
    try {
      const textAnalyzer = await getTextAnalyzer();
      const textModelInfo = textAnalyzer.getModelInfo();
      textAnalyzerInitialized = textModelInfo.isInitialized;
      modelInfo.push({
        type: "text",
        name: textModelInfo.name,
        isInitialized: textModelInfo.isInitialized,
        status: textModelInfo.isInitialized ? "ready" : "not_loaded",
      });
    } catch (error) {
      modelInfo.push({
        type: "text",
        name: "text-embedding",
        isInitialized: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // 성능 통계
    const performanceStats = {
      averageAnalysisTime: {
        image: 2500, // ms
        text: 1000,
        video: 8000,
      },
      cacheHitRate: vectorStats.totalEmbeddings > 0 ? 0.85 : 0, // 85%
      totalProcessedToday: vectorStats.totalEmbeddings, // 임시
      lastAnalysisTime: new Date().toISOString(),
    };

    return c.json({
      success: true,
      vectorDatabase: {
        ...vectorStats,
        status: "connected",
      },
      models: modelInfo,
      performance: performanceStats,
      features: {
        imageAnalysis: true,
        textAnalysis: textAnalyzerInitialized,
        videoAnalysis: videoAnalyzerInitialized,
        vectorSearch: true,
        batchProcessing: true,
      },
    });
  } catch (error: any) {
    console.error("AI stats error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to retrieve AI statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// GET /api/ai-recommendations/analyze - AI 분석 (SSE 스트림)
aiRecommendations.get("/analyze", async (c) => {
  const fileTypes = c.req.query("fileTypes")?.split(",") || ["image"];
  const forceReanalyze = c.req.query("forceReanalyze") === "true";

  console.log("fileTypes", fileTypes);

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();

          // SSE 헤더 전송
          const sendEvent = (data: any) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          sendEvent({
            step: "scanning",
            progress: 0,
            message: "파일 스캔 시작...",
          });

          // 파일 스캔
          const files = await scanMediaFiles(
            mediaRoot,
            (step, current, total) => {
              sendEvent({
                step: "scanning",
                progress: total > 0 ? Math.round((current / total) * 30) : 0, // 30%까지 할당
                message: step,
                details: { current, total },
              });
            }
          );

          sendEvent({
            step: "filtering",
            progress: 30,
            message: `총 ${files.length}개 파일 발견, AI 분석 대상 필터링 중...`,
          });

          // 분석할 파일 필터링 (이미지/비디오/텍스트)
          const analysisTargets = files.filter((file) => {
            if (fileTypes.includes("image") && isImage(file.name)) return true;
            if (fileTypes.includes("video") && isVideo(file.name)) return true;
            if (fileTypes.includes("text") && isText(file.name)) return true;
            return false;
          });

          sendEvent({
            step: "analysis_preparation",
            progress: 35,
            message: `AI 분석 대상: ${analysisTargets.length}개 파일`,
          });

          // AI 분석 시작
          if (analysisTargets.length === 0) {
            sendEvent({
              step: "completed",
              progress: 100,
              message: "분석할 파일이 없습니다.",
              result: {
                totalFiles: files.length,
                analyzedFiles: 0,
                newAnalysis: 0,
                cachedResults: 0,
              },
            });
            controller.close();
            return;
          }

          // 공통 카운터 및 리소스
          let analyzedCount = 0;
          let newAnalysisCount = 0;
          let cachedCount = 0;
          const vectorCache = await getVectorCache();

          // 이미지 분석기 초기화 및 처리
          if (fileTypes.includes("image")) {
            sendEvent({
              step: "model_loading",
              progress: 40,
              message: "AI 모델 로딩 중...",
            });

            const imageAnalyzer = await getImageAnalyzer();

            sendEvent({
              step: "analyzing",
              progress: 45,
              message: "AI 분석 시작...",
            });

            // 배치 분석 실행
            const imageFiles = analysisTargets.filter((file) =>
              isImage(file.name)
            );
            const imagePaths = imageFiles.map((file) => file.path);

            await imageAnalyzer.analyzeBatch(
              imagePaths,
              async (completed, total, currentFile) => {
                const progressPercent =
                  45 + Math.round((completed / total) * 50); // 45%~95%

                // 캐시 확인 (새로 분석했는지 기존 캐시인지)
                const existingEmbedding = await vectorCache.getEmbeddingByPath(
                  currentFile,
                  imageAnalyzer.getModelInfo().name
                );

                if (existingEmbedding && !forceReanalyze) {
                  cachedCount++;
                } else {
                  newAnalysisCount++;
                }

                analyzedCount = completed;

                sendEvent({
                  step: "analyzing",
                  progress: progressPercent,
                  message: `AI 분석 진행 중: ${completed}/${total}`,
                  details: {
                    currentFile: currentFile.split("/").pop(), // 파일명만
                    completed,
                    total,
                    newAnalysis: newAnalysisCount,
                    cached: cachedCount,
                  },
                });
              }
            );
          }

          // 비디오 분석기 초기화 및 처리
          if (fileTypes.includes("video")) {
            sendEvent({
              step: "model_loading",
              progress: 40,
              message: "비디오 AI 모델 로딩 중...",
            });

            const videoAnalyzer = await getVideoAnalyzer();

            sendEvent({
              step: "analyzing",
              progress: 45,
              message: "비디오 분석 시작...",
            });

            const videoFiles = analysisTargets.filter((file) =>
              isVideo(file.name)
            );
            const videoPaths = videoFiles.map((file) => file.path);

            await videoAnalyzer.analyzeBatchAdvanced(
              videoPaths,
              async (completed, total, currentFile, stats) => {
                const progressPercent =
                  45 + Math.round((completed / total) * 50);
                const existingEmbedding = await vectorCache.getEmbeddingByPath(
                  currentFile,
                  videoAnalyzer.getModelInfo().name
                );
                if (existingEmbedding && !forceReanalyze) {
                  cachedCount++;
                } else {
                  newAnalysisCount++;
                }
                analyzedCount++;
                sendEvent({
                  step: "analyzing",
                  progress: progressPercent,
                  message: `비디오 분석 진행 중: ${completed}/${total}`,
                  details: {
                    currentFile: currentFile.split("/").pop(),
                    completed,
                    total,
                    newAnalysis: newAnalysisCount,
                    cached: cachedCount,
                    concurrency: stats?.concurrency,
                    memoryUsage: stats?.memoryUsage
                      ? `${stats.memoryUsage.toFixed(1)}%`
                      : "N/A",
                  },
                });
              }
            );
          }

          // 텍스트 분석기 초기화 및 처리
          if (fileTypes.includes("text")) {
            sendEvent({
              step: "model_loading",
              progress: 40,
              message: "텍스트 AI 모델 로딩 중...",
            });

            const textAnalyzer = await getTextAnalyzer();

            sendEvent({
              step: "analyzing",
              progress: 45,
              message: "텍스트 분석 시작...",
            });

            const textFiles = analysisTargets.filter((file) =>
              isText(file.name)
            );
            const textPaths = textFiles.map((file) => file.path);

            await textAnalyzer.analyzeBatch(
              textPaths,
              async (completed, total, currentFile) => {
                const progressPercent =
                  45 + Math.round((completed / total) * 50);
                const existingEmbedding = await vectorCache.getEmbeddingByPath(
                  currentFile,
                  textAnalyzer.getModelInfo().name
                );
                if (existingEmbedding && !forceReanalyze) {
                  cachedCount++;
                } else {
                  newAnalysisCount++;
                }
                analyzedCount++;
                sendEvent({
                  step: "analyzing",
                  progress: progressPercent,
                  message: `텍스트 분석 진행 중: ${completed}/${total}`,
                  details: {
                    currentFile: currentFile.split("/").pop(),
                    completed,
                    total,
                    newAnalysis: newAnalysisCount,
                    cached: cachedCount,
                  },
                });
              }
            );
          }

          // 통계 정보 수집 및 완료 이벤트 전송
          const finalStats = await vectorCache.getStats();
          sendEvent({
            step: "completed",
            progress: 100,
            message: "AI 분석 완료!",
            result: {
              totalFiles: files.length,
              analyzedFiles: analyzedCount,
              newAnalysis: newAnalysisCount,
              cachedResults: cachedCount,
              vectorStats: finalStats,
            },
          });

          controller.close();
        } catch (error) {
          console.error("AI analysis error:", error);

          const encoder = new TextEncoder();
          const sendEvent = (data: any) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          sendEvent({
            step: "error",
            progress: 0,
            message: `분석 중 오류 발생: ${
              error instanceof Error ? error.message : "알 수 없는 오류"
            }`,
          });

          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
});

export default aiRecommendations;
