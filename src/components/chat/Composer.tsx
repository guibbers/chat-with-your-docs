"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ disabled, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    if (disabled || !value.trim()) return;
    onSend(value);
    setValue("");
    // O textarea cresce com o conteúdo; volta ao tamanho base depois de enviar.
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia, Shift+Enter quebra linha.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-sky-500 dark:bg-slate-800 dark:ring-slate-700"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          const el = event.target;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }}
        onKeyDown={handleKeyDown}
        placeholder="Pergunte alguma coisa…"
        aria-label="Mensagem"
        className="max-h-50 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
      />

      {disabled ? (
        <button
          type="button"
          onClick={onStop}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
        >
          Parar
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      )}
    </form>
  );
}
