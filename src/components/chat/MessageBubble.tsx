import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
        ) : message.content ? (
          <div className="prose-chat">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        ) : (
          <TypingDots />
        )}
      </div>
    </div>
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
