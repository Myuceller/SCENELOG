import { authenticate } from "@/server/auth/authenticate";
import { createArchiveRepository } from "@/server/archive/repository";
import { createWatchlistHandler } from "@/server/archive/handlers";

export const runtime = "nodejs";
export const PUT = createWatchlistHandler({ authenticate, repository: createArchiveRepository() });
