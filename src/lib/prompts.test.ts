import { describe, expect, it } from "vitest";

import { buildAgentPrompt } from "@/lib/prompts";

describe("buildAgentPrompt", () => {
  it("lista os títulos do acervo antes das instruções", () => {
    const prompt = buildAgentPrompt(["Política interna", "Manual do reator"]);

    expect(prompt).toContain("- Política interna");
    expect(prompt).toContain("- Manual do reator");
    // O inventário vem primeiro: o modelo precisa saber o que existe antes de
    // ler as regras sobre quando buscar.
    expect(prompt.indexOf("Política interna")).toBeLessThan(
      prompt.indexOf("Sobre a busca"),
    );
  });

  it("avisa quando o acervo está vazio", () => {
    const prompt = buildAgentPrompt([]);

    expect(prompt).toContain("acervo está vazio");
    expect(prompt).not.toContain("Documentos disponíveis");
  });

  it("mantém as regras de citação em qualquer caso", () => {
    for (const prompt of [buildAgentPrompt([]), buildAgentPrompt(["Um doc"])]) {
      expect(prompt).toContain("buscar_docs");
      expect(prompt).toContain("[n]");
      expect(prompt).toContain("Nunca invente citações");
    }
  });
});
