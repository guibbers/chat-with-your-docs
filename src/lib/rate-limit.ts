import "server-only";

import { getSupabase } from "@/lib/supabase";

export interface RateLimitOptions {
  /** Máximo de requisições permitidas na janela. */
  max: number;
  /** Tamanho da janela, em segundos. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até a janela virar — vira o header Retry-After. */
  retryAfter: number;
}

/**
 * Consome uma unidade do bucket e diz se o chamador pode seguir.
 *
 * Falha aberta de propósito: se o banco do rate limit cair, é melhor deixar
 * passar do que derrubar o app inteiro por causa do guarda de abuso. O risco
 * de custo já está contido pelo teto de crédito no OpenRouter, que é a defesa
 * que não depende de nada nosso estar de pé.
 */
export async function hitRateLimit(
  key: string,
  { max, windowSeconds }: RateLimitOptions,
): Promise<RateLimitResult> {
  const { data, error } = await getSupabase().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[rate-limit]", error.message);
    return { allowed: true, retryAfter: 0 };
  }

  // A função devolve uma tabela, então o PostgREST entrega um array de linhas.
  const row = (data as Array<{ allowed: boolean; retry_after: number }> | null)?.[0];

  if (!row) {
    console.error("[rate-limit] resposta vazia de hit_rate_limit");
    return { allowed: true, retryAfter: 0 };
  }

  return { allowed: row.allowed, retryAfter: row.retry_after };
}

/**
 * IP do cliente, na melhor fonte disponível.
 *
 * A ordem importa: a Vercel sobrescreve `x-forwarded-for` na borda, então ele
 * não é forjável num deploy Vercel puro — mas passa a ser se alguém colocar um
 * proxy próprio na frente. O `x-vercel-forwarded-for` é escrito pela Vercel e
 * sobrevive a esse cenário, então vem primeiro.
 *
 * Sem nenhum header (desenvolvimento local), todo mundo cai no mesmo bucket.
 * É conservador na direção certa: limita demais em vez de limitar de menos.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return first(vercel);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return first(forwarded);

  return request.headers.get("x-real-ip")?.trim() || "desconhecido";
}

/** O IP do cliente é o primeiro da lista; o resto são proxies do caminho. */
function first(header: string): string {
  return header.split(",")[0]?.trim() || "desconhecido";
}
