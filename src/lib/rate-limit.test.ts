import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ rpc }),
}));

const { clientIp, hitRateLimit } = await import("@/lib/rate-limit");

const request = (headers: Record<string, string>) =>
  new Request("https://exemplo.test/api/chat", { headers });

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("hitRateLimit", () => {
  it("libera quando a função do banco autoriza", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 42 }], error: null });

    await expect(hitRateLimit("chat:1.2.3.4", { max: 20, windowSeconds: 60 })).resolves.toEqual(
      { allowed: true, retryAfter: 42 },
    );
  });

  it("bloqueia e informa quantos segundos faltam", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 17 }], error: null });

    await expect(hitRateLimit("chat:1.2.3.4", { max: 20, windowSeconds: 60 })).resolves.toEqual(
      { allowed: false, retryAfter: 17 },
    );
  });

  it("repassa a chave e os limites para o RPC", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });

    await hitRateLimit("upload:9.9.9.9", { max: 10, windowSeconds: 600 });

    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", {
      p_key: "upload:9.9.9.9",
      p_max: 10,
      p_window_seconds: 600,
    });
  });

  it("falha aberta quando o banco devolve erro", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "conexão caiu" } });

    await expect(hitRateLimit("chat:1.2.3.4", { max: 1, windowSeconds: 60 })).resolves.toEqual(
      { allowed: true, retryAfter: 0 },
    );
  });

  it("falha aberta quando a resposta vem vazia", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(hitRateLimit("chat:1.2.3.4", { max: 1, windowSeconds: 60 })).resolves.toEqual(
      { allowed: true, retryAfter: 0 },
    );
  });
});

describe("clientIp", () => {
  it("prefere o header que a Vercel escreve", () => {
    expect(
      clientIp(
        request({
          "x-vercel-forwarded-for": "1.1.1.1",
          "x-forwarded-for": "2.2.2.2",
          "x-real-ip": "3.3.3.3",
        }),
      ),
    ).toBe("1.1.1.1");
  });

  it("cai para x-forwarded-for e depois para x-real-ip", () => {
    expect(clientIp(request({ "x-forwarded-for": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(request({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("pega o primeiro IP da cadeia de proxies", () => {
    expect(
      clientIp(request({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })),
    ).toBe("1.2.3.4");
  });

  it("usa um bucket único quando não há header nenhum", () => {
    expect(clientIp(request({}))).toBe("desconhecido");
    expect(clientIp(request({ "x-forwarded-for": "  " }))).toBe("desconhecido");
  });
});
