import { Hono } from "hono";
import { cors } from "hono/cors";

// API 라우트 임포트
import files from "./src/routes/files";
import likes from "./src/routes/likes";
import duplicates from "./src/routes/duplicates";
import thumbnail from "./src/routes/thumbnail";
import aiRecommendations from "./src/routes/ai-recommendations";
import cache from "./src/routes/cache";
import media from "./src/routes/media";

const app = new Hono();

// CORS 설정
app.use(
  "*",
  cors({
    origin: (c) => c,
    credentials: true,
  })
);

// 헬스체크 엔드포인트
app.get("/", (c) => {
  return c.json({ message: "Backend API Server is running!" });
});

// API 라우트 그룹
const api = new Hono();

// 헬스체크
api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API 라우트 연결
api.route("/files", files);
api.route("/likes", likes);
api.route("/duplicates", duplicates);
api.route("/thumbnail", thumbnail);
api.route("/ai-recommendations", aiRecommendations);
api.route("/cache", cache);
api.route("/media", media);

// API 라우트를 메인 앱에 마운트
app.route("/api", api);

const port = process.env.PORT || 3001;

console.log(`🚀 Backend server starting on port ${port}`);
console.log(`📁 Files API: http://localhost:${port}/api/files`);
console.log(`👍 Likes API: http://localhost:${port}/api/likes`);
console.log(`🔍 Duplicates API: http://localhost:${port}/api/duplicates`);
console.log(`🖼️ Thumbnail API: http://localhost:${port}/api/thumbnail`);
console.log(
  `🤖 AI Recommendations API: http://localhost:${port}/api/ai-recommendations`
);
console.log(`📦 Cache API: http://localhost:${port}/api/cache`);
console.log(`🎬 Media API: http://localhost:${port}/api/media`);

export default {
  port,
  fetch: app.fetch,
};
