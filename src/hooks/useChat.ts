"use client";

import { useCallback, useRef, useState } from "react";

import { readNdjsonStream } from "@/lib/ndjson";
import type { ChatStreamEvent } from "@/types/chat";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type ChatStatus = "idle" | "streaming";

function createId(): string {
  return crypto.randomUUID();
}

/**
 * Estado da conversa e consumo do stream da rota `/api/chat`.
 *
 * O histórico vive num ref além do state: o `send` precisa da lista atualizada
 * na hora da chamada, e ler do state daria a versão do render anterior.
 */
export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<UiMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const commit = useCallback((next: UiMessage[]) => {
    historyRef.current = next;
    setMessages(next);
  }, []);

  const appendToAssistant = useCallback(
    (id: string, chunk: string) => {
      commit(
        historyRef.current.map((message) =>
          message.id === id
            ? { ...message, content: message.content + chunk }
            : message,
        ),
      );
    },
    [commit],
  );

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || abortRef.current) return;

      setError(null);
      setStatus("streaming");

      const userMessage: UiMessage = { id: createId(), role: "user", content: text };
      const assistantMessage: UiMessage = {
        id: createId(),
        role: "assistant",
        content: "",
      };

      const conversation = [...historyRef.current, userMessage];
      commit([...conversation, assistantMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: conversation.map(({ role, content }) => ({ role, content })),
          }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Falha ao falar com o servidor.");
        }

        for await (const event of readNdjsonStream<ChatStreamEvent>(response.body)) {
          if (event.type === "token") {
            appendToAssistant(assistantMessage.id, event.value);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          // Cancelamento é intencional: mantém o que já foi escrito na tela.
        } else {
          setError(caught instanceof Error ? caught.message : "Erro inesperado.");
        }
      } finally {
        // Uma resposta vazia (erro logo no início) não deve virar balão fantasma.
        commit(
          historyRef.current.filter(
            (message) => message.id !== assistantMessage.id || message.content !== "",
          ),
        );
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [appendToAssistant, commit],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    commit([]);
  }, [commit]);

  return { messages, status, error, send, stop, reset };
}
