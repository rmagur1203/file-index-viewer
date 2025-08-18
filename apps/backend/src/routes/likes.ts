import { Hono } from "hono";
import { getLikeCache } from "../lib/like-cache";

const likes = new Hono();

// likes API 구현
likes.get("/", async (c) => {
  try {
    const likeCache = await getLikeCache();
    const allLikes = await likeCache.getAllLikes();
    return c.json(allLikes);
  } catch (error) {
    console.error("Error getting likes:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

likes.post("/", async (c) => {
  try {
    const { path } = await c.req.json();
    if (typeof path !== "string") {
      return c.json({ error: "Invalid path" }, 400);
    }

    const likeCache = await getLikeCache();
    await likeCache.addLike(path);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error adding like:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

likes.delete("/*", async (c) => {
  try {
    // URL 경로에서 파일 경로 추출
    const urlPath = c.req.path.replace("/api/likes", "") || "/";
    const filePath = decodeURIComponent(urlPath);

    const likeCache = await getLikeCache();
    await likeCache.removeLike(filePath);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing like:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default likes;
