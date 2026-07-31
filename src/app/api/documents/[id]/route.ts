import { deleteDocument } from "@/lib/ingest";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID.test(id)) {
    return Response.json({ error: "Identificador inválido." }, { status: 400 });
  }

  try {
    await deleteDocument(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[api/documents DELETE]", error);
    return Response.json({ error: "Não consegui apagar o documento." }, { status: 500 });
  }
}
