import { errorResponse } from "@/server/http/errors";
import { getMovies } from "@/server/movies/service";
import { parseMovieListParams } from "@/server/movies/validation";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = parseMovieListParams(new URL(request.url).searchParams);
    return Response.json(await getMovies(params), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
