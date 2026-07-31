/** Um documento já ingerido, como a lista da UI precisa dele. */
export interface DocumentSummary {
  id: string;
  title: string;
  sourceName: string;
  charCount: number;
  chunkCount: number;
  createdAt: string;
}

/**
 * Um trecho recuperado pela busca semântica, com o que basta para virar
 * citação na tela: de qual documento veio, qual pedaço, e o quão próximo está.
 */
export interface Source {
  documentId: string;
  title: string;
  sourceName: string;
  chunkIndex: number;
  similarity: number;
  excerpt: string;
}
