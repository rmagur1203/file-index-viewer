import { Hono } from "hono";
import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { VIDEO_ROOT } from "../lib/config";
import { safePath } from "../lib/sudo-fs";
import { getContentType, isText } from "../lib/utils";

const media = new Hono();

// GET /api/media/* - 미디어 파일 스트리밍
media.get("/*", async (c) => {
  try {
    // URL 경로에서 파일 경로 추출
    const requestedPath = c.req.path.replace("/api/media/", "") || "/";
    const fullPath = safePath(VIDEO_ROOT, requestedPath);

    const stats = await fs.stat(fullPath);

    if (!stats.isFile()) {
      return c.json({ error: "File not found" }, 404);
    }

    const range = c.req.header("range");
    const fileSize = stats.size;
    const contentType = getContentType(fullPath);

    // 텍스트 파일인 경우 인코딩 감지 및 변환
    if (isText(fullPath)) {
      const fileBuffer = await fs.readFile(fullPath);

      // 간단한 인코딩 감지 (jschardet와 iconv-lite 대신 기본 구현)
      // 나중에 필요하면 해당 패키지들을 추가할 수 있습니다
      let content: string;
      try {
        content = fileBuffer.toString("utf-8");
      } catch {
        // UTF-8 실패 시 기본 인코딩으로 시도
        content = fileBuffer.toString("latin1");
      }

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Length": Buffer.byteLength(content, "utf-8").toString(),
        },
      });
    }

    if (range && contentType.startsWith("video/")) {
      // Range 요청 처리 (비디오 스트리밍)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(fullPath, { start, end });

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
        },
      });
    } else {
      // 전체 파일 전송
      const stream = createReadStream(fullPath);

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": contentType,
        },
      });
    }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return c.json({ error: "File not found" }, 404);
    }
    if (error.message.startsWith("Access denied")) {
      return c.json({ error: error.message }, 403);
    }
    console.error("Error serving media:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default media;
