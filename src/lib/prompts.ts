import type { ChatMessage } from "@/types/chat";

/**
 * Instruções do sistema. Por enquanto cobrem só a conversa; na etapa de RAG
 * ganham as regras de citação das fontes.
 */
export const SYSTEM_PROMPT = `Você é o assistente do rag-notes, um app onde a pessoa conversa com os próprios documentos.

Regras:
- Responda no idioma em que a pergunta foi feita.
- Seja direto: sem preâmbulo, sem repetir a pergunta.
- Quando não souber, diga que não sabe. Nunca invente fatos, números ou fontes.
- Use markdown quando ajudar a leitura (listas, código), mas não exagere.`;

/** Prefixa o histórico do cliente com o system prompt do servidor. */
export function buildConversation(history: ChatMessage[]): ChatMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}
