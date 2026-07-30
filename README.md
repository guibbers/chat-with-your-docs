# rag-notes

Converse com os seus documentos. Você sobe arquivos `.md`, `.txt` ou `.pdf`, o app
quebra em pedaços, gera embeddings e guarda num banco vetorial — depois responde às
suas perguntas **citando de onde tirou cada informação**.

> Projeto de portfólio, escrito do zero por [Guilherme Torres](https://github.com/guibbers).

**Demo:** _em breve_

## Stack

| Camada | Escolha |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 |
| LLM | OpenRouter (API OpenAI-compatible) |
| Embeddings + busca | Supabase / pgvector |
| Testes | Vitest |
| Deploy | Vercel |

## Como está agora

- [x] Chat com streaming token a token via OpenRouter
- [ ] Upload de documentos + chunking + embeddings
- [ ] Busca semântica com citações das fontes
- [ ] Tool calling (`buscar_docs`)

## Rodando local

```bash
npm install
cp .env.example .env.local   # e preencha OPENROUTER_API_KEY
npm run dev
```

Requer Node 22.12+ (a versão está fixada em `.node-version` e em `engines` do
`package.json`; com `fnm` ou `nvm`, a troca é automática ao entrar na pasta).

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run test` | testes unitários |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Arquitetura

```
Browser                        Servidor (Next.js)              OpenRouter
───────                        ──────────────────              ──────────
useChat ──── POST /api/chat ──▶ valida o corpo
                                monta o system prompt
                                └─▶ streamChatCompletion ────▶ modelo (SSE)
        ◀─── NDJSON ────────────── converte SSE em eventos ◀───┘
        renderiza markdown
```

Dois formatos de stream, de propósito:

- **SSE** é o que o OpenRouter fala (padrão OpenAI). Parseado à mão em
  [`src/lib/sse.ts`](src/lib/sse.ts) — sem SDK.
- **NDJSON** é o que o servidor fala com o browser. Um JSON por linha, porque a
  resposta vai carregar mais do que texto quando o RAG entrar: as citações das
  fontes viajam no mesmo stream, sem precisar de uma segunda requisição.

## Decisões

- **Sem SDK do OpenRouter/OpenAI.** A API é HTTP + SSE; escrever o cliente dá
  controle total sobre cancelamento e erros, e uma dependência a menos.
- **System prompt só no servidor.** O cliente só pode mandar turnos `user` e
  `assistant` ([`src/lib/validation.ts`](src/lib/validation.ts)). Sem isso,
  qualquer um sobrescreveria as instruções pelo devtools.
- **Erro no meio do stream vai pelo corpo, não pelo status.** Quando o primeiro
  token já saiu, os headers foram enviados: só resta um evento `{"type":"error"}`.
- **Variáveis de ambiente lidas sob demanda.** O build da Vercel não precisa do
  segredo; a falha aparece com mensagem clara na hora da chamada.

## O que aprendi

_A ser escrito quando o projeto fechar._
