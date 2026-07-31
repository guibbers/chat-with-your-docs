/** Declaração de uma ferramenta no formato que o OpenRouter espera. */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Uma chamada de ferramenta pedida pelo modelo. */
export interface ToolCall {
  id: string;
  name: string;
  /** JSON cru: o modelo pode produzir algo inválido, então o parse é do executor. */
  arguments: string;
}

/** Eventos que o stream do OpenRouter produz. */
export type CompletionEvent =
  | { type: "text"; value: string }
  | { type: "tool_calls"; calls: ToolCall[] };
