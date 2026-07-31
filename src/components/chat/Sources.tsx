"use client";

import { useMemo, useState } from "react";

import type { Source } from "@/types/rag";

interface SourcesProps {
  sources: Source[];
  /** Texto da resposta, de onde saem as marcações [n] efetivamente citadas. */
  answer: string;
}

/**
 * Citações da resposta. Os números batem com as marcações [n] que o modelo
 * escreve no texto — é o que permite conferir cada afirmação na origem.
 *
 * A busca devolve os vizinhos mais próximos, mas o modelo costuma usar só
 * alguns. Misturar os dois grupos numa lista só faria a resposta parecer mais
 * ancorada do que é, então o que não foi citado fica recolhido.
 */
export function Sources({ sources, answer }: SourcesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const citedNumbers = useMemo(
    () => new Set([...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))),
    [answer],
  );

  const cited = sources.filter((_, position) => citedNumbers.has(position + 1));
  const consulted = sources.filter((_, position) => !citedNumbers.has(position + 1));

  // Sem nenhuma marcação no texto não há o que separar: tudo virou consulta.
  const hasCitations = cited.length > 0;
  const primary = hasCitations ? cited : [];
  const secondary = hasCitations ? consulted : sources;

  const numberOf = (source: Source) => sources.indexOf(source) + 1;

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      <p className="mb-2 text-xs font-medium text-slate-500">
        {hasCitations ? `Fontes citadas (${primary.length})` : "Trechos consultados"}
      </p>

      {primary.length > 0 && (
        <ol className="flex flex-col gap-1">
          {primary.map((source) => (
            <SourceRow
              key={`${source.documentId}-${source.chunkIndex}`}
              source={source}
              number={numberOf(source)}
              isOpen={openIndex === numberOf(source)}
              onToggle={() =>
                setOpenIndex(openIndex === numberOf(source) ? null : numberOf(source))
              }
            />
          ))}
        </ol>
      )}

      {secondary.length > 0 && (
        <>
          {hasCitations && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              className="mt-1 px-2 py-1 text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showAll ? "ocultar" : `+ ${secondary.length} trechos consultados`}
            </button>
          )}

          {(showAll || !hasCitations) && (
            <ol className="mt-1 flex flex-col gap-1 opacity-70">
              {secondary.map((source) => (
                <SourceRow
                  key={`${source.documentId}-${source.chunkIndex}`}
                  source={source}
                  number={numberOf(source)}
                  isOpen={openIndex === numberOf(source)}
                  onToggle={() =>
                    setOpenIndex(
                      openIndex === numberOf(source) ? null : numberOf(source),
                    )
                  }
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

interface SourceRowProps {
  source: Source;
  number: number;
  isOpen: boolean;
  onToggle: () => void;
}

function SourceRow({ source, number, isOpen, onToggle }: SourceRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
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
}
