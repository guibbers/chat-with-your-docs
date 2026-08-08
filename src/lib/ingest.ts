import "server-only";

import { chunkText } from "@/lib/chunking";
import { embedAll } from "@/lib/embeddings";
import { extractText, MAX_FILE_BYTES } from "@/lib/extract";
import { getSupabase } from "@/lib/supabase";
import type { DocumentSummary } from "@/types/rag";

export class FileTooLargeError extends Error {
  constructor(name: string) {
    super(
      `${name} passa de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB. Envie um arquivo menor.`,
    );
    this.name = "FileTooLargeError";
  }
}

/**
 * Ingestão de um documento: extrai o texto, quebra em chunks, gera os
 * embeddings e grava tudo.
 *
 * A ordem importa. O documento é gravado primeiro para conseguir o id que os
 * chunks referenciam; se qualquer etapa seguinte falhar, o documento é apagado.
 * O `on delete cascade` leva os chunks junto — assim nunca sobra um documento
 * pela metade, sem chunks ou com só parte deles indexada.
 */
export async function ingestDocument(file: File): Promise<DocumentSummary> {
  if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError(file.name);

  const { text } = await extractText(file);
  const chunks = chunkText(text);

  const supabase = getSupabase();

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      title: titleFrom(file.name),
      source_name: file.name,
      mime_type: file.type || "application/octet-stream",
      char_count: text.length,
      content: text,
    })
    .select("id, title, source_name, char_count, created_at")
    .single();

  if (insertError || !document) {
    throw new Error(`Não consegui gravar o documento: ${insertError?.message}`);
  }

  try {
    const embeddings = await embedAll(chunks.map((chunk) => chunk.content));

    const { error: chunksError } = await supabase.from("chunks").insert(
      chunks.map((chunk, position) => ({
        document_id: document.id,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: embeddings[position],
      })),
    );

    if (chunksError) {
      throw new Error(`Não consegui gravar os chunks: ${chunksError.message}`);
    }
  } catch (error) {
    // Sem os chunks o documento é inútil e ainda apareceria na lista.
    await supabase.from("documents").delete().eq("id", document.id);
    throw error;
  }

  return {
    id: document.id,
    title: document.title,
    sourceName: document.source_name,
    charCount: document.char_count,
    chunkCount: chunks.length,
    createdAt: document.created_at,
  };
}

/** Lista os documentos já ingeridos, do mais recente para o mais antigo. */
export async function listDocuments(): Promise<DocumentSummary[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, source_name, char_count, created_at, chunks(count)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Não consegui listar os documentos: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    charCount: row.char_count,
    // O embedded count volta como [{ count: N }].
    chunkCount: (row.chunks as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }));
}

/** Teto de títulos injetados no prompt, para não estourar o contexto. */
const TITLES_IN_PROMPT = 50;

/**
 * Só os títulos, para o modelo saber o que existe antes de decidir buscar.
 *
 * Sem esta lista ele julga pelo formato da pergunta: "como comprar ingresso?"
 * não parece pergunta sobre documento, então ele responde de conhecimento
 * geral — mesmo com um documento sobre ingressos no acervo.
 */
export async function listDocumentTitles(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("documents")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(TITLES_IN_PROMPT);

  if (error) throw new Error(`Não consegui listar os títulos: ${error.message}`);

  return (data ?? []).map((row) => row.title as string);
}

/** Quantos documentos existem no acervo — sem trazer nenhuma linha. */
export async function countDocuments(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("documents")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`Não consegui contar os documentos: ${error.message}`);

  return count ?? 0;
}

/** Remove um documento; os chunks vão junto pelo cascade. */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await getSupabase().from("documents").delete().eq("id", id);

  if (error) throw new Error(`Não consegui apagar o documento: ${error.message}`);
}

/** Usa o nome do arquivo sem a extensão como título legível. */
function titleFrom(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || fileName;
}
