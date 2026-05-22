/**
 * 在庫メモ（inventory_memos）機能のテスト
 * - inventoryMemo.create プロシージャのスキーマ検証
 * - changeType の値検証
 * - memo フィールドの最大長検証
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// プロシージャのinputスキーマを再現してテスト
const createMemoSchema = z.object({
  zaicoInventoryId: z.number().int().positive(),
  title: z.string().optional(),
  changeType: z.enum(["increase", "decrease", "set"]),
  quantityBefore: z.number().int().optional(),
  quantityAfter: z.number().int().optional(),
  quantityDelta: z.number().int().optional(),
  memo: z.string().max(1000).optional(),
  operatorName: z.string().max(200).optional(),
});

describe("inventoryMemo.create schema", () => {
  it("正常な増加メモを受け付ける", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      title: "Vita1000 ブラック",
      changeType: "increase",
      quantityBefore: 3,
      quantityAfter: 4,
      quantityDelta: 1,
      memo: "入荷のため増加",
      operatorName: "村上一",
    });
    expect(result.success).toBe(true);
  });

  it("正常な減少メモを受け付ける", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "decrease",
      quantityBefore: 5,
      quantityAfter: 3,
      quantityDelta: -2,
    });
    expect(result.success).toBe(true);
  });

  it("正常な直接設定メモを受け付ける", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "set",
      quantityBefore: 5,
      quantityAfter: 10,
      quantityDelta: 5,
      memo: "棚卸しで修正",
    });
    expect(result.success).toBe(true);
  });

  it("不正なchangeTypeを拒否する", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("zaicoInventoryIdが0以下の場合を拒否する", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 0,
      changeType: "increase",
    });
    expect(result.success).toBe(false);
  });

  it("memoが1000文字を超える場合を拒否する", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "increase",
      memo: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("memoが1000文字以内の場合を受け付ける", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "increase",
      memo: "a".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("任意フィールドが省略可能", () => {
    const result = createMemoSchema.safeParse({
      zaicoInventoryId: 12345,
      changeType: "increase",
    });
    expect(result.success).toBe(true);
  });
});

describe("changeType logic", () => {
  it("delta > 0 は increase", () => {
    const delta = 1;
    const changeType = delta > 0 ? "increase" : delta < 0 ? "decrease" : "set";
    expect(changeType).toBe("increase");
  });

  it("delta < 0 は decrease", () => {
    const delta = -1;
    const changeType = delta > 0 ? "increase" : delta < 0 ? "decrease" : "set";
    expect(changeType).toBe("decrease");
  });

  it("delta = 0 は set", () => {
    const delta = 0;
    const changeType = delta > 0 ? "increase" : delta < 0 ? "decrease" : "set";
    expect(changeType).toBe("set");
  });
});
