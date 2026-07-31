"use client";

import { useCallback, useState } from "react";

import type { DocumentSummary } from "@/types/rag";

export type UploadStatus = "idle" | "uploading";

/**
 * Lista de documentos do acervo, com upload e remoção.
 *
 * A lista inicial vem pronta do servidor (a página é um Server Component), e
 * não de um fetch no mount: evita o piscar de "carregando" e uma ida à rede
 * que o servidor já podia ter resolvido durante o render.
 */
export function useDocuments(initialDocuments: DocumentSummary[]) {
  const [documents, setDocuments] = useState<DocumentSummary[]>(initialDocuments);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      const payload = await response.json();

      if (!response.ok) throw new Error(payload?.error ?? "Falha ao listar.");

      setDocuments(payload.documents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    }
  }, []);

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setError(null);
    setStatus("uploading");

    try {
      // Um por vez: cada arquivo gera embeddings, e mandar tudo em paralelo
      // só aumenta a chance de bater no rate limit do OpenRouter.
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);

        const response = await fetch("/api/documents", { method: "POST", body });
        const payload = await response.json();

        if (!response.ok) throw new Error(payload?.error ?? "Falha no upload.");

        setDocuments((current) => [payload.document, ...current]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    } finally {
      setStatus("idle");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const previous = documents;
    // Some da lista na hora; se o servidor recusar, volta.
    setDocuments((current) => current.filter((document) => document.id !== id));

    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });

    if (!response.ok) {
      setDocuments(previous);
      setError("Não consegui apagar o documento.");
    }
  }, [documents]);

  return { documents, status, error, upload, remove, refresh };
}
