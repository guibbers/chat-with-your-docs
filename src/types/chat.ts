import type { Source } from "@/types/rag";

/** Papéis aceitos numa conversa. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/**
 * Uma mensagem no formato que o OpenRouter espera.
 *
 * Os campos extras existem para o ciclo de tool calling: o turno do assistente
 * que pede a ferramenta carrega `tool_calls`, e a resposta da ferramenta volta
 * como uma mensagem `tool` amarrada pelo `tool_call_id`.
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/**
 * Eventos que a rota `/api/chat` envia ao cliente, um JSON por linha (NDJSON).
 *
 * Formato de evento em vez de texto puro porque a resposta vai carregar mais do
 * que tokens quando o RAG entrar: as citações das fontes viajam no mesmo stream.
 */
export type ChatStreamEvent =
  | { type: "token"; value: string }
  | { type: "searching"; query: string }
  | { type: "sources"; sources: Source[] }
  | { type: "error"; message: string }
  | { type: "done" };
