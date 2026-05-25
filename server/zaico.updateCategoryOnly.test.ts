import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    isZaicoEnabled: vi.fn().mockResolvedValue(false),
    getDb: vi.fn().mockResolvedValue(null),
    getLocalInventoryByZaicoIdOrId: vi.fn().mockResolvedValue({ id: 1, zaicoId: 100 }),
    getLocalPurchases: vi.fn().mockResolvedValue([]),
    updateLocalInventory: vi.fn().mockResolvedValue(undefined),
    getSystemSetting: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("./zaico", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./zaico")>();
  return {
    ...actual,
    getInventory: vi.fn().mockResolvedValue({
      id: 100,
      title: "テスト商品",
      quantity: 5,
      unit: "個",
      category: "ゲーム",
      place: null,
      etc: null,
      purchase_unit_price: 1000,
    }),
    updateInventory: vi.fn().mockResolvedValue(undefined),
  };
});

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, cookies: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("zaico.updateCategoryOnly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Zaico OFF時はlocal inventoryのcategoryを更新する", async () => {
    const { isZaicoEnabled, updateLocalInventory } = await import("./db");
    vi.mocked(isZaicoEnabled).mockResolvedValue(false);

    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.zaico.updateCategoryOnly({
      inventoryId: 100,
      category: "スポーツ",
    });

    expect(result).toEqual({ success: true });
    expect(updateLocalInventory).toHaveBeenCalledWith(1, { category: "スポーツ" });
  });

  it("Zaico OFF時はnull categoryをlocal inventoryへ保存する", async () => {
    const { isZaicoEnabled, updateLocalInventory } = await import("./db");
    vi.mocked(isZaicoEnabled).mockResolvedValue(false);

    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.zaico.updateCategoryOnly({
      inventoryId: 100,
      category: null,
    });

    expect(result).toEqual({ success: true });
    expect(updateLocalInventory).toHaveBeenCalledWith(1, { category: null });
  });

  it("Zaico ON時はZaico inventoryのcategoryを更新する", async () => {
    const { isZaicoEnabled } = await import("./db");
    const { getInventory, updateInventory } = await import("./zaico");
    vi.mocked(isZaicoEnabled).mockResolvedValue(true);

    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.zaico.updateCategoryOnly({
      inventoryId: 100,
      category: "スポーツ",
    });

    expect(result).toEqual({ success: true });
    expect(getInventory).toHaveBeenCalledWith(100);
    expect(updateInventory).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ category: "スポーツ" }),
      undefined
    );
  });

  it("inventoryIdが0以下の場合はバリデーションエラーになる", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.zaico.updateCategoryOnly({ inventoryId: 0, category: "ゲーム" })
    ).rejects.toThrow();
  });
});
