/**
 * Extração de texto dos formatos aceitos no upload.
 *
 * Só texto interessa: formatação, imagens e layout não entram no embedding.
 * O que importa é que o texto saia legível e na ordem certa.
 */

/** Formatos aceitos no upload. */
export const ACCEPTED_EXTENSIONS = [".md", ".txt", ".pdf"] as const;

/** Teto de tamanho do arquivo enviado. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type SupportedType = "markdown" | "text" | "pdf";

export class UnsupportedFileError extends Error {
  constructor(name: string) {
    super(`Formato não suportado: ${name}. Aceito ${ACCEPTED_EXTENSIONS.join(", ")}.`);
    this.name = "UnsupportedFileError";
  }
}

export class EmptyDocumentError extends Error {
  constructor(name: string) {
    super(
      `Não consegui extrair texto de ${name}. O arquivo pode estar vazio ou ser só imagem.`,
    );
    this.name = "EmptyDocumentError";
  }
}

/**
 * Decide o tipo pelo nome do arquivo, não pelo MIME que o browser informa.
 * O MIME de `.md` varia entre navegadores (e às vezes vem vazio); a extensão
 * é o sinal mais confiável que temos aqui.
 */
export function detectType(fileName: string): SupportedType {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";

  throw new UnsupportedFileError(fileName);
}

export interface ExtractedDocument {
  text: string;
  type: SupportedType;
}

/** Lê o arquivo e devolve o texto pronto para o chunking. */
export async function extractText(file: File): Promise<ExtractedDocument> {
  const type = detectType(file.name);
  const buffer = await file.arrayBuffer();

  const raw =
    type === "pdf"
      ? await extractPdf(buffer)
      : new TextDecoder("utf-8").decode(buffer);

  const text = cleanup(raw);

  if (!text) throw new EmptyDocumentError(file.name);

  return { text, type };
}

/**
 * O unpdf embute uma build do pdf.js preparada para serverless — importante
 * porque a rota roda como função na Vercel, sem sistema de arquivos nem canvas.
 * O import é dinâmico para não pesar no bundle de quem só usa .md e .txt.
 */
async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractPdfText(pdf, { mergePages: true });

  return text;
}

/**
 * BOM e caracteres de controle, que passam batido e sujam o embedding.
 *
 * Construido a partir de string para que este arquivo nao contenha os
 * proprios caracteres de controle literais.
 */
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\uFEFF]",
  "g",
);

/** Hífen de quebra de linha: "conheci-\nmento" precisa virar "conhecimento". */
const HYPHENATED_LINE_BREAK = /(\p{Ll})-\n(\p{Ll})/gu;

/**
 * Normaliza o texto extraído.
 *
 * PDFs são o caso difícil: o pdf.js devolve o texto na ordem em que os glifos
 * foram desenhados, o que costuma render espaçamento estranho e quebras de
 * linha no meio de frases.
 */
export function cleanup(text: string): string {
  return text
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(HYPHENATED_LINE_BREAK, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    // Três ou mais quebras viram uma separação de parágrafo só.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
