import { authenticate } from "@/server/auth/authenticate";
import { createArchiveRepository } from "@/server/archive/repository";
import { createRecordHandler } from "@/server/archive/handlers";

export const runtime = "nodejs";
export const PUT = createRecordHandler({ authenticate, repository: createArchiveRepository() });
