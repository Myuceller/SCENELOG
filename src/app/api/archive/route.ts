import { authenticate } from "@/server/auth/authenticate";
import { createArchiveRepository } from "@/server/archive/repository";
import { createArchiveHandlers } from "@/server/archive/handlers";

export const runtime = "nodejs";
const handlers = createArchiveHandlers({ authenticate, repository: createArchiveRepository() });
export const GET = handlers.GET;
export const PUT = handlers.PUT;
