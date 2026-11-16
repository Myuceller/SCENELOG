import "server-only";
import type { ApiErrorResponse } from "@/types/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 외부 응답 본문, 토큰, 스택 등 내부 정보는 클라이언트에 전달하지 않습니다. */
export function errorResponse(error: unknown): Response {
  const safeError = error instanceof ApiError
    ? error
    : new ApiError(500, "INTERNAL_ERROR", "요청을 처리하지 못했습니다.");

  return Response.json(
    { error: { code: safeError.code, message: safeError.message } } satisfies ApiErrorResponse,
    { status: safeError.status, headers: { "Cache-Control": "no-store" } },
  );
}
