import { MissingEnvError } from "@/lib/env";
import { countDocuments } from "@/lib/ingest";
import { OpenRouterError, streamChatCompletion } from "@/lib/openrouter";
import { buildConversation, buildRagConversation } from "@/lib/prompts";
import { searchChunks, toSource } from "@/lib/retrieval";
import { parseChatRequest } from "@/lib/validation";
import type { ChatStreamEvent } from "@/types/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Corpo da requisição não é um JSON válido.", 400);
  }

  const parsed = parseChatRequest(body);

  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const history = parsed.value;
  const question = history.at(-1)!.content;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // O cliente desconectou no meio da resposta.
          closed = true;
        }
      };

      try {
        // A busca acontece antes do primeiro token: as fontes são enviadas
        // primeiro para que a UI já mostre de onde a resposta vai sair.
        const chunks = await searchChunks(question, { signal: request.signal });

        if (chunks.length > 0) {
          send({ type: "sources", sources: chunks.map(toSource) });
        }

        const conversation =
          chunks.length > 0
            ? buildRagConversation(history, chunks)
            : buildConversation(history, {
                // Distingue "acervo vazio" de "nada relevante achado".
                hasDocuments: (await countDocuments()) > 0,
              });

        for await (const token of streamChatCompletion({
          messages: conversation,
          signal: request.signal,
        })) {
          send({ type: "token", value: token });
        }

        send({ type: "done" });
      } catch (error) {
        // O erro vai pelo stream, não pelo status: os headers já foram enviados.
        if (!isAbort(error)) {
          console.error("[api/chat]", error);
          send({ type: "error", message: toUserMessage(error) });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Já fechado pelo cliente.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Impede buffering em proxies, que atrasaria o streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Traduz a falha para algo que faça sentido na tela, sem vazar segredo. */
function toUserMessage(error: unknown): string {
  if (error instanceof MissingEnvError) {
    return "O servidor está sem a chave da API configurada.";
  }

  if (error instanceof OpenRouterError) {
    if (error.status === 401) return "Chave da API do OpenRouter inválida.";
    if (error.status === 402) return "Créditos insuficientes no OpenRouter.";
    if (error.status === 429) return "Muitas requisições. Tente de novo em instantes.";
    return "O provedor do modelo falhou. Tente de novo.";
  }

  return "Não consegui gerar a resposta. Tente de novo.";
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
