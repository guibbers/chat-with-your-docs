"use client";

import { useRef, useState, type DragEvent } from "react";

import { useDocuments } from "@/hooks/useDocuments";
import type { DocumentSummary } from "@/types/rag";

const ACCEPT = ".md,.markdown,.txt,.pdf";

interface DocumentsPanelProps {
  initialDocuments: DocumentSummary[];
}

/** Acervo: upload, lista e remoção dos documentos. */
export function DocumentsPanel({ initialDocuments }: DocumentsPanelProps) {
  const { documents, status, error, upload, remove } = useDocuments(initialDocuments);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);

  const isUploading = status === "uploading";

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!isUploading) void upload(event.dataTransfer.files);
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Documentos</h2>
        <p className="text-xs text-slate-500">a base das respostas</p>
      </div>

      <div className="p-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            "rounded-xl border-2 border-dashed p-4 text-center transition",
            isDragging
              ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
              : "border-slate-300 dark:border-slate-700",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void upload(event.target.files);
              // Permite reenviar o mesmo arquivo depois de apagá-lo.
              event.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Processando…" : "Enviar arquivo"}
          </button>

          <p className="mt-2 text-xs text-slate-400">
            ou arraste aqui · .md .txt .pdf
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {documents.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum documento ainda. Envie um arquivo para começar a fazer perguntas
            sobre ele.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="group flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                    {document.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {document.chunkCount} trechos ·{" "}
                    {Math.round(document.charCount / 1000)}k caracteres
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void remove(document.id)}
                  aria-label={`Remover ${document.title}`}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 focus:opacity-100 dark:hover:bg-red-950"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
