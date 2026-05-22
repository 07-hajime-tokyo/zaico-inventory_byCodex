import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Zaico APIクライアントをモック
vi.mock("./zaico", () => ({
  testConnection: vi.fn(),
  getPurchases: vi.fn(),
  completePurchase: vi.fn(),
  getInventories: vi.fn(),
  getInventory: vi.fn(),
  updateInventory: vi.fn(),
  createInventory: vi.fn(),
  deleteInventory: vi.fn(),
  createDelivery: vi.fn(),
  deleteDelivery: vi.fn(),
  createPurchase: vi.fn(),
  updateDeliveryNum: vi.fn(),
  getPurchaseById: vi.fn(),
  getMaxPurchaseNum: vi.fn(),
  deletePurchase: vi.fn(),
  getLatestPurchaseDateMap: vi.fn().mockResolvedValue({}),
  getAllPurchases: vi.fn().mockResolvedValue([]),
}));

// DBヘルパーをモック
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertPurchaseExtra: vi.fn(),
  getAllPurchaseExtras: vi.fn(),
  getPurchaseExtraByZaicoId: vi.fn(),
  createDeliveryHistory: vi.fn(),
  getDeliveryHistories: vi.fn(),
  markDeliveryItemsDeleted: vi.fn().mockResolvedValue(undefined),
  updateDeliveryNo: vi.fn().mockResolvedValue(undefined),
  createDeletedInventory: vi.fn().mockResolvedValue(undefined),
  getDeletedInventories: vi.fn().mockResolvedValue([]),
  removeDeletedInventory: vi.fn().mockResolvedValue(undefined),
  upsertInventoryExtra: vi.fn().mockResolvedValue(undefined),
  getAllInventoryExtras: vi.fn().mockResolvedValue([]),
  deleteInventoryExtra: vi.fn().mockResolvedValue(undefined),
  createInventoryMemo: vi.fn().mockResolvedValue(undefined),
  getInventoryMemos: vi.fn().mockResolvedValue([]),
  getAllInventoryMemos: vi.fn().mockResolvedValue([]),
  getPurchaseHistories: vi.fn().mockResolvedValue([]),
  cancelPurchaseHistory: vi.fn().mockResolvedValue(undefined),
  createPurchaseHistory: vi.fn().mockResolvedValue(undefined),
  getDeliveryHistoryById: vi.fn(),
  updateDeliveryCancelledItems: vi.fn().mockResolvedValue(undefined),
  getLatestPurchaseDateMapFromDB: vi.fn().mockResolvedValue({}),
  // Zaico連携スイッチ（既存テストは連携ONを前提にしている）
  isZaicoEnabled: vi.fn().mockResolvedValue(true),
  // ローカルDB操作（Zaico連携OFF時に使用）
  getLocalInventoryByZaicoId: vi.fn().mockResolvedValue(null),
  updateLocalInventory: vi.fn().mockResolvedValue(undefined),
  deleteLocalInventory: vi.fn().mockResolvedValue(undefined),
  upsertLocalInventory: vi.fn().mockResolvedValue(undefined),
  getLocalPurchases: vi.fn().mockResolvedValue([]),
  updateLocalPurchaseStatus: vi.fn().mockResolvedValue(undefined),
  upsertLocalPurchase: vi.fn().mockResolvedValue(undefined),
}));
import * as zaicoModule from "./zaico";
import * as dbModule from "./db";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("zaico.testConnection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("接続成功時にsuccess:trueを返す", async () => {
    vi.mocked(zaicoModule.testConnection).mockResolvedValue({
      success: true,
      message: "接続に成功しました",
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.testConnection({ token: "valid-token" });

    expect(result.success).toBe(true);
    expect(result.message).toBe("接続に成功しました");
    expect(zaicoModule.testConnection).toHaveBeenCalledWith("valid-token");
  });

  it("接続失敗時にsuccess:falseを返す", async () => {
    vi.mocked(zaicoModule.testConnection).mockResolvedValue({
      success: false,
      message: "Zaico API エラー: 401 Unauthorized",
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.testConnection({ token: "invalid-token" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("401");
  });

  it("空のトークンはバリデーションエラーになる", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.zaico.testConnection({ token: "" })
    ).rejects.toThrow();
  });
});

describe("zaico.getPurchases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("入庫予定一覧と補足情報をマージして返す", async () => {
    vi.mocked(zaicoModule.getPurchases).mockResolvedValue([
      {
        id: 1,
        num: "P-001",
        customer_name: "テスト仕入先",
        status: "ordered",
        total_amount: 1000,
        purchase_date: null,
        estimated_purchase_date: "2024-01-15",
        create_user_name: "テストユーザー",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [],
      },
    ]);
    vi.mocked(dbModule.getAllPurchaseExtras).mockResolvedValue([
      {
        id: 1,
        zaicoId: 1,
        shipDate: "2024-01-10",
        trackingNumber: "123456789",
        note: "テスト備考",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.getPurchases();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].extra?.shipDate).toBe("2024-01-10");
    expect(result[0].extra?.trackingNumber).toBe("123456789");
  });

  it("補足情報がない場合はextra:nullを返す", async () => {
    vi.mocked(zaicoModule.getPurchases).mockResolvedValue([
      {
        id: 2,
        num: "P-002",
        customer_name: "仕入先B",
        status: "not_ordered",
        total_amount: 500,
        purchase_date: null,
        estimated_purchase_date: null,
        create_user_name: "ユーザー",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [],
      },
    ]);
    vi.mocked(dbModule.getAllPurchaseExtras).mockResolvedValue([]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.getPurchases();

    expect(result[0].extra).toBeNull();
  });
});

describe("zaico.completePurchase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("入庫処理が正常に完了する", async () => {
    vi.mocked(zaicoModule.completePurchase).mockResolvedValue({
      code: 200,
      status: "success",
      message: "入庫処理が完了しました",
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.completePurchase({
      purchaseId: 1,
      purchaseDate: "2024-01-15",
      purchaseItems: [
        { inventory_id: 100, quantity: "3", unit_price: "1000" },
      ],
    });

    expect(result.code).toBe(200);
    expect(zaicoModule.completePurchase).toHaveBeenCalledWith(
      1,
      "2024-01-15",
      [{ inventory_id: 100, quantity: "3", unit_price: "1000" }],
      undefined // operatorKey未指定の場合undefined
    );
  });

  it("不正な日付形式はバリデーションエラーになる", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.zaico.completePurchase({
        purchaseId: 1,
        purchaseDate: "2024/01/15",
        purchaseItems: [{ inventory_id: 100, quantity: "1", unit_price: "0" }],
      })
    ).rejects.toThrow();
  });
});

describe("zaico.createDelivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("出庫処理が成功し履歴が保存される", async () => {
    vi.mocked(zaicoModule.createDelivery).mockResolvedValue({
      code: 200,
      status: "success",
      message: "出庫処理が完了しました",
      data_id: 999,
    });
    vi.mocked(dbModule.createDeliveryHistory).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.createDelivery({
      deliveryNo: "D-2024-001",
      deliveryDate: "2024-01-15",
      items: [
        { inventoryId: 10, title: "商品A", quantity: 5 },
        { inventoryId: 11, title: "商品B", quantity: 3 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.zaicoDeliveryId).toBe(999);
    expect(dbModule.createDeliveryHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryNo: "D-2024-001",
        zaicoDeliveryId: 999,
        status: "success",
      })
    );
  });

  it("Zaico APIエラー時も履歴にerrorステータスで保存される", async () => {
    vi.mocked(zaicoModule.createDelivery).mockRejectedValue(
      new Error("Zaico API エラー: 500 Internal Server Error")
    );
    vi.mocked(dbModule.createDeliveryHistory).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.zaico.createDelivery({
        deliveryNo: "D-2024-002",
        deliveryDate: "2024-01-15",
        items: [{ inventoryId: 10, title: "商品A", quantity: 5 }],
      })
    ).rejects.toThrow();

    expect(dbModule.createDeliveryHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryNo: "D-2024-002",
        status: "error",
      })
    );
  });

  it("空の商品リストはバリデーションエラーになる", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.zaico.createDelivery({
        deliveryNo: "D-2024-003",
        deliveryDate: "2024-01-15",
        items: [],
      })
    ).rejects.toThrow();
  });
});

describe("purchaseExtra.upsert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("補足情報を保存できる", async () => {
    vi.mocked(dbModule.upsertPurchaseExtra).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.purchaseExtra.upsert({
      zaicoId: 1,
      shipDate: "2024-01-10",
      trackingNumber: "ABC123",
      note: "テスト備考",
    });

    expect(result.success).toBe(true);
    expect(dbModule.upsertPurchaseExtra).toHaveBeenCalledWith(
      expect.objectContaining({
        zaicoId: 1,
        shipDate: "2024-01-10",
        trackingNumber: "ABC123",
      })
    );
  });
});

describe("deliveryHistory.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("出庫履歴一覧を返す", async () => {
    vi.mocked(dbModule.getDeliveryHistories).mockResolvedValue([
      {
        id: 1,
        deliveryNo: "D-2024-001",
        zaicoDeliveryId: 999,
        itemsJson: JSON.stringify([{ inventoryId: 10, title: "商品A", quantity: 5 }]),
        status: "success",
        errorMessage: null,
        deletedInventoryIdsJson: null,
        cancelledItemsJson: null,
        createdAt: new Date("2024-01-15T10:00:00Z"),
      },
    ]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.list({ limit: 100 });

    expect(result).toHaveLength(1);
    expect(result[0].deliveryNo).toBe("D-2024-001");
    expect(result[0].items).toEqual([{ inventoryId: 10, title: "商品A", quantity: 5 }]);
    expect(result[0].cancelledItems).toEqual([]);
  });

  it("取り消し済み商品情報をパースして返す", async () => {
    const cancelledAt = "2024-01-16T10:00:00Z";
    vi.mocked(dbModule.getDeliveryHistories).mockResolvedValue([
      {
        id: 2,
        deliveryNo: "D-2024-002",
        zaicoDeliveryId: 1000,
        itemsJson: JSON.stringify([{ inventoryId: 20, title: "商品B", quantity: 3 }]),
        status: "success",
        errorMessage: null,
        deletedInventoryIdsJson: null,
        cancelledItemsJson: JSON.stringify([{ inventoryId: 20, quantity: 3, cancelledAt }]),
        createdAt: new Date("2024-01-15T10:00:00Z"),
      },
    ]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.list({ limit: 100 });

    expect(result[0].cancelledItems).toHaveLength(1);
    expect(result[0].cancelledItems[0].inventoryId).toBe(20);
    expect(result[0].cancelledItems[0].quantity).toBe(3);
  });
});

describe("deliveryHistory.cancelItem（出庫取り消し・個別）", () => {
  beforeEach(() => vi.clearAllMocks());
  it("出庫商品が1商品のみの場合、Zaico出庫データを削除して在庫数を自動復元する", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([{ inventoryId: 10, title: "商品A", quantity: 5 }]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: null,
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });
    // deleteDelivery後に在庫数を取得するためgetInventoryをモック
    vi.mocked(zaicoModule.deleteDelivery).mockResolvedValue({
      code: 200,
      status: "success",
      message: "Data was successfully deleted",
    });
    vi.mocked(zaicoModule.getInventory).mockResolvedValue({
      id: 10,
      title: "商品A",
      quantity: "25", // 削除後に復元された値
      unit: "個",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.cancelItem({
      historyId: 1,
      inventoryId: 10,
      quantity: 5,
    });
    expect(result.success).toBe(true);
    expect(result.newQuantity).toBe(25);
    // Zaico出庫データ削除が呼び出されていること
    expect(zaicoModule.deleteDelivery).toHaveBeenCalledWith(999, undefined);
    // updateInventoryは呼ばれない（Zaico側で自動復元されるため）
    expect(zaicoModule.updateInventory).not.toHaveBeenCalled();
    // DBの取り消し済みリストが更新されていること
    expect(dbModule.updateDeliveryCancelledItems).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ inventoryId: 10, quantity: 5 }),
      ])
    );
  });
  it("出庫商品が複数の場合、在庫数を直接増加する", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([
        { inventoryId: 10, title: "商品A", quantity: 5 },
        { inventoryId: 11, title: "商品B", quantity: 3 },
      ]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: null,
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });
    vi.mocked(zaicoModule.getInventory).mockResolvedValue({
      id: 10, title: "商品A", quantity: "20", unit: "個", created_at: "", updated_at: "",
    });
    vi.mocked(zaicoModule.updateInventory).mockResolvedValue({
      code: 200, status: "ok", message: "更新しました",
    });
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.cancelItem({
      historyId: 1,
      inventoryId: 10,
      quantity: 5,
    });
    expect(result.success).toBe(true);
    expect(result.newQuantity).toBe(25); // 20 + 5
    // 複数商品なのでdeleteDeliveryは呼ばれない
    expect(zaicoModule.deleteDelivery).not.toHaveBeenCalled();
    // Zaico在庫数が直接増加されていること
    expect(zaicoModule.updateInventory).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ quantity: "25" }),
      undefined
    );
    expect(dbModule.updateDeliveryCancelledItems).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ inventoryId: 10, quantity: 5 }),
      ])
    );
  });
  it("既に取り消し済みの商品はエラーになる", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([{ inventoryId: 10, title: "商品A", quantity: 5 }]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: JSON.stringify([{ inventoryId: 10, quantity: 5, cancelledAt: "2024-01-16T00:00:00Z" }]),
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.deliveryHistory.cancelItem({
        historyId: 1,
        inventoryId: 10,
        quantity: 5,
      })
    ).rejects.toThrow("この商品は既に取り消し済みです");

    // Zaico在庫数は変更されないこと
    expect(zaicoModule.updateInventory).not.toHaveBeenCalled();
  });

  it("出庫履歴が見つからない場合はエラーになる", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue(null);

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.deliveryHistory.cancelItem({
        historyId: 99999,
        inventoryId: 10,
        quantity: 5,
      })
    ).rejects.toThrow("出庫履歴が見つかりません");
  });
});

describe("deliveryHistory.cancelItems（出庫取り消し・一括）", () => {
  beforeEach(() => vi.clearAllMocks());

   it("全商品を取り消す場合、Zaico出庫データを削除して全商品の在庫数を自動復元する", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([
        { inventoryId: 10, title: "商品A", quantity: 5 },
        { inventoryId: 11, title: "商品B", quantity: 3 },
      ]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: null,
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });
    vi.mocked(zaicoModule.deleteDelivery).mockResolvedValue({
      code: 200, status: "success", message: "Data was successfully deleted",
    });
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.cancelItems({
      historyId: 1,
      items: [
        { inventoryId: 10, quantity: 5 },
        { inventoryId: 11, quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(0);
    // 全商品取り消しなのでdeleteDeliveryが呼び出されていること
    expect(zaicoModule.deleteDelivery).toHaveBeenCalledWith(999, undefined);
    // updateInventoryは呼ばれない（Zaico側で自動復元されるため）
    expect(zaicoModule.updateInventory).not.toHaveBeenCalled();
    // DBの取り消し済みリストが更新されていること
    expect(dbModule.updateDeliveryCancelledItems).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ inventoryId: 10, quantity: 5 }),
        expect.objectContaining({ inventoryId: 11, quantity: 3 }),
      ])
    );
  });

  it("既に取り消し済みの商品は除外し、残りの全商品を取り消す場合はZaico出庫データを削除する", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([
        { inventoryId: 10, title: "商品A", quantity: 5 },
        { inventoryId: 11, title: "商品B", quantity: 3 },
      ]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      // 商品Aは既に取り消し済み
      cancelledItemsJson: JSON.stringify([{ inventoryId: 10, quantity: 5, cancelledAt: "2024-01-16T00:00:00Z" }]),
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });
    vi.mocked(zaicoModule.deleteDelivery).mockResolvedValue({
      code: 200, status: "success", message: "Data was successfully deleted",
    });
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.cancelItems({
      historyId: 1,
      items: [
        { inventoryId: 10, quantity: 5 }, // 既に取り消し済み（除外される）
        { inventoryId: 11, quantity: 3 }, // 取り消し対象
      ],
    });
    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1); // 商品Bのみ
    // 商品Bが残りの全商品なのでdeleteDeliveryが呼び出される
    expect(zaicoModule.deleteDelivery).toHaveBeenCalledWith(999, undefined);
    // updateInventoryは呼ばれない（Zaico側で自動復元されるため）
    expect(zaicoModule.updateInventory).not.toHaveBeenCalled();
    // DBの取り消し済みリストが更新されていること
    expect(dbModule.updateDeliveryCancelledItems).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ inventoryId: 11, quantity: 3 }),
      ])
    );
  });
  it("一部商品のみ選択した場合、各商品のZaico在庫数を直接増加する", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([
        { inventoryId: 10, title: "商品A", quantity: 5 },
        { inventoryId: 11, title: "商品B", quantity: 3 },
        { inventoryId: 12, title: "商品C", quantity: 2 },
      ]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: null,
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });
    vi.mocked(zaicoModule.getInventory)
      .mockResolvedValueOnce({ id: 10, title: "商品A", quantity: "20", unit: "個", created_at: "", updated_at: "" })
      .mockResolvedValueOnce({ id: 11, title: "商品B", quantity: "10", unit: "個", created_at: "", updated_at: "" });
    vi.mocked(zaicoModule.updateInventory).mockResolvedValue({
      code: 200, status: "ok", message: "更新しました",
    });
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.deliveryHistory.cancelItems({
      historyId: 1,
      items: [
        { inventoryId: 10, quantity: 5 }, // 取り消し対象
        { inventoryId: 11, quantity: 3 }, // 取り消し対象
        // 商品Cは選択しない（一部取り消し）
      ],
    });
    expect(result.success).toBe(true);
    expect(result.successCount).toBe(2);
    // 一部取り消しなのでdeleteDeliveryは呼ばれない
    expect(zaicoModule.deleteDelivery).not.toHaveBeenCalled();
    // Zaico在庫数が直接増加されていること
    expect(zaicoModule.updateInventory).toHaveBeenCalledTimes(2);
    expect(zaicoModule.updateInventory).toHaveBeenCalledWith(
      10, expect.objectContaining({ quantity: "25" }), undefined
    );
    expect(zaicoModule.updateInventory).toHaveBeenCalledWith(
      11, expect.objectContaining({ quantity: "13" }), undefined
    );
  });

  it("全商品取り消し済みの場合はエラーになる", async () => {
    vi.mocked(dbModule.getDeliveryHistoryById).mockResolvedValue({
      id: 1,
      deliveryNo: "D-2024-001",
      zaicoDeliveryId: 999,
      itemsJson: JSON.stringify([{ inventoryId: 10, title: "商品A", quantity: 5 }]),
      status: "success",
      errorMessage: null,
      deletedInventoryIdsJson: null,
      cancelledItemsJson: JSON.stringify([{ inventoryId: 10, quantity: 5, cancelledAt: "2024-01-16T00:00:00Z" }]),
      createdAt: new Date("2024-01-15T10:00:00Z"),
    });

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.deliveryHistory.cancelItems({
        historyId: 1,
        items: [{ inventoryId: 10, quantity: 5 }],
      })
    ).rejects.toThrow("選択した商品はすべて既に取り消し済みです");
  });
});

describe("zaico.deleteInventory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("在庫削除が正常に完了する", async () => {
    vi.mocked(zaicoModule.deleteInventory).mockResolvedValue({
      code: 200,
      status: "success",
      message: "削除しました",
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.deleteInventory({ inventoryId: 123 });

    expect(result.code).toBe(200);
    expect(zaicoModule.deleteInventory).toHaveBeenCalledWith(123, undefined); // operatorKey未指定の場合undefined
  });

  it("存在しない在庫IDはエラーになる", async () => {
    vi.mocked(zaicoModule.deleteInventory).mockRejectedValue(
      new Error("Zaico API エラー: Inventory not found")
    );

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.zaico.deleteInventory({ inventoryId: 99999 })
    ).rejects.toThrow("Inventory not found");
  });
});

describe("zaico.getPurchasesByInventoryId", () => {
  beforeEach(() => vi.clearAllMocks());
  it("在庫IDに紐づく発注データを返す", async () => {
    vi.mocked(zaicoModule.getAllPurchases).mockResolvedValue([
      {
        id: 10,
        num: "P-010",
        customer_name: "",
        status: "ordered" as const,
        total_amount: 0,
        purchase_date: null,
        estimated_purchase_date: null,
        create_user_name: "",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [{ id: 1, inventory_id: 42, title: "3DS", quantity: "2", unit: "個", unit_price: "5000", status: "ordered" as const, purchase_date: null, estimated_purchase_date: null }],
      },
      {
        id: 20,
        num: "P-020",
        customer_name: "",
        status: "ordered" as const,
        total_amount: 0,
        purchase_date: null,
        estimated_purchase_date: null,
        create_user_name: "",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [{ id: 2, inventory_id: 99, title: "Vita", quantity: "1", unit: "個", unit_price: "3000", status: "ordered" as const, purchase_date: null, estimated_purchase_date: null }],
      },
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.getPurchasesByInventoryId({ inventoryId: 42 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });
});

describe("zaico.deleteInventory (連動削除)", () => {
  beforeEach(() => vi.clearAllMocks());
  it("alsoDeletePurchaseIdsを指定すると発注データも削除する", async () => {
    vi.mocked(zaicoModule.deleteInventory).mockResolvedValue({ code: 200, status: "success", message: "削除しました" });
    vi.mocked(zaicoModule.deletePurchase).mockResolvedValue({ code: 200, status: "ok", message: "削除しました" });
    const caller = appRouter.createCaller(createCtx());
    await caller.zaico.deleteInventory({ inventoryId: 123, alsoDeletePurchaseIds: [10, 20] });
    expect(zaicoModule.deletePurchase).toHaveBeenCalledWith(10, undefined);
    expect(zaicoModule.deletePurchase).toHaveBeenCalledWith(20, undefined);
    expect(zaicoModule.deleteInventory).toHaveBeenCalledWith(123, undefined);
  });
  it("alsoDeletePurchaseIdsを指定しない場合は発注データを削除しない", async () => {
    vi.mocked(zaicoModule.deleteInventory).mockResolvedValue({ code: 200, status: "success", message: "削除しました" });
    const caller = appRouter.createCaller(createCtx());
    await caller.zaico.deleteInventory({ inventoryId: 123 });
    expect(zaicoModule.deletePurchase).not.toHaveBeenCalled();
    expect(zaicoModule.deleteInventory).toHaveBeenCalledWith(123, undefined);
  });
});

describe("zaico.getPurchasesWithCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("入庫予定にカテゴリ情報をマッピングして返す", async () => {
    vi.mocked(zaicoModule.getPurchases).mockResolvedValue([
      {
        id: 1,
        num: "P-001",
        customer_name: "テスト仕入先",
        status: "ordered",
        total_amount: 1000,
        purchase_date: null,
        estimated_purchase_date: null,
        create_user_name: "テストユーザー",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [
          {
            id: 10,
            inventory_id: 100,
            title: "DSi LL ダークブラウン",
            quantity: "1",
            unit: "個",
            unit_price: "14000",
            status: "ordered",
            purchase_date: null,
            estimated_purchase_date: null,
          },
        ],
      },
    ]);
    vi.mocked(zaicoModule.getInventories).mockResolvedValue([
      {
        id: 100,
        title: "DSi LL ダークブラウン",
        quantity: "1",
        unit: "個",
        category: "DSi LL",
        categories: ["DSi LL"],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(dbModule.getAllPurchaseExtras).mockResolvedValue([]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.getPurchasesWithCategory();

    expect(result).toHaveLength(1);
    expect(result[0].purchase_items[0].category).toBe("DSi LL");
  });

  it("在庫に存在しないinventory_idは未分類になる", async () => {
    vi.mocked(zaicoModule.getPurchases).mockResolvedValue([
      {
        id: 2,
        num: "P-002",
        customer_name: "仕入先B",
        status: "ordered",
        total_amount: 500,
        purchase_date: null,
        estimated_purchase_date: null,
        create_user_name: "ユーザー",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        purchase_items: [
          {
            id: 20,
            inventory_id: 9999,
            title: "不明商品",
            quantity: "1",
            unit: "個",
            unit_price: "0",
            status: "ordered",
            purchase_date: null,
            estimated_purchase_date: null,
          },
        ],
      },
    ]);
    vi.mocked(zaicoModule.getInventories).mockResolvedValue([]);
    vi.mocked(dbModule.getAllPurchaseExtras).mockResolvedValue([]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.zaico.getPurchasesWithCategory();

    expect(result[0].purchase_items[0].category).toBe("未分類");
  });
});

describe("purchaseHistory.cancel（入庫取り消し）", () => {
  const mockPurchaseItems = [
    { inventory_id: 100, quantity: "2", unit_price: "5000" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletePurchaseを呼び出して入庫データを削除し、新規発注データを作成する", async () => {
    vi.mocked(zaicoModule.getPurchaseById).mockResolvedValue({
      id: 999,
      num: "100",
      customer_name: "テスト仕入先",
      status: "purchased",
      total_amount: 10000,
      purchase_date: "2024-01-01",
      estimated_purchase_date: null,
      create_user_name: "テスト",
      memo: undefined,
      etc: undefined,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      purchase_items: mockPurchaseItems.map((i) => ({
        id: 1,
        ...i,
        title: "テスト商品",
        unit: "個",
        status: "purchased" as const,
        purchase_date: "2024-01-01",
        estimated_purchase_date: null,
      })),
    });
    vi.mocked(zaicoModule.deletePurchase).mockResolvedValue({
      code: 200,
      status: "ok",
      message: "入庫データを削除しました",
    });
    vi.mocked(zaicoModule.getMaxPurchaseNum).mockResolvedValue(100);
    vi.mocked(zaicoModule.createPurchase).mockResolvedValue({
      code: 200,
      status: "ok",
      message: "発注データを作成しました",
      data_id: 1001,
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.purchaseHistory.cancel({
      id: 1,
      purchaseId: 999,
      purchaseItems: mockPurchaseItems,
    });

    expect(result.success).toBe(true);
    // deletePurchaseが呼ばれていること（手動在庫数変更ではなく）
    expect(zaicoModule.deletePurchase).toHaveBeenCalledWith(999, undefined);
    // 新規発注データが作成されていること
    expect(zaicoModule.createPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ordered",
        customer_name: "テスト仕入先",
      }),
      undefined
    );
    // DBの履歴が取り消し済みに更新されていること
    expect(dbModule.cancelPurchaseHistory).toHaveBeenCalledWith(1);
  });

  it("deletePurchaseが失敗した場合はエラーをスローし、DB更新も行わない", async () => {
    vi.mocked(zaicoModule.getPurchaseById).mockResolvedValue(null);
    vi.mocked(zaicoModule.deletePurchase).mockRejectedValue(
      new Error("Zaico API エラー: 404 Not Found")
    );

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.purchaseHistory.cancel({
        id: 1,
        purchaseId: 99999,
        purchaseItems: mockPurchaseItems,
      })
    ).rejects.toThrow();

    // 削除失敗時はDBの履歴更新も行われないこと
    expect(dbModule.cancelPurchaseHistory).not.toHaveBeenCalled();
  });
});
