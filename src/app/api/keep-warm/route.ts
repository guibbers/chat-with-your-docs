import { countDocuments } from "@/lib/ingest";

export const runtime = "nodejs";
// Nunca prerenderizar: o objetivo é justamente tocar o banco a cada chamada.
export const dynamic = "force-dynamic";

/**
 * Mantém o projeto do Supabase acordado.
 *
 * O free tier pausa o banco depois de ~7 dias sem atividade, e um projeto de
 * portfólio passa semanas parado entre uma candidatura e outra. Uma consulta
 * barata por dia resolve — e `count` com `head: true` não traz nenhuma linha,
 * só força a ida ao banco.
 *
 * Chamado pelo cron da Vercel (ver vercel.json).
 */
export async function GET(request: Request) {
  // A Vercel injeta este header quando a variável CRON_SECRET existe no
  // projeto. Sem a variável, a checagem é ignorada e a rota fica aberta —
  // o que é inofensivo, mas configurar o segredo evita que alguém use a rota
  // como ping grátis contra o seu banco.
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const documents = await countDocuments();

    return Response.json({ ok: true, documents });
  } catch (error) {
    // Devolve 500 de propósito: a Vercel marca a execução como falha e o erro
    // aparece nos logs, em vez de o banco pausar sem ninguém notar.
    console.error("[keep-warm]", error);

    return Response.json({ ok: false }, { status: 500 });
  }
}
