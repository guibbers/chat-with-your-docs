import { env } from "@/lib/env";
import { readSseStream } from "@/lib/sse";
import type { ChatMessage } from "@/types/chat";
import type { CompletionEvent, ToolDefinition } from "@/types/tools";

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
    delta?: {
      content?: string | null;
      tool_calls?: ToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

/**
 * Fragmento de tool call. O modelo emite o nome uma vez e depois vai
 * cuspindo os argumentos em pedaços, todos identificados pelo mesmo `index`.
 */
interface ToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

/**
 * Chama o OpenRouter em modo stream e emite eventos conforme chegam.
 *
 * Texto sai token a token, na hora. Tool calls só saem no fim: chegam
 * fatiadas em vários chunks (o JSON dos argumentos vem em pedaços) e não
 * significam nada até estarem completas.
 */
export async function* streamChatCompletion({
  messages,
  model,
  temperature = 0.3,
  tools,
  signal,
}: StreamChatOptions): AsyncGenerator<CompletionEvent> {
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
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
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

  // Acumulador de tool calls, indexado pelo `index` que o modelo manda.
  const pending = new Map<number, { id: string; name: string; arguments: string }>();

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

    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) yield { type: "text", value: delta.content };

    for (const call of delta.tool_calls ?? []) {
      const current = pending.get(call.index) ?? { id: "", name: "", arguments: "" };

      pending.set(call.index, {
        id: call.id ?? current.id,
        name: call.function?.name ?? current.name,
        // Os argumentos chegam fatiados e precisam ser concatenados na ordem.
        arguments: current.arguments + (call.function?.arguments ?? ""),
      });
    }
  }

  if (pending.size > 0) {
    yield {
      type: "tool_calls",
      calls: [...pending.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, call]) => call),
    };
  }
}
