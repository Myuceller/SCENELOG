import { errorResponse } from "@/server/http/errors";
import { getMovie } from "@/server/movies/service";
import { parseMovieId } from "@/server/movies/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    return Response.json({ data: await getMovie(parseMovieId(id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
