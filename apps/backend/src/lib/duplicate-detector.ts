import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isImage, isVideo, isText } from "./utils";
import {
  extractVideoFingerprint,
  calculateVideoSimilarity,
  type VideoFingerprint,
} from "./video-similarity";
import { getFileCache } from "./file-cache";

export interface DuplicateGroup {
  id: string;
  type: "image" | "video";
  files: DuplicateFile[];
  similarity: number;
}

export interface DuplicateFile {
  path: string;
  relativePath: string; // VIDEO_ROOT를 기준으로 한 상대 경로
  name: string;
  size: number;
  hash: string;
  perceptualHash?: string;
  videoFingerprint?: VideoFingerprint;
  modifiedAt: string;
}

/**
 * 파일의 MD5 해시를 계산합니다
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return createHash("md5").update(buffer).digest("hex");
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    throw error;
  }
}

/**
 * 이미지의 perceptual hash를 계산합니다
 */
export async function calculatePerceptualHash(
  filePath: string
): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);

    // Sharp를 동적으로 import (서버 사이드에서만 사용)
    const { default: sharp } = await import("sharp");

    // 이미지를 8x8 그레이스케일로 변환
    const { data } = await sharp(buffer)
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
      hash += data[i]! > avg ? "1" : "0";
    }

    return hash;
  } catch (error) {
    console.error(`Error calculating perceptual hash for ${filePath}:`, error);
    throw error;
  }
}

/**
 * 두 perceptual hash 간의 해밍 거리를 계산합니다
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * 해밍 거리를 유사도 퍼센티지로 변환합니다
 */
export function hammingDistanceToSimilarity(
  distance: number,
  hashLength: number
): number {
  return Math.max(0, ((hashLength - distance) / hashLength) * 100);
}

/**
 * 디렉토리를 재귀적으로 스캔하여 모든 이미지와 비디오 파일을 찾습니다 (캐시 사용)
 */
export async function scanMediaFiles(
  dirPath: string,
  progressCallback?: (step: string, current: number, total: number) => void
): Promise<DuplicateFile[]> {
  const files: DuplicateFile[] = [];
  let processedFiles = 0;
  let totalFilesEstimate = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  // 파일 캐시 가져오기
  const fileCache = await getFileCache();

  // 먼저 총 파일 수를 추정
  async function countFiles(currentPath: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          count += await countFiles(entryPath);
        } else if (
          entry.isFile() &&
          (isImage(entry.name) || isVideo(entry.name) || isText(entry.name))
        ) {
          count++;
        }
      }
    } catch (error) {
      console.warn(`Failed to count files in ${currentPath}:`, error);
    }
    return count;
  }

  // 총 파일 수 계산
  if (progressCallback) {
    progressCallback("파일 개수 계산 중", 0, 0);
    totalFilesEstimate = await countFiles(dirPath);
    progressCallback("파일 스캔 시작 (캐시 활용)", 0, totalFilesEstimate);
  }

  async function scanDir(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        // Unicode 정규화 (macOS NFD -> NFC 변환)
        const normalizedName = entry.name.normalize("NFC");
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scanDir(entryPath);
        } else if (
          entry.isFile() &&
          (isImage(normalizedName) ||
            isVideo(normalizedName) ||
            isText(normalizedName))
        ) {
          try {
            const stats = await fs.stat(entryPath);
            const modifiedAt = stats.mtime.toISOString();

            // 상대 경로 계산 (dirPath 기준)
            const relativePath = path
              .relative(dirPath, entryPath)
              .replace(/\\/g, "/");

            const normalizedRelativePath = relativePath.startsWith("/")
              ? relativePath
              : "/" + relativePath;

            // 캐시에서 파일 정보 확인
            let isChanged = await fileCache.isFileChanged(
              entryPath,
              stats.size,
              modifiedAt
            );

            let file: DuplicateFile;

            if (!isChanged) {
              // 캐시에서 정보 가져오기
              const cached = await fileCache.getCachedFileInfo(entryPath);
              if (cached) {
                cacheHits++;
                file = fileCache.cachedInfoToDuplicateFile(
                  cached,
                  normalizedRelativePath,
                  normalizedName
                );

                if (progressCallback && totalFilesEstimate > 0) {
                  progressCallback(
                    `캐시에서 로드: ${normalizedName}`,
                    processedFiles + 1,
                    totalFilesEstimate
                  );
                }
              } else {
                // 캐시에 없는 경우 (첫 실행 등)
                isChanged = true;
              }
            }

            if (isChanged) {
              // 파일이 변경되었거나 캐시에 없으면 새로 계산
              cacheMisses++;
              const fileHash = await calculateFileHash(entryPath);

              file = {
                path: entryPath,
                relativePath: normalizedRelativePath,
                name: normalizedName,
                size: stats.size,
                hash: fileHash,
                modifiedAt: modifiedAt,
              };

              // 이미지인 경우 perceptual hash 계산
              if (isImage(normalizedName)) {
                try {
                  if (progressCallback && totalFilesEstimate > 0) {
                    progressCallback(
                      `이미지 분석 중: ${normalizedName}`,
                      processedFiles + 1,
                      totalFilesEstimate
                    );
                  }
                  file.perceptualHash =
                    await calculatePerceptualHash(entryPath);
                } catch (error) {
                  console.warn(
                    `Failed to calculate perceptual hash for ${entryPath}:`,
                    error
                  );
                }
              }

              // 동영상인 경우 video fingerprint 계산
              if (isVideo(normalizedName)) {
                try {
                  console.log(
                    `🎥 Processing video: ${normalizedName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`
                  );
                  if (progressCallback && totalFilesEstimate > 0) {
                    progressCallback(
                      `비디오 분석 중: ${normalizedName}`,
                      processedFiles + 1,
                      totalFilesEstimate
                    );
                  }
                  file.videoFingerprint =
                    await extractVideoFingerprint(entryPath);
                  console.log(
                    `✅ Video fingerprint created for: ${normalizedName} - ${file.videoFingerprint.frames.length} frames`
                  );
                } catch (error) {
                  console.warn(
                    `❌ Failed to calculate video fingerprint for ${entryPath}:`,
                    error instanceof Error ? error.message : error
                  );
                  // video fingerprint가 없어도 계속 진행 (기본 중복 검사는 여전히 가능)
                }
              } else {
                console.log(`📄 Processing non-video file: ${normalizedName}`);
              }

              // 캐시에 저장
              try {
                await fileCache.cacheFileInfo(file);
              } catch (error) {
                console.warn(
                  `Failed to cache file info for ${entryPath}:`,
                  error
                );
              }
            }

            files.push(file!);
            processedFiles++;

            // 프로그래스 업데이트
            if (progressCallback && totalFilesEstimate > 0) {
              progressCallback(
                `파일 처리 완료: ${normalizedName}`,
                processedFiles,
                totalFilesEstimate
              );
            }
          } catch (error) {
            console.warn(`Skipping file ${entryPath}:`, error);
            processedFiles++;
            if (progressCallback && totalFilesEstimate > 0) {
              progressCallback(
                `파일 처리 중`,
                processedFiles,
                totalFilesEstimate
              );
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${currentPath}:`, error);
    }
  }

  await scanDir(dirPath);

  // 캐시 통계 출력
  console.log(`📊 Cache Statistics:`);
  console.log(`   Cache hits: ${cacheHits} files`);
  console.log(`   Cache misses: ${cacheMisses} files`);
  console.log(
    `   Cache hit ratio: ${cacheHits > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) : 0}%`
  );

  if (progressCallback) {
    progressCallback(
      `파일 스캔 완료 (캐시 적중률: ${cacheHits > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) : 0}%)`,
      totalFilesEstimate,
      totalFilesEstimate
    );
  }

  return files;
}

/**
 * 중복 파일 그룹을 찾습니다
 */
export function findDuplicateGroups(
  files: DuplicateFile[],
  thresholds: import("../types").SimilarityThresholds
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processedFiles = new Set<string>();

  // 파일 크기 필터링
  let filteredFiles = files;
  if (thresholds.global.skipSmallFiles && thresholds.global.minFileSize > 0) {
    filteredFiles = files.filter(
      (file) => file.size >= thresholds.global.minFileSize
    );
    console.log(
      `Filtered out ${files.length - filteredFiles.length} small files (< ${thresholds.global.minFileSize} bytes)`
    );
  }

  // 1. 정확한 중복 (같은 해시)
  const hashGroups = new Map<string, DuplicateFile[]>();
  for (const file of filteredFiles) {
    if (!hashGroups.has(file.hash)) {
      hashGroups.set(file.hash, []);
    }
    hashGroups.get(file.hash)!.push(file);
  }

  // 정확한 중복 그룹 추가
  for (const [hash, groupFiles] of hashGroups) {
    if (groupFiles.length > 1) {
      const firstFile = groupFiles[0]!;
      const type = isImage(firstFile.name) ? "image" : "video";

      groups.push({
        id: `exact-${hash}`,
        type,
        files: groupFiles,
        similarity: 100,
      });

      groupFiles.forEach((file) => processedFiles.add(file.path));
    }
  }

  // 2. 이미지의 유사한 중복 (perceptual hash 기반)
  // 정확한 중복만 허용하는 경우 건너뛰기
  if (!thresholds.image.exact) {
    const imageFiles = filteredFiles.filter(
      (f) => isImage(f.name) && f.perceptualHash && !processedFiles.has(f.path)
    );

    const imageProcessed = new Set<string>();

    for (let i = 0; i < imageFiles.length; i++) {
      if (imageProcessed.has(imageFiles[i]!.path)) continue;

      const similarFiles = [imageFiles[i]!];
      imageProcessed.add(imageFiles[i]!.path);

      for (let j = i + 1; j < imageFiles.length; j++) {
        if (imageProcessed.has(imageFiles[j]!.path)) continue;

        const distance = calculateHammingDistance(
          imageFiles[i]!.perceptualHash!,
          imageFiles[j]!.perceptualHash!
        );

        const similarity = hammingDistanceToSimilarity(distance, 64); // 8x8 = 64 bits

        // 이미지 perceptual 임계값 이상 유사하면 중복으로 간주
        if (similarity >= thresholds.image.perceptual) {
          similarFiles.push(imageFiles[j]!);
          imageProcessed.add(imageFiles[j]!.path);
        }
      }

      if (similarFiles.length > 1) {
        const maxSimilarity = Math.min(
          ...similarFiles.slice(1).map((file) => {
            const distance = calculateHammingDistance(
              similarFiles[0]!.perceptualHash!,
              file.perceptualHash!
            );
            return hammingDistanceToSimilarity(distance, 64);
          })
        );

        groups.push({
          id: `similar-${similarFiles[0]!.hash}`,
          type: "image",
          files: similarFiles,
          similarity: Math.round(maxSimilarity),
        });
      }
    }
  }

  // 3. 동영상의 시각적 유사 중복 (video fingerprint 기반)
  // 정확한 중복만 허용하는 경우 건너뛰기
  if (!thresholds.video.exact) {
    const allVideoFiles = filteredFiles.filter((f) => isVideo(f.name));
    // 부분적으로 편집된 동영상 감지를 위해 processedFiles 체크 제거
    const videoFiles = filteredFiles.filter(
      (f) => isVideo(f.name) && f.videoFingerprint
    );

    console.log(
      `🎬 Video fingerprint analysis: ${videoFiles.length}/${allVideoFiles.length} videos have fingerprints`
    );

    console.log(`📋 All video files found:`);
    allVideoFiles.forEach((f, i) => {
      const hasFingerprint = f.videoFingerprint ? "✅" : "❌";
      const isProcessed = processedFiles.has(f.path)
        ? "(already processed)"
        : "";
      console.log(
        `  ${i + 1}. ${path.basename(f.path)} ${hasFingerprint} ${isProcessed}`
      );
    });

    if (videoFiles.length > 0) {
      console.log(`📹 Videos with fingerprints:`);
      videoFiles.forEach((f, i) => {
        console.log(
          `  ${i + 1}. ${path.basename(f.path)} (${f.videoFingerprint?.duration}s, ${f.videoFingerprint?.frames.length} frames)`
        );
      });
    }

    const videoProcessed = new Set<string>();

    for (let i = 0; i < videoFiles.length; i++) {
      if (videoProcessed.has(videoFiles[i]!.path)) continue;

      const similarFiles = [videoFiles[i]!];
      videoProcessed.add(videoFiles[i]!.path);

      for (let j = i + 1; j < videoFiles.length; j++) {
        if (videoProcessed.has(videoFiles[j]!.path)) continue;

        const fingerprint1 = videoFiles[i]!.videoFingerprint;
        const fingerprint2 = videoFiles[j]!.videoFingerprint;

        if (fingerprint1 && fingerprint2) {
          // 먼저 길이 비교
          const duration1 = fingerprint1.duration;
          const duration2 = fingerprint2.duration;
          const durationRatio =
            (Math.min(duration1, duration2) / Math.max(duration1, duration2)) *
            100;

          // 길이 임계값 검사
          if (durationRatio < thresholds.video.duration) {
            console.log(
              `⏱️ Duration ratio too low: ${durationRatio.toFixed(1)}% < ${thresholds.video.duration}%`
            );
            continue;
          }

          console.log(`🔍 Starting video similarity comparison...`);
          const similarity = calculateVideoSimilarity(
            fingerprint1,
            fingerprint2
          );

          // 비디오 시각적 임계값 이상 유사하면 중복으로 간주
          if (similarity >= thresholds.video.visual) {
            console.log(
              `🎯 Video similarity match found: ${similarity}% >= ${thresholds.video.visual}%`
            );
            similarFiles.push(videoFiles[j]!);
            videoProcessed.add(videoFiles[j]!.path);
          } else {
            console.log(
              `❌ Video similarity too low: ${similarity}% < ${thresholds.video.visual}%`
            );
          }
        }
      }

      if (similarFiles.length > 1) {
        const maxSimilarity = Math.max(
          ...similarFiles.slice(1).map((file) => {
            const baseFingerprint = similarFiles[0]!.videoFingerprint;
            const compareFingerprint = file.videoFingerprint;

            if (baseFingerprint && compareFingerprint) {
              return calculateVideoSimilarity(
                baseFingerprint,
                compareFingerprint
              );
            }
            return 0;
          })
        );

        groups.push({
          id: `video-similar-${similarFiles[0]!.hash}`,
          type: "video",
          files: similarFiles,
          similarity: Math.round(maxSimilarity),
        });
      }
    }
  }

  // 4. 동영상 크기 기반 중복 (fingerprint가 없는 경우의 fallback)
  const videoFilesWithoutFingerprint = files.filter(
    (f) => isVideo(f.name) && !f.videoFingerprint && !processedFiles.has(f.path)
  );

  const sizeGroups = new Map<number, DuplicateFile[]>();
  for (const file of videoFilesWithoutFingerprint) {
    if (!sizeGroups.has(file.size)) {
      sizeGroups.set(file.size, []);
    }
    sizeGroups.get(file.size)!.push(file);
  }

  for (const [size, groupFiles] of sizeGroups) {
    if (groupFiles.length > 1) {
      groups.push({
        id: `size-${size}`,
        type: "video",
        files: groupFiles,
        similarity: 95, // 크기가 같으면 95% 유사하다고 가정
      });
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}
