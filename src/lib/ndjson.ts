/**
 * Leitura de streams NDJSON (um JSON por linha) no cliente.
 * É o contraponto do que `POST /api/chat` escreve.
 */
export async function* readNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");

      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);

        if (line) yield JSON.parse(line) as T;

        newline = buffer.indexOf("\n");
      }
    }

    const remainder = buffer.trim();
    if (remainder) yield JSON.parse(remainder) as T;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
