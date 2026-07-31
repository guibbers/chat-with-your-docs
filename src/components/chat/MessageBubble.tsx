import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Sources } from "@/components/chat/Sources";
import type { UiMessage } from "@/hooks/useChat";

interface MessageBubbleProps {
  message: UiMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85ch] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-sky-600 text-white"
            : "bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.searches && message.searches.length > 0 && (
              <SearchTrace searches={message.searches} />
            )}

            {message.content ? (
              <>
                <div className="prose-chat">
                  <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                </div>
                {message.sources && message.sources.length > 0 && (
                  <Sources sources={message.sources} answer={message.content} />
                )}
              </>
            ) : (
              <TypingDots />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Mostra as buscas que o modelo decidiu fazer. Deixa visível que houve tool
 * calling — e permite ver quando ele reformula a consulta sozinho.
 */
function SearchTrace({ searches }: { searches: string[] }) {
  return (
    <ul className="mb-2 flex flex-col gap-1">
      {searches.map((query, position) => (
        <li
          key={`${position}-${query}`}
          className="flex items-center gap-1.5 text-xs text-slate-500"
        >
          <span aria-hidden>🔍</span>
          <span className="italic">
            {query ? `buscou por "${query}"` : "buscou nos documentos"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Gerando resposta">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
