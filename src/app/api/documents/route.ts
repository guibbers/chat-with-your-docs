import { MissingEnvError } from "@/lib/env";
import {
  ACCEPTED_EXTENSIONS,
  EmptyDocumentError,
  UnsupportedFileError,
} from "@/lib/extract";
import { FileTooLargeError, ingestDocument, listDocuments } from "@/lib/ingest";
import { OpenRouterError } from "@/lib/openrouter";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Lista os documentos já ingeridos. */
export async function GET() {
  try {
    return Response.json({ documents: await listDocuments() });
  } catch (error) {
    console.error("[api/documents GET]", error);
    return Response.json({ error: toUserMessage(error) }, { status: 500 });
  }
}

/** Recebe um arquivo, ingere e devolve o resumo do documento criado. */
export async function POST(request: Request) {
  let file: File | null = null;

  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return Response.json(
      { error: "Envio inválido. Use multipart/form-data com o campo `file`." },
      { status: 400 },
    );
  }

  if (!file || file.size === 0) {
    return Response.json(
      { error: `Nenhum arquivo enviado. Aceito ${ACCEPTED_EXTENSIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  // Teto mais apertado que o do chat: cada upload gera embeddings de dezenas
  // de chunks, então é o caminho mais caro que um visitante pode disparar.
  const limit = await hitRateLimit(`upload:${clientIp(request)}`, {
    max: 10,
    windowSeconds: 600,
  });

  if (!limit.allowed) {
    return Response.json(
      { error: `Muitos envios seguidos. Tente de novo em ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    return Response.json({ document: await ingestDocument(file) }, { status: 201 });
  } catch (error) {
    console.error("[api/documents POST]", error);
    return Response.json({ error: toUserMessage(error) }, { status: statusFor(error) });
  }
}

/** Erro do usuário é 400; o resto é problema nosso. */
function statusFor(error: unknown): number {
  if (
    error instanceof UnsupportedFileError ||
    error instanceof FileTooLargeError ||
    error instanceof EmptyDocumentError
  ) {
    return 400;
  }

  return 500;
}

function toUserMessage(error: unknown): string {
  if (
    error instanceof UnsupportedFileError ||
    error instanceof FileTooLargeError ||
    error instanceof EmptyDocumentError
  ) {
    return error.message;
  }

  if (error instanceof MissingEnvError) {
    return "O servidor está sem as credenciais configuradas.";
  }

  if (error instanceof OpenRouterError) {
    if (error.status === 401) return "Chave da API do OpenRouter inválida.";
    if (error.status === 402) return "Créditos insuficientes no OpenRouter.";
    if (error.status === 429) return "Muitas requisições. Tente de novo em instantes.";
    return "Falha ao gerar os embeddings. Tente de novo.";
  }

  return "Não consegui processar o arquivo. Tente de novo.";
}
