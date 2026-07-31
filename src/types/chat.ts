import type { Source } from "@/types/rag";

/** Papéis aceitos numa conversa. */
export type ChatRole = "system" | "user" | "assistant";

/** Uma mensagem no formato que o OpenRouter espera. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Eventos que a rota `/api/chat` envia ao cliente, um JSON por linha (NDJSON).
 *
 * Formato de evento em vez de texto puro porque a resposta vai carregar mais do
 * que tokens quando o RAG entrar: as citações das fontes viajam no mesmo stream.
 */
export type ChatStreamEvent =
  | { type: "token"; value: string }
  | { type: "sources"; sources: Source[] }
  | { type: "error"; message: string }
  | { type: "done" };
