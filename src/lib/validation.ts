import type { ChatMessage } from "@/types/chat";

/** Quantas mensagens do histórico o cliente pode mandar de uma vez. */
export const MAX_MESSAGES = 30;

/** Teto de caracteres por mensagem — evita estourar contexto e custo à toa. */
export const MAX_CONTENT_LENGTH = 8_000;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Valida o corpo de `POST /api/chat`.
 *
 * O cliente só pode mandar turnos de `user` e `assistant`: o system prompt é
 * montado no servidor, senão qualquer um sobrescreveria as instruções.
 */
export function parseChatRequest(body: unknown): ValidationResult<ChatMessage[]> {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return { ok: false, error: "Envie um objeto com a lista `messages`." };
  }

  const { messages } = body;

  if (messages.length === 0) {
    return { ok: false, error: "A conversa está vazia." };
  }

  if (messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: `A conversa passou de ${MAX_MESSAGES} mensagens. Comece uma nova.`,
    };
  }

  const parsed: ChatMessage[] = [];

  for (const message of messages) {
    if (!isRecord(message)) {
      return { ok: false, error: "Mensagem em formato inválido." };
    }

    const { role, content } = message;

    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: `Papel de mensagem não permitido: ${String(role)}.` };
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, error: "Mensagem sem conteúdo." };
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        error: `Mensagem longa demais (limite de ${MAX_CONTENT_LENGTH} caracteres).`,
      };
    }

    parsed.push({ role, content: content.trim() });
  }

  if (parsed.at(-1)?.role !== "user") {
    return { ok: false, error: "A última mensagem precisa ser do usuário." };
  }

  return { ok: true, value: parsed };
}
