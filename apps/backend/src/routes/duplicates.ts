import { Hono } from "hono";
import { VIDEO_ROOT } from "../lib/config";
import { scanMediaFiles, findDuplicateGroups } from "../lib/duplicate-detector";
import { getFileCache } from "../lib/file-cache";
import { deserializeThresholds } from "../lib/threshold-presets";
import { promises as fs } from "fs";

const duplicates = new Hono();

// GET /api/duplicates - 중복 파일 스캔
duplicates.get("/", async (c) => {
  try {
    const scanPath = c.req.query("path") || VIDEO_ROOT;

    // 새로운 임계값 시스템 사용 - Hono 쿼리 파라미터를 객체로 구성
    const queryParams = {
      imagePerceptual: c.req.query("imagePerceptual"),
      imageExact: c.req.query("imageExact"),
      videoVisual: c.req.query("videoVisual"),
      videoDuration: c.req.query("videoDuration"),
      videoExact: c.req.query("videoExact"),
      minFileSize: c.req.query("minFileSize"),
      skipSmallFiles: c.req.query("skipSmallFiles"),
    };
    const thresholds = deserializeThresholds(queryParams);

    // 하위 호환성을 위해 기존 threshold 파라미터도 지원
    const legacyThreshold = c.req.query("threshold");
    if (legacyThreshold && !queryParams.imagePerceptual) {
      const threshold = parseInt(legacyThreshold);
      thresholds.image.perceptual = threshold;
      thresholds.video.visual = threshold;
    }

    console.log(`Scanning for duplicates in: ${scanPath}`);
    console.log(`Thresholds:`, {
      imagePerceptual: thresholds.image.perceptual,
      imageExact: thresholds.image.exact,
      videoVisual: thresholds.video.visual,
      videoDuration: thresholds.video.duration,
      videoExact: thresholds.video.exact,
      minFileSize: thresholds.global.minFileSize,
      skipSmallFiles: thresholds.global.skipSmallFiles,
    });

    // 모든 미디어 파일 스캔
    const files = await scanMediaFiles(scanPath);
    console.log(`Found ${files.length} media files`);

    // 중복 그룹 찾기 (새로운 임계값 시스템 사용)
    const duplicateGroups = findDuplicateGroups(files, thresholds);

    console.log(`Found ${duplicateGroups.length} duplicate groups`);

    // 캐시 통계 정보 가져오기
    const fileCache = await getFileCache();
    const cacheStats = await fileCache.getCacheStats();

    // 통계 정보 계산
    const stats = {
      totalFiles: files.length,
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce(
        (sum, group) => sum + group.files.length,
        0
      ),
      totalWastedSpace: duplicateGroups.reduce((sum, group) => {
        // 가장 작은 파일을 제외한 나머지 파일들의 크기 합계
        if (group.files.length <= 1) return sum;
        const sortedBySize = [...group.files].sort((a, b) => a.size - b.size);
        return (
          sum +
          sortedBySize
            .slice(1)
            .reduce((groupSum, file) => groupSum + file.size, 0)
        );
      }, 0),
      imageGroups: duplicateGroups.filter((g) => g.type === "image").length,
      videoGroups: duplicateGroups.filter((g) => g.type === "video").length,
      cache: cacheStats,
    };

    return c.json({
      groups: duplicateGroups,
      stats,
      thresholds,
    });
  } catch (error) {
    console.error("Error scanning for duplicates:", error);
    return c.json({ error: "Failed to scan for duplicates" }, 500);
  }
});

// DELETE /api/duplicates - 중복 파일 삭제
duplicates.delete("/", async (c) => {
  try {
    const { filePaths } = await c.req.json();

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return c.json({ error: "Invalid file paths provided" }, 400);
    }

    const deletedFiles: string[] = [];
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        deletedFiles.push(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to delete ${filePath}:`, error);
        errors.push(`Failed to delete ${filePath}: ${error}`);
      }
    }

    return c.json({
      deletedFiles,
      errors,
      success: deletedFiles.length,
      failed: errors.length,
    });
  } catch (error) {
    console.error("Error deleting files:", error);
    return c.json({ error: "Failed to delete files" }, 500);
  }
});

// 진행 상황을 추적하기 위한 전역 상태
const scanProgressState = {
  isScanning: false,
  currentStep: "",
  filesScanned: 0,
  totalFiles: 0,
  progress: 0,
  startTime: 0,
};

// GET /api/duplicates/progress - 진행 상황 조회 (SSE 스트림)
duplicates.get("/progress", async (c) => {
  const scanPath = c.req.query("path") || VIDEO_ROOT;

  // 새로운 임계값 시스템 사용 - Hono 쿼리 파라미터를 객체로 구성
  const queryParams = {
    imagePerceptual: c.req.query("imagePerceptual"),
    imageExact: c.req.query("imageExact"),
    videoVisual: c.req.query("videoVisual"),
    videoDuration: c.req.query("videoDuration"),
    videoExact: c.req.query("videoExact"),
    minFileSize: c.req.query("minFileSize"),
    skipSmallFiles: c.req.query("skipSmallFiles"),
  };
  const thresholds = deserializeThresholds(queryParams);

  // 하위 호환성을 위해 기존 threshold 파라미터도 지원
  const legacyThreshold = c.req.query("threshold");
  if (legacyThreshold && !queryParams.imagePerceptual) {
    const threshold = parseInt(legacyThreshold);
    thresholds.image.perceptual = threshold;
    thresholds.video.visual = threshold;
  }

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const sendMessage = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        const progressCallback = (
          step: string,
          current: number,
          total: number
        ) => {
          scanProgressState.currentStep = step;
          scanProgressState.filesScanned = current;
          scanProgressState.totalFiles = total;
          scanProgressState.progress =
            total > 0 ? Math.round((current / total) * 100) : 0;

          sendMessage({
            step,
            current,
            total,
            progress: scanProgressState.progress,
            message: `${step}: ${current}/${total} (${scanProgressState.progress}%)`,
          });
        };

        // 스캔 시작
        const startScan = async () => {
          try {
            scanProgressState.isScanning = true;
            scanProgressState.startTime = Date.now();

            sendMessage({
              step: "starting",
              progress: 0,
              message: "스캔을 시작합니다...",
            });

            // 파일 스캔
            sendMessage({
              step: "scanning",
              progress: 5,
              message: "파일들을 검색하고 있습니다...",
            });

            const files = await scanMediaFiles(scanPath, progressCallback);

            sendMessage({
              step: "analyzing",
              progress: 70,
              message: "중복 파일을 분석하고 있습니다...",
            });

            // 중복 그룹 찾기 (새로운 임계값 시스템 사용)
            const duplicateGroups = findDuplicateGroups(files, thresholds);

            sendMessage({
              step: "finalizing",
              progress: 90,
              message: "결과를 정리하고 있습니다...",
            });

            const totalScanTime = Date.now() - scanProgressState.startTime;

            sendMessage({
              step: "completed",
              progress: 100,
              message: `스캔 완료! ${(totalScanTime / 1000).toFixed(1)}초 소요`,
              result: {
                totalFiles: files.length,
                duplicateGroups: duplicateGroups.length,
                duplicateFiles: duplicateGroups.reduce(
                  (sum, group) => sum + group.files.length,
                  0
                ),
                groups: duplicateGroups,
                thresholds,
              },
            });
          } catch (error) {
            console.error("Scan error:", error);
            sendMessage({
              step: "error",
              progress: 0,
              message: `스캔 중 오류가 발생했습니다: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            });
          } finally {
            scanProgressState.isScanning = false;
            controller.close();
          }
        };

        startScan();
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

export default duplicates;
