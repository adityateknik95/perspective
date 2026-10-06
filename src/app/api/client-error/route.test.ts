import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { __resetRateLimits } from "@/lib/rate-limit";

const reportError = vi.fn(async (...args: unknown[]) => {
  void args;
});
vi.mock("@/lib/monitoring", () => ({ reportError: (...a: unknown[]) => reportError(...a) }));

import { POST } from "./route";

const post = (body: unknown, ip = "203.0.113.9") =>
  POST(
    new NextRequest("https://perspective.test/api/client-error", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "x-forwarded-for": ip },
    }),
  );

const valid = { message: "An error occurred in the Server Components render.", digest: "123", path: "/write/x", boundary: "app" };

beforeEach(() => reportError.mockClear());
afterEach(() => __resetRateLimits());

describe("POST /api/client-error", () => {
  it("forwards a valid report as a client error with its digest", async () => {
    const res = await post(valid);
    expect(res.status).toBe(204);
    expect(reportError).toHaveBeenCalledTimes(1);
    const [err, opts] = reportError.mock.calls[0] as unknown as [Error & { digest?: string }, { source: string; context: object }];
    expect(err.message).toBe(valid.message);
    expect(err.digest).toBe("123");
    expect(opts).toEqual({ source: "client", context: { path: "/write/x", boundary: "app", digest: "123" } });
  });

  it.each([
    ["not JSON", "{oops"],
    ["missing fields", { message: "x" }],
    ["unknown boundary", { ...valid, boundary: "evil" }],
    ["oversized body", { ...valid, message: "x".repeat(5000) }],
  ])("silently drops %s (still 204)", async (_name, body) => {
    expect((await post(body)).status).toBe(204);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("stops forwarding after 10 reports a minute from one IP", async () => {
    for (let i = 0; i < 12; i++) await post(valid);
    expect(reportError).toHaveBeenCalledTimes(10);
    await post(valid, "198.51.100.1");
    expect(reportError).toHaveBeenCalledTimes(11);
  });
});
