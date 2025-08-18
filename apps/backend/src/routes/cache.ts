import { Hono } from "hono";
import { getFileCache } from "../lib/file-cache";

const cache = new Hono();

// GET /api/cache - 캐시 통계 조회
cache.get("/", async (c) => {
  try {
    const fileCache = await getFileCache();
    const stats = await fileCache.getCacheStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return c.json({ error: "Failed to get cache stats" }, 500);
  }
});

// DELETE /api/cache - 캐시 정리
cache.delete("/", async (c) => {
  try {
    const directory = c.req.query("directory");
    const daysStr = c.req.query("days");
    const days = daysStr ? parseInt(daysStr) : 30;

    if (!directory) {
      return c.json({ error: "Directory parameter is required" }, 400);
    }

    const fileCache = await getFileCache();
    await fileCache.cleanupOldCache(directory, days);

    const newStats = await fileCache.getCacheStats();

    return c.json({
      success: true,
      message: `Cleaned up cache entries older than ${days} days for directory: ${directory}`,
      stats: newStats,
    });
  } catch (error) {
    console.error("Error cleaning up cache:", error);
    return c.json({ error: "Failed to cleanup cache" }, 500);
  }
});

export default cache;
