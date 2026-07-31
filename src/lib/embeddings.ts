import { env } from "@/lib/env";
import { OpenRouterError } from "@/lib/openrouter";

const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

/**
 * Quantos textos mandar por requisição. O endpoint aceita array, e um
 * documento de 50 chunks vira 3 chamadas em vez de 50.
 */
export const BATCH_SIZE = 32;

/** Dimensão do openai/text-embedding-3-small — precisa casar com vector(1536). */
export const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingsResponse {
  data?: Array<{ embedding: number[]; index: number }>;
  error?: { message?: string };
}

/**
 * Gera embeddings para uma lista de textos, preservando a ordem de entrada.
 *
 * A ordem importa: o embedding de índice N tem que voltar para o chunk N. O
 * endpoint devolve um campo `index` justamente porque não garante a ordem do
 * array de resposta, então ele é usado para reposicionar.
 */
export async function embedAll(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    embeddings.push(...(await embedBatch(batch, signal)));
  }

  return embeddings;
}

/** Gera o embedding de um texto só — o caminho da pergunta do usuário. */
export async function embedOne(
  text: string,
  signal?: AbortSignal,
): Promise<number[]> {
  const [embedding] = await embedBatch([text], signal);
  return embedding;
}

async function embedBatch(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const response = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.siteUrl,
      "X-Title": "rag-notes",
    },
    body: JSON.stringify({
      model: env.openRouterEmbeddingModel,
      input: texts,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OpenRouterError(
      `Falha ao gerar embeddings (${response.status})`,
      response.status,
      detail.slice(0, 500),
    );
  }

  const payload = (await response.json()) as EmbeddingsResponse;

  if (payload.error || !payload.data) {
    throw new OpenRouterError(
      payload.error?.message ?? "Resposta de embeddings sem dados.",
      502,
    );
  }

  if (payload.data.length !== texts.length) {
    throw new OpenRouterError(
      `Pedi ${texts.length} embeddings e recebi ${payload.data.length}.`,
      502,
    );
  }

  const ordered: number[][] = new Array(texts.length);

  for (const item of payload.data) {
    if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new OpenRouterError(
        `Embedding com ${item.embedding.length} dimensões; o schema espera ${EMBEDDING_DIMENSIONS}. ` +
          `Confira OPENROUTER_EMBEDDING_MODEL.`,
        502,
      );
    }

    ordered[item.index] = item.embedding;
  }

  return ordered;
}
