/**
 * Parser mínimo de Server-Sent Events para respostas em stream do OpenRouter.
 *
 * Não uso SDK aqui de propósito: a API é OpenAI-compatible e o protocolo é
 * simples o bastante para valer o controle total (e uma dependência a menos).
 * Os dois detalhes que quebram implementações ingênuas estão cobertos:
 *
 * 1. um chunk da rede pode cortar um evento no meio — daí o buffer;
 * 2. o OpenRouter manda comentários de keep-alive (`: OPENROUTER PROCESSING`)
 *    enquanto a fila do provider não anda — precisam ser ignorados.
 */

/** Resultado do parse de um bloco de evento SSE. */
export type SseEvent =
  | { type: "data"; data: string }
  | { type: "done" }
  | { type: "ignored" };

const EVENT_SEPARATOR = "\n\n";

/**
 * Fatia um buffer de texto nos eventos SSE completos que ele já contém.
 * Devolve também o resto (evento parcial) para o próximo chunk.
 */
export function splitEvents(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  let rest = buffer;
  let boundary = rest.indexOf(EVENT_SEPARATOR);

  while (boundary !== -1) {
    events.push(rest.slice(0, boundary));
    rest = rest.slice(boundary + EVENT_SEPARATOR.length);
    boundary = rest.indexOf(EVENT_SEPARATOR);
  }

  return { events, rest };
}

/** Interpreta um bloco de evento SSE cru. */
export function parseEvent(rawEvent: string): SseEvent {
  for (const line of rawEvent.split("\n")) {
    // Linhas que começam com ":" são comentários (keep-alive).
    if (!line.startsWith("data:")) continue;

    const data = line.slice("data:".length).trim();

    if (data === "[DONE]") return { type: "done" };
    if (data) return { type: "data", data };
  }

  return { type: "ignored" };
}

/**
 * Converte o corpo de uma resposta SSE numa sequência de payloads JSON crus.
 * Normaliza CRLF para que o split por linha funcione igual em qualquer proxy.
 */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");

      const { events, rest } = splitEvents(buffer);
      buffer = rest;

      for (const rawEvent of events) {
        const event = parseEvent(rawEvent);
        if (event.type === "done") return;
        if (event.type === "data") yield event.data;
      }
    }

    // Último evento pode chegar sem a quebra dupla final.
    const event = parseEvent(buffer);
    if (event.type === "data") yield event.data;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
