/**
 * /api/verify-code エンドポイントのテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerVerifyCodeRoutes } from "./verify-code";

// getSystemSetting をモック
vi.mock("./db", () => ({
  getSystemSetting: vi.fn(),
}));

import { getSystemSetting } from "./db";

const ALLOWED_ORIGIN = "https://csvsearch.example.com";

function buildApp() {
  const app = express();
  app.use(express.json());
  registerVerifyCodeRoutes(app);
  return app;
}

describe("POST /api/verify-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("招待コードが未設定の場合は valid: true を返す", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({ code: "anything" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
  });

  it("正しいコードを送ると valid: true を返す", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue("secret123");
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({ code: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
  });

  it("間違ったコードを送ると valid: false を返す", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue("secret123");
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({ code: "wrong" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false });
  });

  it("code フィールドが文字列でない場合は 400 を返す", async () => {
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({ code: 12345 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("code フィールドが存在しない場合は 400 を返す", async () => {
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("空文字列のコードは間違いとして扱う（コードが設定されている場合）", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue("secret123");
    const res = await request(buildApp())
      .post("/api/verify-code")
      .send({ code: "" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false });
  });
});

describe("CORS ヘッダー", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSystemSetting).mockResolvedValue(null);
    process.env.VERIFY_CODE_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
  });

  it("許可オリジンからのリクエストに Access-Control-Allow-Origin を返す", async () => {
    const res = await request(buildApp())
      .post("/api/verify-code")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ code: "test" });
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("許可されていないオリジンには Access-Control-Allow-Origin を返さない", async () => {
    const res = await request(buildApp())
      .post("/api/verify-code")
      .set("Origin", "https://evil.example.com")
      .send({ code: "test" });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("OPTIONS プリフライトに 204 を返す", async () => {
    const res = await request(buildApp())
      .options("/api/verify-code")
      .set("Origin", ALLOWED_ORIGIN);
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });
});
