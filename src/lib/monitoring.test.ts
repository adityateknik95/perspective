import { afterEach, describe, expect, it, vi } from "vitest";
import { buildErrorReport, reportError } from "./monitoring";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("reportError", () => {
  it("is a no-op (beyond the local log) when ERROR_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    await reportError(new Error("boom"), {}, fetchSpy as unknown as typeof fetch);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs a JSON report when configured", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    await reportError(new Error("boom"), { context: { route: "/write" } }, fetchSpy as unknown as typeof fetch);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://hooks.example/abc");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ message: "boom", source: "server", context: { route: "/write" } });
    expect(body.text).toContain("server error: Error: boom");
  });

  it("never throws, even when the webhook is down", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(reportError(new Error("boom"), {}, failing as unknown as typeof fetch)).resolves.toBeUndefined();
  });
});

describe("buildErrorReport", () => {
  it("carries Next's digest so a client report can be matched to server logs", () => {
    const err = Object.assign(new Error("redacted"), { digest: "123456" });
    expect(buildErrorReport(err, { source: "client" }).digest).toBe("123456");
  });

  it("handles non-Error throwables", () => {
    expect(buildErrorReport("just a string").message).toBe("just a string");
  });

  it("bounds the payload", () => {
    const err = new Error("x");
    err.stack = "s".repeat(10_000);
    const report = buildErrorReport(err, { context: { blob: "y".repeat(5000) } });
    expect(report.stack!.length).toBe(4000);
    expect(report.context).toEqual({ truncated: true });
  });

  it("labels the environment (Vercel env wins over NODE_ENV)", () => {
    expect(buildErrorReport(new Error("x"), {}, { VERCEL_ENV: "preview", NODE_ENV: "production" }).environment).toBe("preview");
  });
});
