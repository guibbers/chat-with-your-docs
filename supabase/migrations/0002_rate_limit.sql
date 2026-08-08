-- Rate limiting de janela fixa, atômico, no próprio Postgres.
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Por que no banco e não em memória: na Vercel cada requisição pode cair numa
-- instância diferente da função, e um contador em memória seria zerado a cada
-- cold start. O estado precisa ser compartilhado, e o Postgres já está aqui.

create table if not exists public.rate_limit (
  bucket       text        primary key,   -- ex.: "chat:1.2.3.4"
  count        integer     not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limit enable row level security;

-- Buckets vencidos não têm valor; o índice ajuda a limpeza periódica.
create index if not exists rate_limit_window_start_idx
  on public.rate_limit (window_start);

-- A função anterior devolvia boolean. Como a assinatura de retorno mudou, o
-- create or replace não basta: é preciso derrubar antes.
drop function if exists public.hit_rate_limit(text, integer, integer);

/*
 * Incrementa o contador do bucket e diz se o chamador está dentro do limite.
 *
 * Tudo acontece num único INSERT ... ON CONFLICT DO UPDATE, que o Postgres
 * executa atomicamente sobre a linha: duas requisições simultâneas do mesmo IP
 * não conseguem ler o mesmo contador e gravar o mesmo valor. Fazer isso em dois
 * passos (SELECT e depois UPDATE) abriria exatamente essa janela.
 *
 * `retry_after` é quantos segundos faltam para a janela virar — vira o header
 * Retry-After da resposta 429, para o cliente saber quando voltar.
 */
create function public.hit_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_count        integer;
  v_window_start timestamptz;
  v_expired      boolean;
begin
  insert into public.rate_limit as r (bucket, count, window_start)
    values (p_key, 1, v_now)
  on conflict (bucket) do update
    set
      -- Dentro de DO UPDATE, `r` é a linha que já existia no banco.
      count = case
        when r.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else r.window_start
      end
  returning r.count, r.window_start into v_count, v_window_start;

  allowed := v_count <= p_max;

  retry_after := greatest(
    0,
    ceil(
      extract(
        epoch from (v_window_start + make_interval(secs => p_window_seconds)) - v_now
      )
    )::integer
  );

  return next;
end;
$$;
