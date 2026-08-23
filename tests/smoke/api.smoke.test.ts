import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

describe("API smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import("../../src/app.js");
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok and x-request-id", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "ok",
      service: "figapp-backend",
    });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /profile without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/profile" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("GET /children without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/children" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /daily-logs without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/daily-logs" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /billing/access without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/billing/access" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /internal/billing/collect without cron secret returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/internal/billing/collect",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("POST /webhooks/gocardless without signature returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/gocardless",
      headers: { "content-type": "application/json" },
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("schema validation returns friendly VALIDATION_ERROR", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/daily-logs/00000000-0000-0000-0000-000000000001",
      headers: {
        authorization: "Bearer not-a-real-token",
        "content-type": "application/json",
      },
      payload: { intent: "nope" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(String(body.message).toLowerCase()).toContain("datajson");
    expect(String(body.message).toLowerCase()).not.toContain("fst_err");
  });
});
