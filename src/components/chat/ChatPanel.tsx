"use client";

import { useEffect, useRef } from "react";

import { Composer } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useChat } from "@/hooks/useChat";

const SUGGESTIONS = [
  "Sobre o que são os documentos que eu enviei?",
  "Resuma o documento em três pontos.",
  "Quais números aparecem nos documentos?",
];

export function ChatPanel() {
  const { messages, status, error, send, stop, reset } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  const isStreaming = status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h1 className="text-sm font-semibold">rag-notes</h1>
          <p className="text-xs text-slate-500">
            respostas com citação da fonte
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Nova conversa
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900"
            >
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="mx-auto w-full max-w-3xl">
          <Composer disabled={isStreaming} onSend={send} onStop={stop} />
          <p className="mt-2 text-center text-xs text-slate-400">
            Respostas geradas por IA podem conter erros.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div>
        <h2 className="text-lg font-semibold">Comece por aqui</h2>
        <p className="mt-1 text-sm text-slate-500">
          Envie um documento no painel ao lado e pergunte sobre ele. Cada resposta
          vem com os trechos que a embasaram.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:ring-sky-400 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
