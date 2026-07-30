/**
 * Acesso às variáveis de ambiente do servidor.
 *
 * As chaves são lidas sob demanda (getters) e não no import: assim o build da
 * Vercel não quebra por falta de segredo, e o erro só aparece — com mensagem
 * clara — quando alguém de fato tenta chamar o LLM.
 */

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_SITE_URL = "http://localhost:3000";

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new MissingEnvError(name);
  }

  return value;
}

export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Variável de ambiente ausente: ${variable}. Confira o .env.example.`);
    this.name = "MissingEnvError";
  }
}

export const env = {
  get openRouterApiKey(): string {
    return required("OPENROUTER_API_KEY");
  },

  get openRouterModel(): string {
    return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  },

  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  },
};
