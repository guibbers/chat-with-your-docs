import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/chunking";

const contents = (text: string, options?: Parameters<typeof chunkText>[1]) =>
  chunkText(text, options).map((chunk) => chunk.content);

describe("chunkText", () => {
  it("devolve nada para texto vazio ou só espaços", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  \t ")).toEqual([]);
  });

  it("mantém texto curto em um único chunk", () => {
    expect(chunkText("Um texto curto.")).toEqual([
      { index: 0, content: "Um texto curto." },
    ]);
  });

  it("numera os chunks em sequência", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Parágrafo ${i} `.repeat(20));
    const chunks = chunkText(paragraphs.join("\n\n"), { maxChars: 200, overlapChars: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.index)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it("respeita o teto de caracteres já contando a sobreposição", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Frase número ${i}.`).join(" ");
    const chunks = chunkText(text, { maxChars: 120, overlapChars: 30 });

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(120);
    }
  });

  it("prefere cortar entre parágrafos", () => {
    const text = "Primeiro parágrafo.\n\nSegundo parágrafo.\n\nTerceiro parágrafo.";

    expect(contents(text, { maxChars: 25, overlapChars: 0 })).toEqual([
      "Primeiro parágrafo.",
      "Segundo parágrafo.",
      "Terceiro parágrafo.",
    ]);
  });

  it("agrupa parágrafos pequenos em vez de gerar um chunk por parágrafo", () => {
    const text = "Um.\n\nDois.\n\nTrês.";

    expect(contents(text, { maxChars: 100, overlapChars: 0 })).toEqual([
      "Um.\n\nDois.\n\nTrês.",
    ]);
  });

  it("desce para frases quando o parágrafo não cabe", () => {
    const text = "Frase um aqui. Frase dois aqui. Frase três aqui.";
    const chunks = contents(text, { maxChars: 20, overlapChars: 0 });

    expect(chunks).toEqual([
      "Frase um aqui.",
      "Frase dois aqui.",
      "Frase três aqui.",
    ]);
  });

  it("não inventa quebra de parágrafo ao remontar frases do mesmo parágrafo", () => {
    const text = "Frase um. Frase dois. Frase três. Frase quatro.";
    const chunks = contents(text, { maxChars: 30, overlapChars: 0 });

    // As frases vieram de um parágrafo só, então voltam separadas por espaço.
    expect(chunks.some((chunk) => chunk.includes("\n\n"))).toBe(false);
    expect(chunks.join(" ")).toBe(text);
  });

  it("quebra no meio da palavra só quando não há alternativa", () => {
    const chunks = contents("a".repeat(50), { maxChars: 20, overlapChars: 0 });

    expect(chunks).toEqual(["a".repeat(20), "a".repeat(20), "a".repeat(10)]);
  });

  it("sobrepõe o fim do chunk anterior no começo do próximo", () => {
    const text = "Primeiro parágrafo com texto.\n\nSegundo parágrafo com texto.";
    const chunks = contents(text, { maxChars: 45, overlapChars: 15 });

    expect(chunks).toHaveLength(2);
    expect(chunks[1].startsWith("com texto. Segundo")).toBe(true);
  });

  it("começa a sobreposição numa fronteira de palavra", () => {
    // A janela de 6 caracteres cairia no meio de "bbb" ("bb ccc"); a
    // sobreposição precisa recuar até a palavra inteira.
    const chunks = contents("aaa bbb ccc ddd\n\neee fff", {
      maxChars: 20,
      overlapChars: 6,
    });

    expect(chunks).toEqual(["aaa bbb ccc", "ccc ddd\n\neee fff"]);
  });

  it("preserva todo o texto original quando não há sobreposição", () => {
    const text = "Alfa bravo.\n\nCharlie delta echo.\n\nFoxtrot golf hotel india.";
    const chunks = contents(text, { maxChars: 25, overlapChars: 0 });

    expect(chunks.join("\n\n").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
  });

  it("normaliza CRLF e espaços repetidos", () => {
    expect(contents("Linha   um.\r\n\r\nLinha    dois.")).toEqual([
      "Linha um.\n\nLinha dois.",
    ]);
  });

  it("recusa configuração inválida", () => {
    expect(() => chunkText("oi", { maxChars: 0 })).toThrow();
    expect(() => chunkText("oi", { maxChars: 100, overlapChars: 100 })).toThrow();
    expect(() => chunkText("oi", { overlapChars: -1 })).toThrow();
  });
});
