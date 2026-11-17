import { errorResponse } from "@/server/http/errors";
import { getPerson, parsePersonId } from "@/server/people/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    return Response.json({ data: await getPerson(parsePersonId(id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
