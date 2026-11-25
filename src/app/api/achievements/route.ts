import { createAchievementHandlers } from "@/server/achievements/handlers";
export const runtime = "nodejs";
export const { GET, PUT } = createAchievementHandlers();
