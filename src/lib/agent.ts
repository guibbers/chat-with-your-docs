import "server-only";

import { listDocumentTitles } from "@/lib/ingest";
import { streamChatCompletion } from "@/lib/openrouter";
import { buildAgentPrompt } from "@/lib/prompts";
import type { RetrievedChunk } from "@/lib/retrieval";
import { executeTool, TOOLS } from "@/lib/tools";
import type { ChatMessage } from "@/types/chat";
import type { ToolCall } from "@/types/tools";

/**
 * Teto de idas ao modelo. Uma para decidir a busca, outra para responder —
 * a terceira é folga para o modelo refinar a consulta se a primeira vier
 * vazia. Sem teto, um modelo que insiste em buscar entra em laço infinito.
 */
const MAX_ROUNDS = 3;

export type AgentEvent =
  | { type: "text"; value: string }
  | { type: "sources"; chunks: RetrievedChunk[] }
  | { type: "searching"; query: string };

export interface RunAgentOptions {
  history: ChatMessage[];
  signal?: AbortSignal;
}

/**
 * Laço de tool calling: o modelo decide se busca nos documentos, e só então
 * responde.
 *
 * A diferença para buscar sempre antes é que o modelo passa a lidar com o que
 * não é pergunta ("oi", "obrigado") sem gastar uma busca, e a reformular a
 * consulta em perguntas de acompanhamento, onde a frase do usuário sozinha
 * ("e sobre isso?") não recupera nada.
 */
export async function* runAgent({
  history,
  signal,
}: RunAgentOptions): AsyncGenerator<AgentEvent> {
  // O inventário do acervo entra no prompt para o modelo decidir a busca
  // sabendo o que existe. Falha aqui não derruba a conversa: sem a lista ele
  // ainda funciona, só decide pior.
  const titles = await listDocumentTitles().catch((error) => {
    console.error("[agent] não consegui listar os títulos", error);
    return [];
  });

  const messages: ChatMessage[] = [
    { role: "system", content: buildAgentPrompt(titles) },
    ...history,
  ];

  // Quantos trechos já foram citados neste turno, para a numeração seguir
  // contínua entre buscas sucessivas.
  let citationOffset = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    // Na última rodada as ferramentas saem de cena: o modelo é obrigado a
    // responder com o que já tem, em vez de pedir mais uma busca que não
    // teria como executar.
    const isFinalRound = round === MAX_ROUNDS - 1;

    let assistantText = "";
    let toolCalls: ToolCall[] = [];

    for await (const event of streamChatCompletion({
      messages,
      tools: isFinalRound ? undefined : TOOLS,
      signal,
    })) {
      if (event.type === "text") {
        assistantText += event.value;
        yield { type: "text", value: event.value };
      } else {
        toolCalls = event.calls;
      }
    }

    // Sem chamada de ferramenta, o modelo já respondeu: acabou.
    if (toolCalls.length === 0) return;

    messages.push({
      role: "assistant",
      content: assistantText,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    for (const call of toolCalls) {
      yield { type: "searching", query: describeQuery(call.arguments) };

      const result = await executeTool(call, {
        signal,
        numberFrom: citationOffset + 1,
      });

      if (result.chunks.length > 0) {
        yield { type: "sources", chunks: result.chunks };
        citationOffset += result.chunks.length;
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.content,
      });
    }
  }
}

/** Só para mostrar na UI o que está sendo buscado. */
function describeQuery(rawArguments: string): string {
  try {
    const parsed = JSON.parse(rawArguments || "{}") as { consulta?: unknown };
    return typeof parsed.consulta === "string" ? parsed.consulta : "";
  } catch {
    return "";
  }
}

