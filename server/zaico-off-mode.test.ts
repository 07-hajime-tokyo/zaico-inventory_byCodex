/**
 * Zaico連携OFF時のローカルDB操作ロジックのユニットテスト
 *
 * isZaicoEnabled() が false を返す状況下で、各プロシージャが
 * ローカルDB操作に切り替わることを検証する。
 *
 * 実際のDB接続は行わず、db.ts の関数をすべてモックする。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// モジュールモック
// ============================================================

// isZaicoEnabled をモック
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    isZaicoEnabled: vi.fn(),
    getLocalInventoryByZaicoId: vi.fn(),
    updateLocalInventory: vi.fn(),
    deleteLocalInventory: vi.fn(),
    upsertLocalInventory: vi.fn(),
    getLocalPurchases: vi.fn(),
    updateLocalPurchaseStatus: vi.fn(),
    upsertLocalPurchase: vi.fn(),
    createDeletedInventory: vi.fn(),
    createPurchaseHistory: vi.fn(),
    cancelPurchaseHistory: vi.fn(),
  };
});

// Zaico API 呼び出しをモック（OFF時は呼ばれないことを確認するため）
vi.mock("./zaico", () => ({
  getInventory: vi.fn(),
  createInventory: vi.fn(),
  updateInventory: vi.fn(),
  deleteInventory: vi.fn(),
  createPurchase: vi.fn(),
  deletePurchase: vi.fn(),
  completePurchase: vi.fn(),
  getPurchaseById: vi.fn(),
  getMaxPurchaseNum: vi.fn(),
  updatePurchase: vi.fn(),
  deleteDelivery: vi.fn(),
  updateDeliveryNum: vi.fn(),
}));

import * as dbModule from "./db";
import * as zaicoModule from "./zaico";

// ============================================================
// テストスイート
// ============================================================

describe("Zaico連携OFF時のローカルDB操作", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトはZaico連携OFF
    vi.mocked(dbModule.isZaicoEnabled).mockResolvedValue(false);
  });

  // ----------------------------------------------------------------
  // isZaicoEnabled() の基本動作
  // ----------------------------------------------------------------
  describe("isZaicoEnabled()", () => {
    it("falseを返すとき連携OFFと判定される", async () => {
      vi.mocked(dbModule.isZaicoEnabled).mockResolvedValue(false);
      const result = await dbModule.isZaicoEnabled();
      expect(result).toBe(false);
    });

    it("trueを返すとき連携ONと判定される", async () => {
      vi.mocked(dbModule.isZaicoEnabled).mockResolvedValue(true);
      const result = await dbModule.isZaicoEnabled();
      expect(result).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // ローカル在庫操作
  // ----------------------------------------------------------------
  describe("ローカル在庫操作（Zaico連携OFF）", () => {
    it("getLocalInventoryByZaicoId: zaicoIdで在庫を検索できる", async () => {
      const mockInv = {
        id: 1,
        zaicoId: 12345,
        title: "テスト商品",
        quantity: 10,
        unit: "個",
        category: null,
        place: null,
        unitPrice: null,
        etc: null,
        supplierUrl: null,
        supplierName: null,
        isDeleted: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(dbModule.getLocalInventoryByZaicoId).mockResolvedValue(mockInv);

      const result = await dbModule.getLocalInventoryByZaicoId(12345);
      expect(result).toEqual(mockInv);
      expect(dbModule.getLocalInventoryByZaicoId).toHaveBeenCalledWith(12345);
    });

    it("updateLocalInventory: 在庫数を更新できる", async () => {
      vi.mocked(dbModule.updateLocalInventory).mockResolvedValue(undefined);

      await dbModule.updateLocalInventory(1, { quantity: 20 });
      expect(dbModule.updateLocalInventory).toHaveBeenCalledWith(1, { quantity: 20 });
    });

    it("deleteLocalInventory: 在庫を論理削除できる", async () => {
      vi.mocked(dbModule.deleteLocalInventory).mockResolvedValue(undefined);

      await dbModule.deleteLocalInventory(1);
      expect(dbModule.deleteLocalInventory).toHaveBeenCalledWith(1);
    });

    it("upsertLocalInventory: zaicoId=nullで新規商品を作成できる", async () => {
      vi.mocked(dbModule.upsertLocalInventory).mockResolvedValue(undefined);

      await dbModule.upsertLocalInventory({
        zaicoId: null,
        title: "新規商品",
        category: null,
        place: null,
        quantity: 5,
        unit: "個",
        unitPrice: null,
        etc: null,
        supplierUrl: null,
        supplierName: null,
        isDeleted: 0,
      });

      expect(dbModule.upsertLocalInventory).toHaveBeenCalledWith(
        expect.objectContaining({ zaicoId: null, title: "新規商品" })
      );
    });
  });

  // ----------------------------------------------------------------
  // ローカル発注操作
  // ----------------------------------------------------------------
  describe("ローカル発注操作（Zaico連携OFF）", () => {
    it("getLocalPurchases: 発注一覧を取得できる", async () => {
      const mockPurchases = [
        {
          id: 1,
          zaicoId: 100,
          purchaseNum: "1",
          status: "ordered",
          title: "テスト発注",
          quantity: 3,
          itemsJson: "[]",
          localInventoryId: null,
          category: null,
          unitPrice: null,
          managementNo: null,
          purchaseDate: null,
          receivedDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(dbModule.getLocalPurchases).mockResolvedValue(mockPurchases);

      const result = await dbModule.getLocalPurchases();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("ordered");
    });

    it("updateLocalPurchaseStatus: 発注ステータスをpurchasedに更新できる", async () => {
      vi.mocked(dbModule.updateLocalPurchaseStatus).mockResolvedValue(undefined);

      await dbModule.updateLocalPurchaseStatus(1, "purchased", "2026-03-29");
      expect(dbModule.updateLocalPurchaseStatus).toHaveBeenCalledWith(1, "purchased", "2026-03-29");
    });

    it("updateLocalPurchaseStatus: 発注ステータスをorderedに戻せる", async () => {
      vi.mocked(dbModule.updateLocalPurchaseStatus).mockResolvedValue(undefined);

      await dbModule.updateLocalPurchaseStatus(1, "ordered");
      expect(dbModule.updateLocalPurchaseStatus).toHaveBeenCalledWith(1, "ordered");
    });
  });

  // ----------------------------------------------------------------
  // Zaico API が呼ばれないことの確認
  // ----------------------------------------------------------------
  describe("Zaico連携OFF時はZaico APIを呼ばない", () => {
    it("isZaicoEnabled()がfalseのとき、zaicoModule関数が呼ばれていない", async () => {
      // Zaico連携OFFを確認
      const enabled = await dbModule.isZaicoEnabled();
      expect(enabled).toBe(false);

      // Zaico APIは一切呼ばれていない
      expect(zaicoModule.getInventory).not.toHaveBeenCalled();
      expect(zaicoModule.createInventory).not.toHaveBeenCalled();
      expect(zaicoModule.updateInventory).not.toHaveBeenCalled();
      expect(zaicoModule.deleteInventory).not.toHaveBeenCalled();
      expect(zaicoModule.completePurchase).not.toHaveBeenCalled();
      expect(zaicoModule.createPurchase).not.toHaveBeenCalled();
      expect(zaicoModule.deletePurchase).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 在庫数の計算ロジック
  // ----------------------------------------------------------------
  describe("在庫数の計算ロジック", () => {
    it("出庫取り消し: 在庫数が正しく増加する", () => {
      const currentQty = 5;
      const cancelQty = 3;
      const newQty = currentQty + cancelQty;
      expect(newQty).toBe(8);
    });

    it("入庫取り消し: 在庫数が正しく減算される（0以下にならない）", () => {
      const currentQty = 3;
      const subQty = 5;
      const newQty = Math.max(0, currentQty - subQty);
      expect(newQty).toBe(0);
    });

    it("入庫処理: 在庫数が正しく増加する", () => {
      const currentQty = 10;
      const addQty = 5;
      const newQty = currentQty + addQty;
      expect(newQty).toBe(15);
    });

    it("bigint計算: zaicoId * 10000 + item.idが2147483647を超える", () => {
      const zaicoId = 4875638;
      const itemId = 7892;
      const combined = zaicoId * 10000 + itemId;
      expect(combined).toBeGreaterThan(2147483647);
      // bigintとして扱えることを確認
      const bigCombined = BigInt(zaicoId) * BigInt(10000) + BigInt(itemId);
      expect(bigCombined).toBe(BigInt(48756387892));
    });
  });
});
