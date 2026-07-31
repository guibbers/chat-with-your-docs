/**
 * Quebra de documentos em pedaços (chunks) para embedding.
 *
 * A ideia central: cortar no ponto menos custoso possível. Um corte no meio de
 * uma frase produz um chunk que não significa nada sozinho — e um chunk sem
 * sentido gera um embedding ruim, que a busca nunca vai recuperar direito.
 * Então a quebra desce por níveis: parágrafo, frase, palavra, e só no último
 * caso corta no meio de uma palavra.
 *
 * Os chunks se sobrepõem um pouco. Sem isso, uma informação que cai exatamente
 * na fronteira entre dois pedaços fica partida nos dois e não é recuperável
 * por nenhum deles.
 */

export interface ChunkOptions {
  /** Tamanho máximo do chunk final, em caracteres. */
  maxChars?: number;
  /** Quanto do fim do chunk anterior repetir no começo do próximo. */
  overlapChars?: number;
}

export interface Chunk {
  index: number;
  content: string;
}

export const DEFAULT_MAX_CHARS = 1_000;
export const DEFAULT_OVERLAP_CHARS = 150;

/** Um trecho indivisível, com o separador que o liga ao trecho anterior. */
interface Unit {
  text: string;
  joiner: string;
}

/**
 * Divide o texto em chunks com sobreposição.
 * Os chunks respeitam `maxChars` já contando a sobreposição.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (maxChars <= 0) {
    throw new Error("maxChars precisa ser maior que zero.");
  }

  if (overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error("overlapChars precisa estar entre 0 e maxChars.");
  }

  const normalized = normalize(text);
  if (!normalized) return [];

  // O empacotamento mira num teto menor para que, depois de colar a
  // sobreposição, o chunk final ainda caiba em maxChars.
  const budget = maxChars - overlapChars;
  const packed = pack(splitIntoUnits(normalized, budget), budget);

  return packed.map((content, index) => ({
    index,
    content:
      index === 0 || overlapChars === 0
        ? content
        : `${tailOf(packed[index - 1], overlapChars)} ${content}`,
  }));
}

/** Normaliza quebras de linha e remove espaços supérfluos. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Desce a escada de separadores até que todo trecho caiba no orçamento.
 * Cada trecho carrega o separador que o reconecta ao anterior, para que a
 * remontagem não invente quebras de parágrafo onde havia só um espaço.
 */
function splitIntoUnits(text: string, budget: number): Unit[] {
  const units: Unit[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (trimmed.length <= budget) {
      units.push({ text: trimmed, joiner: "\n\n" });
      continue;
    }

    // Parágrafo grande demais: desce para frases.
    let firstOfParagraph = true;

    for (const sentence of splitSentences(trimmed)) {
      const pieces =
        sentence.length <= budget ? [sentence] : splitLongSentence(sentence, budget);

      for (const piece of pieces) {
        units.push({ text: piece, joiner: firstOfParagraph ? "\n\n" : " " });
        firstOfParagraph = false;
      }
    }
  }

  return units;
}

/** Corta em pontuação final seguida de espaço. */
function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Última parada: quebra por palavras e, se preciso, no meio da palavra. */
function splitLongSentence(sentence: string, budget: number): string[] {
  const pieces: string[] = [];
  let current = "";

  for (const word of sentence.split(" ")) {
    if (word.length > budget) {
      if (current) {
        pieces.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += budget) {
        pieces.push(word.slice(i, i + budget));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= budget) {
      current = candidate;
    } else {
      if (current) pieces.push(current);
      current = word;
    }
  }

  if (current) pieces.push(current);

  return pieces;
}

/** Junta trechos vizinhos enquanto couberem no orçamento. */
function pack(units: Unit[], budget: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}${unit.joiner}${unit.text}` : unit.text;

    if (candidate.length <= budget) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = unit.text;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

/**
 * Pega o final do chunk anterior para servir de sobreposição, começando numa
 * fronteira de palavra — repetir meia palavra só polui o embedding.
 */
function tailOf(chunk: string, overlapChars: number): string {
  if (chunk.length <= overlapChars) return chunk;

  const tail = chunk.slice(-overlapChars);
  const boundary = tail.search(/\s/);

  return (boundary === -1 ? tail : tail.slice(boundary + 1)).trim();
}
