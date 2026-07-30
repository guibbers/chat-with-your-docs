import { env } from "@/lib/env";
import { readSseStream } from "@/lib/sse";
import type { ChatMessage } from "@/types/chat";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Erro vindo da API do OpenRouter, já com o status para tratar na rota. */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

/** Formato do chunk de streaming (subconjunto do que usamos). */
interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * Chama o OpenRouter em modo stream e devolve os deltas de texto conforme
 * chegam. O consumidor decide o que fazer com cada pedaço.
 */
export async function* streamChatCompletion({
  messages,
  model,
  temperature = 0.3,
  signal,
}: StreamChatOptions): AsyncGenerator<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      // Headers opcionais do OpenRouter: identificam o app no ranking deles.
      "HTTP-Referer": env.siteUrl,
      "X-Title": "rag-notes",
    },
    body: JSON.stringify({
      model: model ?? env.openRouterModel,
      messages,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new OpenRouterError(
      `OpenRouter respondeu ${response.status}`,
      response.status,
      detail.slice(0, 500),
    );
  }

  for await (const payload of readSseStream(response.body)) {
    let chunk: StreamChunk;

    try {
      chunk = JSON.parse(payload) as StreamChunk;
    } catch {
      // Payload malformado é raro e não vale derrubar a resposta inteira.
      continue;
    }

    // O OpenRouter pode reportar erro de provider no meio do stream.
    if (chunk.error) {
      throw new OpenRouterError(
        chunk.error.message ?? "Falha no provider durante o streaming.",
        502,
      );
    }

    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
