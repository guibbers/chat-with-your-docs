import "server-only";

import { embedOne } from "@/lib/embeddings";
import { getSupabase } from "@/lib/supabase";
import type { Source } from "@/types/rag";

/** Quantos trechos recuperar por pergunta. */
export const DEFAULT_MATCH_COUNT = 5;

/**
 * Piso de similaridade. Abaixo disso o trecho é ruído: o cosseno sempre
 * devolve *algum* vizinho mais próximo, mesmo quando nada no acervo tem a ver
 * com a pergunta. Sem esse corte, o modelo receberia contexto irrelevante e
 * citaria fontes que não respondem nada.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

/** Tamanho do trecho mostrado na citação. */
const EXCERPT_CHARS = 240;

interface MatchRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  title: string;
  source_name: string;
  similarity: number;
}

export interface SearchOptions {
  matchCount?: number;
  similarityThreshold?: number;
  signal?: AbortSignal;
}

/**
 * O trecho recuperado carrega o conteúdo completo, que vai para o contexto do
 * modelo. Para o browser só sobe o resumo (`Source`) — mandar o chunk inteiro
 * seria trafegar de novo um texto que o usuário já tem.
 */
export interface RetrievedChunk extends Source {
  content: string;
}

/** Descarta o conteúdo completo, deixando só o que a UI precisa mostrar. */
export function toSource(chunk: RetrievedChunk): Source {
  return {
    documentId: chunk.documentId,
    title: chunk.title,
    sourceName: chunk.sourceName,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    excerpt: chunk.excerpt,
  };
}

/** Busca semântica: transforma a pergunta em vetor e pede os vizinhos ao banco. */
export async function searchChunks(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const embedding = await embedOne(question, options.signal);

  const { data, error } = await getSupabase().rpc("match_chunks", {
    query_embedding: embedding,
    match_count: options.matchCount ?? DEFAULT_MATCH_COUNT,
    similarity_threshold:
      options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
  });

  if (error) throw new Error(`Falha na busca semântica: ${error.message}`);

  return ((data ?? []) as MatchRow[]).map((row) => ({
    documentId: row.document_id,
    title: row.title,
    sourceName: row.source_name,
    chunkIndex: row.chunk_index,
    similarity: row.similarity,
    excerpt: excerpt(row.content),
    content: row.content,
  }));
}

function excerpt(content: string): string {
  const single = content.replace(/\s+/g, " ").trim();

  return single.length <= EXCERPT_CHARS
    ? single
    : `${single.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}
