import { Hono } from "hono";
import path from "path";
import { sudoStat, sudoReaddir, safePath } from "../lib/sudo-fs";
import { VIDEO_ROOT } from "../lib/config";
import { getMediaType } from "../lib/utils";

const files = new Hono();

async function getFileInfo(filePath: string) {
  const fullPath = safePath(VIDEO_ROOT, filePath);
  const name = path.basename(fullPath);
  try {
    const itemStats = await sudoStat(fullPath);
    return {
      name,
      type: "file",
      size: itemStats.size,
      modifiedAt: itemStats.mtime.toISOString(),
      path: filePath,
      mediaType: getMediaType(name) || "text",
    };
  } catch (error) {
    console.error(`Error getting stats for ${fullPath}:`, error);
    return {
      name,
      type: "file",
      size: undefined,
      modifiedAt: new Date().toISOString(),
      path: filePath,
      mediaType: "text",
      accessDenied: true,
    };
  }
}

// POST /api/files - 파일 정보 조회 (여러 경로)
files.post("/", async (c) => {
  try {
    const { paths } = await c.req.json();
    if (!Array.isArray(paths)) {
      return c.json({ error: "Paths must be an array" }, 400);
    }

    const files = await Promise.all(paths.map((p) => getFileInfo(p as string)));
    const validFiles = files.filter(Boolean);

    return c.json({ files: validFiles });
  } catch (error) {
    console.error("Error getting file details:", error);
    return c.json({ error: "Failed to get file details" }, 500);
  }
});

// GET /api/files - 디렉토리 파일 목록 조회
files.get("/", async (c) => {
  try {
    const requestedPath = c.req.query("path") || "/";

    // 보안: 상위 디렉토리 접근 방지 및 안전한 경로 생성
    const fullPath = safePath(VIDEO_ROOT, requestedPath);

    const stats = await sudoStat(fullPath);

    if (!stats.isDirectory()) {
      return c.json({ error: "Not a directory" }, 400);
    }

    const items = await sudoReaddir(fullPath);

    const files = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(fullPath, item.name);
        const relativePath = path.posix
          .join(requestedPath, item.name)
          .replace(/\\/g, "/");

        try {
          const itemStats = await sudoStat(itemPath);

          return {
            name: item.name,
            type: item.isDirectory() ? "directory" : "file",
            size: item.isFile() ? itemStats.size : undefined,
            modified: itemStats.mtime.toISOString(),
            path: relativePath.startsWith("/")
              ? relativePath
              : "/" + relativePath,
            mediaType:
              (item.isFile() ? getMediaType(item.name) : undefined) || "text",
          };
        } catch (error) {
          console.error(`Error getting stats for ${itemPath}:`, error);
          // 권한 문제로 접근할 수 없는 파일도 목록에는 표시하되 제한된 정보만 제공
          return {
            name: item.name,
            type: item.isDirectory() ? "directory" : "file",
            size: undefined,
            modified: new Date().toISOString(),
            path: relativePath.startsWith("/")
              ? relativePath
              : "/" + relativePath,
            mediaType: "text",
            accessDenied: true,
          };
        }
      })
    );

    const validFiles = files.filter(Boolean).sort((a, b) => {
      // 폴더를 먼저, 그 다음 파일을 알파벳 순으로
      if (a!.type !== b!.type) {
        return a!.type === "directory" ? -1 : 1;
      }
      return a!.name.localeCompare(b!.name);
    });

    return c.json({ files: validFiles });
  } catch (error) {
    console.error("Error reading directory:", error);
    return c.json({ error: "Failed to read directory" }, 500);
  }
});

// GET /api/files/tree - 폴더 트리 구조 조회
files.get("/tree", async (c) => {
  try {
    interface FolderTree {
      [key: string]: FolderTree;
    }

    async function buildFolderTree(
      dirPath: string,
      maxDepth = 3,
      currentDepth = 0
    ): Promise<FolderTree> {
      if (currentDepth >= maxDepth) return {};

      try {
        const items = await sudoReaddir(dirPath);
        const tree: FolderTree = {};

        for (const item of items) {
          if (item.isDirectory()) {
            const subPath = path.join(dirPath, item.name);
            tree[item.name] = await buildFolderTree(
              subPath,
              maxDepth,
              currentDepth + 1
            );
          }
        }

        return tree;
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        return {};
      }
    }

    const tree = await buildFolderTree(VIDEO_ROOT);
    return c.json({ tree });
  } catch (error) {
    console.error("Error building folder tree:", error);
    return c.json({ error: "Failed to build folder tree" }, 500);
  }
});

export default files;
