import { describe, expect, it } from "vitest";

import { parseEvent, readSseStream, splitEvents } from "@/lib/sse";

/** Monta um ReadableStream a partir de pedaços de texto, como a rede entrega. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const payload of readSseStream(stream)) out.push(payload);
  return out;
}

describe("splitEvents", () => {
  it("separa eventos completos e devolve o resto", () => {
    const { events, rest } = splitEvents("data: a\n\ndata: b\n\ndata: par");

    expect(events).toEqual(["data: a", "data: b"]);
    expect(rest).toBe("data: par");
  });

  it("não emite nada quando não há evento fechado", () => {
    expect(splitEvents("data: a")).toEqual({ events: [], rest: "data: a" });
  });
});

describe("parseEvent", () => {
  it("extrai o payload da linha data:", () => {
    expect(parseEvent('data: {"x":1}')).toEqual({ type: "data", data: '{"x":1}' });
  });

  it("reconhece o fim do stream", () => {
    expect(parseEvent("data: [DONE]")).toEqual({ type: "done" });
  });

  it("ignora comentários de keep-alive do OpenRouter", () => {
    expect(parseEvent(": OPENROUTER PROCESSING")).toEqual({ type: "ignored" });
  });
});

describe("readSseStream", () => {
  it("remonta eventos partidos entre chunks da rede", async () => {
    const payloads = await collect(
      streamOf(['data: {"n"', ':1}\n\ndata: {"n":2}\n\n', "data: [DONE]\n\n"]),
    );

    expect(payloads).toEqual(['{"n":1}', '{"n":2}']);
  });

  it("para no [DONE] e descarta o que vier depois", async () => {
    const payloads = await collect(
      streamOf(['data: {"n":1}\n\ndata: [DONE]\n\ndata: {"n":2}\n\n']),
    );

    expect(payloads).toEqual(['{"n":1}']);
  });

  it("lida com CRLF e com keep-alives no meio", async () => {
    const payloads = await collect(
      streamOf([': OPENROUTER PROCESSING\r\n\r\ndata: {"n":1}\r\n\r\n']),
    );

    expect(payloads).toEqual(['{"n":1}']);
  });

  it("aproveita o último evento mesmo sem a quebra dupla final", async () => {
    const payloads = await collect(streamOf(['data: {"n":1}']));

    expect(payloads).toEqual(['{"n":1}']);
  });
});
