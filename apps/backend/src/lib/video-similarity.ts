import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { FRAME_INTERVAL, MAX_KEYFRAMES } from "./config";

// FFmpeg 바이너리 경로 설정
function initFFmpeg() {
  try {
    // 시스템 FFmpeg 우선 시도 (더 안정적)
    const { execSync } = require("child_process");
    const systemFfmpegPath = execSync("which ffmpeg", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();

    if (systemFfmpegPath && require("fs").existsSync(systemFfmpegPath)) {
      ffmpeg.setFfmpegPath(systemFfmpegPath);
      console.log(`Using system FFmpeg: ${systemFfmpegPath}`);
      return true;
    }
  } catch {
    console.warn("System FFmpeg not found, trying ffmpeg-static...");
  }

  // fallback to ffmpeg-static
  try {
    if (ffmpegStatic && require("fs").existsSync(ffmpegStatic)) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
      console.log(`Using ffmpeg-static: ${ffmpegStatic}`);
      return true;
    }
  } catch (error) {
    console.warn("ffmpeg-static failed:", error);
  }

  console.warn(
    "No working FFmpeg found. Video similarity detection will be disabled."
  );
  return false;
}

// FFmpeg 초기화
const ffmpegAvailable = initFFmpeg();

export interface VideoFrame {
  timestamp: number;
  hash: string;
}

export interface VideoFingerprint {
  filePath: string;
  duration: number;
  frames: VideoFrame[];
  averageHash: string;
}

/**
 * FFmpeg가 사용 가능한지 확인합니다
 */
function checkFfmpegAvailable(): boolean {
  return ffmpegAvailable;
}

/**
 * 동영상에서 키프레임을 추출하고 각 프레임의 perceptual hash를 계산합니다
 */
export async function extractVideoFingerprint(
  videoPath: string,
  frameInterval: number = FRAME_INTERVAL, // 5초마다 프레임 추출
  maxFrames: number = MAX_KEYFRAMES // 최대 1000프레임
): Promise<VideoFingerprint> {
  console.log(
    `🎬 Starting video fingerprint extraction for: ${path.basename(videoPath)}`
  );

  // FFmpeg 사용 가능성 확인
  if (!checkFfmpegAvailable()) {
    throw new Error(
      "FFmpeg is not available. Please install FFmpeg or check ffmpeg-static configuration."
    );
  }
  const tempDir = path.join(process.cwd(), "temp", "video-frames");
  await fs.mkdir(tempDir, { recursive: true });

  const videoName = path.basename(videoPath, path.extname(videoPath));
  const frameDir = path.join(tempDir, `${videoName}-${Date.now()}`);
  await fs.mkdir(frameDir, { recursive: true });

  try {
    // 동영상 정보 가져오기
    console.log(`📹 Getting video info for: ${path.basename(videoPath)}`);
    const videoInfo = await getVideoInfo(videoPath);
    const duration = videoInfo.duration;
    console.log(
      `⏱️ Video duration: ${duration}s, size: ${videoInfo.width}x${videoInfo.height}`
    );

    // 추출할 타임스탬프 계산
    const timestamps: number[] = [];
    for (
      let i = 0;
      i <= Math.min(Math.floor(duration / frameInterval), maxFrames - 1);
      i++
    ) {
      timestamps.push(i * frameInterval);
    }
    console.log(
      `🎯 Will extract ${timestamps.length} frames at: [${timestamps.join(", ")}]s`
    );

    // 프레임 추출 (배치 처리)
    console.log(`🚀 Extracting ${timestamps.length} frames in batch mode...`);
    const frames: VideoFrame[] = [];

    try {
      // 한번에 모든 프레임 추출
      const extractedFrames = await extractBatchFrames(
        videoPath,
        timestamps,
        frameDir
      );

      // 각 프레임의 해시 계산
      for (let i = 0; i < extractedFrames.length; i++) {
        const frameData = extractedFrames[i];
        if (!frameData) continue;

        const { timestamp, framePath } = frameData;
        try {
          const hash = await calculateImageHash(framePath);
          frames.push({ timestamp, hash });
          console.log(
            `✅ Frame ${i} (${timestamp}s): ${hash.substring(0, 8)}...`
          );
        } catch (error) {
          console.warn(
            `❌ Failed to calculate hash for frame at ${timestamp}s:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    } catch (error) {
      console.warn(
        `❌ Batch frame extraction failed, falling back to individual extraction:`,
        error instanceof Error ? error.message : error
      );

      // fallback: 개별 추출
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        if (timestamp === undefined) continue;

        const framePath = path.join(frameDir, `frame-${i}.png`);

        try {
          await extractFrame(videoPath, timestamp, framePath);
          const hash = await calculateImageHash(framePath);
          frames.push({ timestamp, hash });
          console.log(
            `✅ Frame ${i} (${timestamp}s): ${hash.substring(0, 8)}...`
          );
        } catch (error) {
          console.warn(
            `❌ Failed to extract frame at ${timestamp}s from ${videoPath}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    console.log(
      `🎬 Extracted ${frames.length}/${timestamps.length} frames successfully`
    );

    // 전체 해시 계산 (모든 프레임 해시의 조합)
    const combinedHash = frames.map((f) => f.hash).join("");
    const averageHash = createHash("md5").update(combinedHash).digest("hex");

    const result = {
      filePath: videoPath,
      duration,
      frames,
      averageHash,
    };

    console.log(
      `🏁 Video fingerprint completed for ${path.basename(videoPath)}: ${frames.length} frames, hash: ${averageHash.substring(0, 8)}...`
    );
    return result;
  } finally {
    // 임시 파일 정리
    try {
      await fs.rm(frameDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${frameDir}:`, error);
    }
  }
}

/**
 * 동영상 정보를 가져옵니다 (더 안정적인 방식)
 */
async function getVideoInfo(
  videoPath: string
): Promise<{ duration: number; width: number; height: number }> {
  try {
    const { execSync } = require("child_process");

    // ffprobe로 duration 가져오기
    const durationCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`;
    const durationOutput = execSync(durationCmd, {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    const duration = parseFloat(durationOutput) || 0;

    // ffprobe로 해상도 가져오기
    const resolutionCmd = `ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`;
    const resolutionOutput = execSync(resolutionCmd, {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    const [width, height] = resolutionOutput
      .split(",")
      .map((s: string) => parseInt(s.trim(), 10) || 0);

    console.log(`📐 Video info: ${duration}s, ${width}x${height}`);

    return { duration, width, height };
  } catch (error) {
    console.error(`Failed to get video info for ${videoPath}:`, error);
    throw error;
  }
}

/**
 * 배치로 여러 프레임을 한번에 추출합니다 (효율적인 방식)
 */
async function extractBatchFrames(
  videoPath: string,
  timestamps: number[],
  outputDir: string
): Promise<Array<{ timestamp: number; framePath: string }>> {
  try {
    const { execSync } = require("child_process");

    // select 필터 구성: eq(t,0)+eq(t,5)+eq(t,10)...
    const selectExpressions = timestamps.map((t) => `eq(t,${t})`).join("+");
    const selectFilter = `select='${selectExpressions}'`;

    // 출력 파일 패턴
    const outputPattern = path.join(outputDir, "batch_%03d.png");

    // FFmpeg 배치 명령어
    const cmd = `ffmpeg -i "${videoPath}" -vf "${selectFilter}" -vsync 0 -q:v 2 "${outputPattern}" -y`;

    console.log(`🎬 Batch extracting frames with select filter...`);
    execSync(cmd, {
      encoding: "utf8",
      timeout: 180000, // 3분 timeout (배치이므로 더 길게)
      stdio: "pipe",
    });

    // 생성된 파일들을 timestamp와 매핑
    const result: Array<{ timestamp: number; framePath: string }> = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      if (timestamp === undefined) continue;

      const frameNumber = String(i + 1).padStart(3, "0"); // 001, 002, 003...
      const framePath = path.join(outputDir, `batch_${frameNumber}.png`);

      if (require("fs").existsSync(framePath)) {
        result.push({
          timestamp: timestamp,
          framePath: framePath,
        });
      } else {
        console.warn(
          `⚠️ Frame file not found: ${framePath} for timestamp ${timestamp}s`
        );
      }
    }

    console.log(
      `✅ Batch extracted ${result.length}/${timestamps.length} frames successfully`
    );
    return result;
  } catch (error) {
    console.error(
      `❌ Batch frame extraction failed:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

/**
 * 특정 시간에서 프레임을 추출합니다 (개별 방식 - fallback용)
 */
async function extractFrame(
  videoPath: string,
  timestamp: number,
  outputPath: string
): Promise<void> {
  try {
    const { execSync } = require("child_process");

    // FFmpeg로 특정 시간에서 프레임 추출 (빠른 seek 옵션 추가)
    const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -f image2 -update 1 -q:v 2 "${outputPath}" -y`;
    execSync(cmd, {
      encoding: "utf8",
      timeout: 120000, // 30초 → 120초(2분)로 증가
      stdio: "pipe", // 출력을 숨김
    });

    // 파일이 생성되었는지 확인
    if (!require("fs").existsSync(outputPath)) {
      throw new Error(
        `Frame extraction failed - output file not created: ${outputPath}`
      );
    }

    console.log(`🖼️ Extracted frame at ${timestamp}s`);
  } catch (error) {
    console.error(
      `❌ Failed to extract frame at ${timestamp}s:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

/**
 * 이미지의 perceptual hash를 계산합니다
 */
async function calculateImageHash(imagePath: string): Promise<string> {
  try {
    const { data } = await sharp(imagePath)
      .resize(8, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 평균값 계산
    const avg =
      Array.from(data).reduce((sum, val) => sum + val, 0) / data.length;

    // 각 픽셀이 평균보다 큰지 여부로 해시 생성
    let hash = "";
    for (let i = 0; i < data.length; i++) {
      const pixel = data[i];
      hash += pixel !== undefined && pixel > avg ? "1" : "0";
    }

    return hash;
  } catch (error) {
    console.error(`Error calculating image hash for ${imagePath}:`, error);
    throw error;
  }
}

/**
 * 두 동영상의 유사도를 계산합니다 (0-100%)
 * 절반으로 자른 동영상이나 편집된 동영상도 감지할 수 있도록 개선
 */
export function calculateVideoSimilarity(
  fingerprint1: VideoFingerprint,
  fingerprint2: VideoFingerprint
): number {
  const file1 = path.basename(fingerprint1.filePath);
  const file2 = path.basename(fingerprint2.filePath);
  console.log(`🔍 Comparing videos: "${file1}" vs "${file2}"`);

  if (fingerprint1.frames.length === 0 || fingerprint2.frames.length === 0) {
    console.log(
      `❌ One video has no frames: ${file1}(${fingerprint1.frames.length}) vs ${file2}(${fingerprint2.frames.length})`
    );
    return 0;
  }

  // 더 짧은 비디오와 더 긴 비디오를 구분
  const [shortVideo, longVideo] =
    fingerprint1.duration <= fingerprint2.duration
      ? [fingerprint1, fingerprint2]
      : [fingerprint2, fingerprint1];

  const shortName = path.basename(shortVideo.filePath);
  const longName = path.basename(longVideo.filePath);

  // 지속 시간 비율 계산 (짧은 것이 긴 것의 몇 %인지)
  const durationRatio = shortVideo.duration / longVideo.duration;
  console.log(
    `⏱️ Duration comparison: ${shortName}(${shortVideo.duration}s) vs ${longName}(${longVideo.duration}s) = ${(durationRatio * 100).toFixed(1)}%`
  );

  // 너무 짧으면 (20% 미만) 다른 비디오로 간주
  if (durationRatio < 0.2) {
    console.log(
      `❌ Duration ratio too low: ${(durationRatio * 100).toFixed(1)}% < 20%`
    );
    return 0;
  }

  // 최대 유사도를 찾기 위해 여러 위치에서 비교
  let maxSimilarity = 0;

  // 시작 부분부터 비교
  const startSimilarity = compareFrameSequences(
    shortVideo.frames,
    longVideo.frames,
    0
  );
  maxSimilarity = Math.max(maxSimilarity, startSimilarity);
  console.log(`🎬 Start comparison: ${startSimilarity.toFixed(1)}%`);

  // 중간 부분부터 비교 (긴 비디오의 중간에서 시작)
  const midStart = Math.floor(
    (longVideo.frames.length - shortVideo.frames.length) / 2
  );
  if (midStart > 0) {
    const midSimilarity = compareFrameSequences(
      shortVideo.frames,
      longVideo.frames,
      midStart
    );
    maxSimilarity = Math.max(maxSimilarity, midSimilarity);
    console.log(
      `🎬 Mid comparison (offset ${midStart}): ${midSimilarity.toFixed(1)}%`
    );
  }

  // 끝 부분부터 비교
  const endStart = longVideo.frames.length - shortVideo.frames.length;
  if (endStart > 0 && endStart !== midStart) {
    const endSimilarity = compareFrameSequences(
      shortVideo.frames,
      longVideo.frames,
      endStart
    );
    maxSimilarity = Math.max(maxSimilarity, endSimilarity);
    console.log(
      `🎬 End comparison (offset ${endStart}): ${endSimilarity.toFixed(1)}%`
    );
  }

  // 슬라이딩 윈도우로 최적의 매칭 위치 찾기 (성능을 위해 2프레임씩 건너뛰기)
  const step = Math.max(1, Math.floor(longVideo.frames.length / 10));
  console.log(`🔍 Sliding window search with step ${step}...`);

  for (
    let offset = 0;
    offset <= longVideo.frames.length - shortVideo.frames.length;
    offset += step
  ) {
    const similarity = compareFrameSequences(
      shortVideo.frames,
      longVideo.frames,
      offset
    );
    if (similarity > maxSimilarity) {
      console.log(
        `🎯 Better match found at offset ${offset}: ${similarity.toFixed(1)}%`
      );
      maxSimilarity = similarity;
    }

    // 매우 높은 유사도를 찾으면 조기 종료
    if (maxSimilarity > 95) {
      console.log(`🚀 Early termination: ${maxSimilarity.toFixed(1)}% > 95%`);
      break;
    }
  }

  // 지속 시간 가중치 적용
  const durationWeight = Math.min(1.0, durationRatio + 0.3); // 짧은 비디오에게 더 관대하게
  const finalSimilarity = Math.round(maxSimilarity * durationWeight);

  console.log(
    `🏁 Final similarity: ${maxSimilarity.toFixed(1)}% * ${durationWeight.toFixed(2)} = ${finalSimilarity}%`
  );
  console.log(
    `📊 Result: "${file1}" vs "${file2}" = ${finalSimilarity}% ${finalSimilarity >= 70 ? "✅ MATCH" : "❌ NO MATCH"}`
  );

  return finalSimilarity;
}

/**
 * 두 프레임 시퀀스의 유사도를 계산합니다
 */
function compareFrameSequences(
  shortFrames: VideoFrame[],
  longFrames: VideoFrame[],
  offset: number
): number {
  if (offset + shortFrames.length > longFrames.length) {
    return 0;
  }

  let totalSimilarity = 0;
  let validComparisons = 0;

  for (let i = 0; i < shortFrames.length; i++) {
    const shortFrame = shortFrames[i];
    const longIndex = offset + i;
    const longFrame = longFrames[longIndex];

    if (shortFrame && longFrame && longIndex < longFrames.length) {
      const similarity = calculateHashSimilarity(
        shortFrame.hash,
        longFrame.hash
      );
      totalSimilarity += similarity;
      validComparisons++;
    }
  }

  return validComparisons > 0 ? totalSimilarity / validComparisons : 0;
}

/**
 * 두 해시 간의 유사도를 계산합니다 (Hamming distance 기반)
 */
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 0;
  }

  let differences = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      differences++;
    }
  }

  const similarity = ((hash1.length - differences) / hash1.length) * 100;
  return similarity;
}

/**
 * 임시 디렉토리 정리
 */
export async function cleanupTempDirectory(): Promise<void> {
  const tempDir = path.join(process.cwd(), "temp");
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // 임시 디렉토리가 없거나 정리에 실패해도 무시
  }
}
