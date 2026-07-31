-- Schema inicial do rag-notes: documentos, pedaços (chunks) e busca vetorial.
-- Rode no SQL Editor do Supabase. É idempotente: pode rodar de novo sem quebrar.

-- pgvector: adiciona o tipo `vector` e os operadores de distância.
create extension if not exists vector;

-- Um documento enviado pelo usuário.
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  source_name  text        not null,           -- nome do arquivo original
  mime_type    text        not null,
  char_count   integer     not null,
  content      text        not null,           -- texto extraído, inteiro
  created_at   timestamptz not null default now()
);

-- Um pedaço do documento, com o embedding correspondente.
create table if not exists public.chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid        not null references public.documents(id) on delete cascade,
  chunk_index  integer     not null,           -- posição dentro do documento
  content      text        not null,
  -- 1536 = dimensão do openai/text-embedding-3-small via OpenRouter.
  -- Trocar de modelo de embedding exige alterar este número e reindexar tudo.
  embedding    vector(1536),
  created_at   timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create index if not exists chunks_document_id_idx
  on public.chunks (document_id);

-- HNSW com distância de cosseno: é o operador que a busca usa (<=>).
-- O índice precisa casar com o operador da query, senão o Postgres o ignora.
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

-- Segurança: o app fala com o banco pela service role, que ignora RLS.
-- Ligar RLS sem nenhuma policy significa que a chave pública (anon), mesmo
-- vazando, não lê nada destas tabelas.
alter table public.documents enable row level security;
alter table public.chunks    enable row level security;

-- Busca semântica: devolve os chunks mais próximos da pergunta, já com os
-- dados do documento de origem para montar a citação.
create or replace function public.match_chunks(
  query_embedding      vector(1536),
  match_count          integer default 5,
  similarity_threshold double precision default 0.0
)
returns table (
  id          uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  title       text,
  source_name text,
  similarity  double precision
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    d.title,
    d.source_name,
    -- <=> é distância de cosseno (0 = idêntico). Invertida vira similaridade.
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
