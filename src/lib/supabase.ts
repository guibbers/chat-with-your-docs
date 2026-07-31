import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Cliente do Supabase para uso exclusivo no servidor.
 *
 * Usa a service role, que ignora RLS — daí o `server-only` no topo: se algum
 * componente de cliente importar este módulo por engano, o build quebra em vez
 * de mandar a chave secreta para o browser.
 *
 * O cliente é criado sob demanda e memoizado, para que a ausência da variável
 * de ambiente vire erro na requisição e não no import (que derrubaria o build).
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        // Não há usuário logado: é um processo de servidor, sem sessão.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}
