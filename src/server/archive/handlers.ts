import "server-only";
import { errorResponse } from "@/server/http/errors";
import { readArchiveBody } from "./schema";
import type { ArchiveResponse, ArchiveWrite } from "@/types/archive";

interface Dependencies {
  authenticate: (request: Request) => Promise<{ id: string }>;
  repository: { read: (id: string) => Promise<ArchiveResponse>; write: (id: string, body: ArchiveWrite) => Promise<ArchiveResponse> };
}
export function createArchiveHandlers({ authenticate, repository }: Dependencies) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  return {
    async GET(request: Request) {
      try {
        const user = await authenticate(request);
        return Response.json(await repository.read(user.id), { headers });
      } catch (error) { return errorResponse(error); }
    },
    async PUT(request: Request) {
      try {
        const user = await authenticate(request);
        const body = await readArchiveBody(request);
        return Response.json(await repository.write(user.id, body), { headers });
      } catch (error) { return errorResponse(error); }
    },
  };
}
