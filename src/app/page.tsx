import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";
import { listDocuments } from "@/lib/ingest";
import type { DocumentSummary } from "@/types/rag";

// A página lê o acervo a cada acesso; não faz sentido prerenderizar no build,
// quando as credenciais do banco nem existem.
export const dynamic = "force-dynamic";

export default async function Home() {
  let documents: DocumentSummary[] = [];

  try {
    documents = await listDocuments();
  } catch (error) {
    // Sem banco o chat ainda funciona; o painel só aparece vazio.
    console.error("[page] não consegui carregar o acervo", error);
  }

  return (
    <div className="flex h-dvh">
      {/* Em telas estreitas o acervo sai de cena: o chat é o que importa. */}
      <div className="hidden w-72 shrink-0 md:block">
        <DocumentsPanel initialDocuments={documents} />
      </div>

      <ChatPanel />
    </div>
  );
}
