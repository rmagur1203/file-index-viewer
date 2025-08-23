import { Hono } from "hono";
import { getRecommendationEngine } from "../lib/recommendation-engine";

const recommendations = new Hono();

// 추천 파일 목록 가져오기
recommendations.get("/", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "20");
    const minSimilarity = parseFloat(c.req.query("minSimilarity") || "0.3");
    const fileTypes = c.req.query("fileTypes")?.split(",") || [
      "image",
      "video",
    ];

    const engine = await getRecommendationEngine();
    const recommendations = await engine.generateRecommendations({
      limit,
      minSimilarity,
      fileTypes: fileTypes as ("image" | "video" | "text")[],
    });

    // 좋아요 기반 추천이 없을 때 일반 추천 제공
    if (recommendations.length === 0) {
      const generalRecommendations =
        await engine.generateGeneralRecommendations({
          limit,
          minSimilarity,
          fileTypes: fileTypes as ("image" | "video" | "text")[],
        });
      return c.json(generalRecommendations);
    }

    return c.json(recommendations);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// 추천 통계 정보 가져오기
recommendations.get("/stats", async (c) => {
  try {
    const engine = await getRecommendationEngine();
    const stats = await engine.getRecommendationStats();
    return c.json(stats);
  } catch (error) {
    console.error("Error getting recommendation stats:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// 특정 파일과 유사한 추천 가져오기
recommendations.post("/similar", async (c) => {
  try {
    const { filePath, limit = 10 } = await c.req.json();

    if (typeof filePath !== "string") {
      return c.json({ error: "Invalid file path" }, 400);
    }

    const engine = await getRecommendationEngine();
    // 특정 파일을 기반으로 한 추천은 별도 구현 예정
    // 현재는 일반 추천으로 대체
    const recommendations = await engine.generateRecommendations({
      limit,
    });

    return c.json(recommendations);
  } catch (error) {
    console.error("Error generating similar recommendations:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default recommendations;
