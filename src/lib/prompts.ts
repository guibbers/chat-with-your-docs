import type { RetrievedChunk } from "@/lib/retrieval";
import type { ChatMessage } from "@/types/chat";

const BASE_RULES = `Regras:
- Responda no idioma em que a pergunta foi feita.
- Seja direto: sem preâmbulo, sem repetir a pergunta.
- Quando não souber, diga que não sabe. Nunca invente fatos, números ou fontes.
- Use markdown quando ajudar a leitura (listas, código), mas não exagere.`;

/** Acervo vazio: ninguém enviou documento nenhum ainda. */
export const EMPTY_LIBRARY_PROMPT = `Você é o assistente do rag-notes, um app onde a pessoa conversa com os próprios documentos.

${BASE_RULES}

Ainda não há documentos enviados. Se perguntarem sobre o conteúdo de algum
documento, explique que é preciso enviar um arquivo primeiro.`;

/**
 * Há documentos, mas nenhum trecho relevante para esta pergunta.
 *
 * Sem esta instrução o modelo responde de conhecimento geral como se nada
 * tivesse acontecido, e a pessoa não tem como saber que a resposta não saiu
 * dos documentos dela — exatamente o tipo de ambiguidade que um app de
 * citações existe para eliminar.
 */
export const NO_MATCH_PROMPT = `Você é o assistente do rag-notes, um app onde a pessoa conversa com os próprios documentos.

${BASE_RULES}

Há documentos no acervo, mas nenhum trecho deles é relevante para esta pergunta.
Comece a resposta deixando claro que ela NÃO veio dos documentos enviados. Só
então responda com conhecimento geral, se souber.`;

/**
 * Instruções para responder a partir dos trechos recuperados.
 *
 * O ponto crítico é a citação: sem uma marcação que o modelo consiga produzir
 * de forma confiável, não há como ligar a resposta à fonte, e o app perde
 * justamente o que o diferencia de um chat comum.
 */
export const RAG_SYSTEM_PROMPT = `Você é o assistente do rag-notes. Responda usando SOMENTE os trechos numerados fornecidos abaixo.

Regras:
- Cite a origem de cada afirmação com a marcação [n], onde n é o número do trecho. Exemplo: "O prazo é de 30 dias [2]."
- Se a resposta usar mais de um trecho, cite todos: "[1][3]".
- Se os trechos não contiverem a resposta, diga exatamente isso — que os documentos enviados não cobrem a pergunta. NÃO complete com conhecimento próprio e NÃO invente citações.
- Responda no idioma em que a pergunta foi feita.
- Seja direto: sem preâmbulo, sem repetir a pergunta.
- Use markdown quando ajudar a leitura, mas não exagere.`;

/**
 * Conversa sem trechos recuperados. O prompt muda conforme o acervo esteja
 * vazio ou apenas sem nada relevante — são situações diferentes para quem
 * está lendo a resposta.
 */
export function buildConversation(
  history: ChatMessage[],
  { hasDocuments }: { hasDocuments: boolean },
): ChatMessage[] {
  return [
    { role: "system", content: hasDocuments ? NO_MATCH_PROMPT : EMPTY_LIBRARY_PROMPT },
    ...history,
  ];
}

/**
 * Monta a conversa com o contexto recuperado.
 *
 * Os trechos entram como mensagem de sistema, e não coladas na pergunta do
 * usuário: assim o histórico que volta ao cliente continua sendo o que a
 * pessoa realmente escreveu, e o contexto é remontado a cada turno com os
 * trechos relevantes para a pergunta da vez.
 */
export function buildRagConversation(
  history: ChatMessage[],
  chunks: RetrievedChunk[],
): ChatMessage[] {
  return [
    { role: "system", content: RAG_SYSTEM_PROMPT },
    { role: "system", content: formatContext(chunks) },
    ...history,
  ];
}

/** Numera os trechos na mesma ordem em que a UI vai listar as fontes. */
export function formatContext(chunks: RetrievedChunk[]): string {
  const blocks = chunks.map(
    (chunk, position) =>
      `[${position + 1}] ${chunk.title} — trecho ${chunk.chunkIndex + 1}\n${chunk.content}`,
  );

  return `Trechos recuperados dos documentos:\n\n${blocks.join("\n\n---\n\n")}`;
}
