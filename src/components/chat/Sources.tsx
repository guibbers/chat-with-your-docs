"use client";

import { useState } from "react";

import type { Source } from "@/types/rag";

interface SourcesProps {
  sources: Source[];
}

/**
 * Citações da resposta. Os números batem com as marcações [n] que o modelo
 * escreve no texto — é o que permite conferir cada afirmação na origem.
 */
export function Sources({ sources }: SourcesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      <p className="mb-2 text-xs font-medium text-slate-500">
        Fontes ({sources.length})
      </p>

      <ol className="flex flex-col gap-1">
        {sources.map((source, position) => {
          const number = position + 1;
          const isOpen = openIndex === position;

          return (
            <li key={`${source.documentId}-${source.chunkIndex}`}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : position)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-100 font-medium text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                  {number}
                </span>

                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {source.title}
                </span>

                <span className="shrink-0 text-slate-400 tabular-nums">
                  {Math.round(source.similarity * 100)}%
                </span>
              </button>

              {isOpen && (
                <p className="mt-1 ml-7 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {source.excerpt}
                  <span className="mt-1 block text-slate-400">
                    {source.sourceName} · trecho {source.chunkIndex + 1}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
