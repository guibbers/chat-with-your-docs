import "server-only";

import { countDocuments } from "@/lib/ingest";
import { searchChunks, type RetrievedChunk } from "@/lib/retrieval";
import type { ToolCall, ToolDefinition } from "@/types/tools";

export const BUSCAR_DOCS = "buscar_docs";

/**
 * A única ferramenta do app.
 *
 * A descrição é o que o modelo lê para decidir se chama ou não — então ela diz
 * tanto quando usar quanto quando NÃO usar. Sem a segunda parte, o modelo
 * chama a busca até para "oi", gastando uma requisição de embedding à toa.
 */
export const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: BUSCAR_DOCS,
      description:
        "Busca trechos relevantes nos documentos que o usuário enviou. " +
        "Use sempre que a pergunta puder ser respondida pelo conteúdo dos documentos, " +
        "inclusive em perguntas de acompanhamento — cada busca é independente, então " +
        "reformule a consulta incluindo o contexto da conversa. " +
        "NÃO use para saudações, agradecimentos ou perguntas sobre o próprio app.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description:
              "O que procurar, em linguagem natural. Descreva o assunto em vez de " +
              "repetir a pergunta literal — a busca é semântica, não por palavra-chave.",
          },
        },
        required: ["consulta"],
        additionalProperties: false,
      },
    },
  },
];

export interface ToolResult {
  /** Texto que volta para o modelo como conteúdo da mensagem `tool`. */
  content: string;
  /** Trechos recuperados, para virarem citação na UI. */
  chunks: RetrievedChunk[];
}

/**
 * Executa uma chamada de ferramenta.
 *
 * Erro aqui não derruba a conversa: vira texto de resposta da ferramenta, e o
 * modelo decide o que dizer. Um JSON de argumentos malformado é falha comum o
 * suficiente para não merecer um 500.
 */
export interface ExecuteOptions {
  signal?: AbortSignal;
  /**
   * Número da primeira citação deste resultado.
   *
   * O modelo pode buscar mais de uma vez no mesmo turno. Se cada resultado
   * fosse numerado a partir de [1], duas buscas produziriam dois trechos
   * diferentes chamados [1] — e a citação deixaria de identificar a fonte.
   */
  numberFrom?: number;
}

export async function executeTool(
  call: ToolCall,
  { signal, numberFrom = 1 }: ExecuteOptions = {},
): Promise<ToolResult> {
  if (call.name !== BUSCAR_DOCS) {
    return { content: `Ferramenta desconhecida: ${call.name}.`, chunks: [] };
  }

  let consulta: unknown;

  try {
    consulta = (JSON.parse(call.arguments || "{}") as { consulta?: unknown }).consulta;
  } catch {
    return {
      content: "Não entendi os argumentos da busca. Tente reformular a consulta.",
      chunks: [],
    };
  }

  if (typeof consulta !== "string" || !consulta.trim()) {
    return { content: "A consulta veio vazia.", chunks: [] };
  }

  const chunks = await searchChunks(consulta, { signal });

  if (chunks.length === 0) {
    // "Não achei" e "não há o que achar" levam a respostas diferentes, e só o
    // segundo caso justifica pedir que a pessoa envie um arquivo.
    const total = await countDocuments();

    return {
      content:
        total === 0
          ? "O acervo está vazio: nenhum documento foi enviado ainda."
          : "Nenhum trecho relevante encontrado nos documentos enviados para esta consulta.",
      chunks: [],
    };
  }

  return { content: formatToolContent(chunks, numberFrom), chunks };
}

/** Numera os trechos para o modelo citar com [n]. */
function formatToolContent(chunks: RetrievedChunk[], numberFrom: number): string {
  return chunks
    .map(
      (chunk, position) =>
        `[${numberFrom + position}] ${chunk.title} — trecho ${chunk.chunkIndex + 1}\n` +
        chunk.content,
    )
    .join("\n\n---\n\n");
}
