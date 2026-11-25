import "server-only";
import { errorResponse } from "@/server/http/errors";
import { ServerTiming } from "@/server/http/server-timing";
import { readArchiveBody, readRecordBody, readWatchlistBody } from "./schema";
import type { ArchiveResponse, ArchiveWrite, RecordResponse, RecordWrite, WatchlistWrite, WatchlistResponse } from "@/types/archive";

interface Dependencies {
  authenticate: (request: Request) => Promise<{ id: string }>;
  repository: { read: (id: string, timing?: ServerTiming) => Promise<ArchiveResponse>; write: (id: string, body: ArchiveWrite) => Promise<ArchiveResponse> };
}

export function createRecordHandler({ authenticate, repository }: {
  authenticate: Dependencies["authenticate"];
  repository: { writeLog: (id: string, body: RecordWrite) => Promise<RecordResponse> };
}) {
  return async (request: Request) => {
    try {
      const user = await authenticate(request);
      const body = await readRecordBody(request);
      return Response.json(await repository.writeLog(user.id, body), {
        headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
      });
    } catch (error) { return errorResponse(error); }
  };
}
export function createWatchlistHandler({ authenticate, repository }: {
  authenticate: Dependencies["authenticate"];
  repository: { writeWatchlist: (id: string, body: WatchlistWrite) => Promise<WatchlistResponse> };
}) {
  return async (request: Request) => {
    try {
      const user = await authenticate(request);
      const body = await readWatchlistBody(request);
      return Response.json(await repository.writeWatchlist(user.id, body), {
        headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
      });
    } catch (error) { return errorResponse(error); }
  };
}
export function createArchiveHandlers({ authenticate, repository }: Dependencies) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  return {
    async GET(request: Request) {
      const timing = new ServerTiming();
      try {
        const user = await timing.measure("auth", () => authenticate(request));
        const archive = await timing.measure("archive", () => repository.read(user.id, timing));
        return timing.finish(timing.measureSync("serialize", () => Response.json(archive, { headers })));
      } catch (error) { return timing.finish(errorResponse(error)); }
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
