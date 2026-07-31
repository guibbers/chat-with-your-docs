import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { streamChatCompletion } from "@/lib/openrouter";
import type { CompletionEvent } from "@/types/tools";

/** Monta uma resposta SSE falsa a partir dos deltas informados. */
function sseResponse(deltas: unknown[]): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const delta of deltas) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, { status: 200 });
}

async function collect(deltas: unknown[]): Promise<CompletionEvent[]> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => sseResponse(deltas)),
  );

  const events: CompletionEvent[] = [];
  for await (const event of streamChatCompletion({ messages: [] })) {
    events.push(event);
  }

  return events;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "chave-de-teste";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChatCompletion", () => {
  it("emite texto token a token, na ordem", async () => {
    const events = await collect([
      { content: "Olá" },
      { content: ", " },
      { content: "mundo" },
    ]);

    expect(events).toEqual([
      { type: "text", value: "Olá" },
      { type: "text", value: ", " },
      { type: "text", value: "mundo" },
    ]);
  });

  it("remonta uma tool call cujos argumentos vieram fatiados", async () => {
    const events = await collect([
      { tool_calls: [{ index: 0, id: "call_1", function: { name: "buscar_docs" } }] },
      { tool_calls: [{ index: 0, function: { arguments: '{"cons' } }] },
      { tool_calls: [{ index: 0, function: { arguments: 'ulta":"fer' } }] },
      { tool_calls: [{ index: 0, function: { arguments: 'ias"}' } }] },
    ]);

    expect(events).toEqual([
      {
        type: "tool_calls",
        calls: [
          { id: "call_1", name: "buscar_docs", arguments: '{"consulta":"ferias"}' },
        ],
      },
    ]);
  });

  it("separa tool calls simultâneas pelo index e as devolve em ordem", async () => {
    const events = await collect([
      {
        tool_calls: [
          { index: 1, id: "b", function: { name: "buscar_docs", arguments: '{"b"' } },
          { index: 0, id: "a", function: { name: "buscar_docs", arguments: '{"a"' } },
        ],
      },
      {
        tool_calls: [
          { index: 0, function: { arguments: ":1}" } },
          { index: 1, function: { arguments: ":2}" } },
        ],
      },
    ]);

    expect(events).toEqual([
      {
        type: "tool_calls",
        calls: [
          { id: "a", name: "buscar_docs", arguments: '{"a":1}' },
          { id: "b", name: "buscar_docs", arguments: '{"b":2}' },
        ],
      },
    ]);
  });

  it("emite o texto antes da tool call quando os dois aparecem", async () => {
    const events = await collect([
      { content: "Deixa eu procurar." },
      {
        tool_calls: [
          { index: 0, id: "c", function: { name: "buscar_docs", arguments: "{}" } },
        ],
      },
    ]);

    expect(events[0]).toEqual({ type: "text", value: "Deixa eu procurar." });
    expect(events[1]?.type).toBe("tool_calls");
  });

  it("não emite evento de tool call quando só houve texto", async () => {
    const events = await collect([{ content: "resposta direta" }]);

    expect(events.filter((event) => event.type === "tool_calls")).toEqual([]);
  });

  it("propaga erro reportado no meio do stream", async () => {
    const encoder = new TextEncoder();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ error: { message: "provider caiu" } })}\n\n`,
                  ),
                );
                controller.close();
              },
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(async () => {
      // Consome o stream até ele estourar.
      for await (const event of streamChatCompletion({ messages: [] })) {
        expect(event).toBeDefined();
      }
    }).rejects.toThrow("provider caiu");
  });
});
