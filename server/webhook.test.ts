/**
 * GAS Webhook エンドポイントのテスト
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerWebhookRoutes, getCategoryFromProductName } from "./webhook";

// Zaico API 関数をモック
vi.mock("./zaico", () => ({
  createInventory: vi.fn().mockResolvedValue({
    code: 200,
    status: "ok",
    message: "在庫データを登録しました",
    data_id: 12345,
  }),
  createPurchase: vi.fn().mockResolvedValue({
    code: 200,
    status: "ok",
    message: "入庫データを登録しました",
    data_id: 67890,
  }),
  getMaxPurchaseNum: vi.fn().mockResolvedValue(100),
}));

// Local DB functions are used by default because Zaico integration is OFF.
vi.mock("./db", () => ({
  isZaicoEnabled: vi.fn().mockResolvedValue(false),
  upsertLocalInventory: vi.fn().mockResolvedValue(undefined),
  upsertLocalPurchase: vi.fn().mockResolvedValue(undefined),
  upsertInventoryExtra: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

// ENV をモック
vi.mock("./_core/env", () => ({
  ENV: {
    gasWebhookSecret: "test-secret-key-12345",
  },
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerWebhookRoutes(app);
  return app;
}

describe("GAS Webhook エンドポイント", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe("GET /api/gas-webhook/health", () => {
    it("ヘルスチェックが正常に返る", async () => {
      const res = await request(app).get("/api/gas-webhook/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("POST /api/gas-webhook/register-product", () => {
    it("カテゴリー未指定時は商品名から自動判別される", async () => {
      const { upsertLocalInventory } = await import("./db");
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "Vita2000 ブラック",
          quantity: 1,
          registerType: "inventory",
        });

      expect(res.status).toBe(200);
      expect(upsertLocalInventory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "Vita2000" })
      );
    });

    it("カテゴリー指定時はそれを優先する", async () => {
      const { upsertLocalInventory } = await import("./db");
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "Vita2000 ブラック",
          category: "カスタムカテゴリ",
          quantity: 1,
          registerType: "inventory",
        });

      expect(res.status).toBe(200);
      expect(upsertLocalInventory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "カスタムカテゴリ" })
      );
    });

    it("判別できない商品名は「ゲーム」カテゴリーになる", async () => {
      const { upsertLocalInventory } = await import("./db");
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "ファミコンミニ",
          quantity: 1,
          registerType: "inventory",
        });

      expect(res.status).toBe(200);
      expect(upsertLocalInventory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "ゲーム" })
      );
    });
    it("正しいシークレットキーで在庫登録が成功する", async () => {
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "テスト商品",
          quantity: 1,
          registerType: "inventory",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.inventory).toBeDefined();
      expect(res.body.results.inventory.id).toBe(0);
    });

    it("誤ったシークレットキーで401エラーが返る", async () => {
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "wrong-secret",
          productName: "テスト商品",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("認証エラー");
    });

    it("シークレットキーなしで401エラーが返る", async () => {
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          productName: "テスト商品",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("商品名なしで400エラーが返る", async () => {
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("商品名");
    });

    it("SRN番号・仕入先・仕入単価を含む在庫登録が成功する", async () => {
      const { upsertLocalInventory } = await import("./db");
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "PS5本体",
          srnNumber: "SRN-001",
          supplier: "アマゾン",
          quantity: 2,
          purchasePrice: 59800,
          registerType: "inventory",
          rowIndex: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(upsertLocalInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "PS5本体",
          quantity: 2,
          unitPrice: "59800",
          etc: "SRN-001",
        })
      );
    });

    it("registerType=bothで在庫と発注済みの両方が登録される", async () => {
      const { upsertLocalInventory, upsertLocalPurchase } = await import("./db");
      const res = await request(app)
        .post("/api/gas-webhook/register-product")
        .send({
          secret: "test-secret-key-12345",
          productName: "テスト商品",
          quantity: 1,
          purchasePrice: 1000,
          registerType: "both",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.inventory).toBeDefined();
      expect(res.body.results.purchase).toBeDefined();
      expect(upsertLocalInventory).toHaveBeenCalledOnce();
      expect(upsertLocalPurchase).toHaveBeenCalledOnce();
    });
  });
});

describe("getCategoryFromProductName", () => {
  const cases: [string, string][] = [
    ["Switch Lite ブルー", "スイッチライト"],
    ["Nintendo Switch Lite", "スイッチライト"],
    ["Nintendo Switch 有機ELモデル", "スイッチ"],
    ["スイッチ 本体", "スイッチ"],
    ["Vita2000 ブラック", "Vita2000"],
    ["PS Vita PCH-2000", "Vita2000"],
    ["Vita1000 ホワイト", "Vita1000"],
    ["PS Vita PCH-1000", "Vita1000"],
    ["New3DSLL ブラック", "New3DSLL"],
    ["New 3DS XL", "New3DSLL"],
    ["New3DS ホワイト", "New3DS"],
    ["New2DSLL ブラック", "New2DSLL"],
    ["3DSLL レッド", "3DSLL"],
    ["3DS XL ブルー", "3DSLL"],
    ["3DS ブラック", "3DS"],
    ["DS Lite ピンク", "DS lite"],
    ["DSi LL ブラック", "DSi LL"],
    ["DSi XL ホワイト", "DSi LL"],
    ["DSi ブラック", "DSi"],
    ["PSP-3000 ブラック", "PSP"],
    ["ファミコンミニ", "ゲーム"],
    ["メガドライブ", "ゲーム"],
    ["ゲームボーイアドバンス", "ゲーム"],
    ["", "ゲーム"],
  ];

  it.each(cases)("「%s」→ %s", (input, expected) => {
    expect(getCategoryFromProductName(input)).toBe(expected);
  });
});
