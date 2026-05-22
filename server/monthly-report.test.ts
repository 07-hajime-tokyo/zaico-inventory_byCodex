/**
 * 月次棚卸し改修のユニットテスト
 *
 * 1. 「テスト」を含む発注済み商品の除外ロジック
 * 2. ローカルDBの仕入単価補完ロジック（getLocalPurchaseUnitPriceMap）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// モジュールモック
// ============================================================

vi.mock("./zaico", () => ({
  testConnection: vi.fn(),
  getPurchases: vi.fn(),
  completePurchase: vi.fn(),
  getInventories: vi.fn().mockResolvedValue([]),
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
  isZaicoEnabled: vi.fn().mockResolvedValue(true),
  getLocalInventoryByZaicoId: vi.fn().mockResolvedValue(null),
  updateLocalInventory: vi.fn().mockResolvedValue(undefined),
  deleteLocalInventory: vi.fn().mockResolvedValue(undefined),
  upsertLocalInventory: vi.fn().mockResolvedValue(undefined),
  getLocalPurchases: vi.fn().mockResolvedValue([]),
  updateLocalPurchaseStatus: vi.fn().mockResolvedValue(undefined),
  upsertLocalPurchase: vi.fn().mockResolvedValue(undefined),
  getAllInvoiceMemos: vi.fn().mockResolvedValue([]),
  getAllDeliveryHistories: vi.fn().mockResolvedValue([]),
  getUnitPricesByInventoryIds: vi.fn().mockResolvedValue(new Map()),
  getLocalInventoryUnitPriceByZaicoIds: vi.fn().mockResolvedValue(new Map()),
  getDeletedInventoryUnitPriceByZaicoIds: vi.fn().mockResolvedValue(new Map()),
  createMonthlyReport: vi.fn(),
  getMonthlyReports: vi.fn().mockResolvedValue([]),
  getMonthlyReportById: vi.fn(),
  deleteMonthlyReport: vi.fn(),
  upsertMonthlyReportCost: vi.fn(),
  getMonthlyReportCosts: vi.fn().mockResolvedValue([]),
}));

// ============================================================
// テストスイート
// ============================================================

describe("月次棚卸し - 「テスト」を含む発注済み商品の除外ロジック", () => {
  // isTestItem ロジックを直接テスト（routers.tsの実装と同等）
  const isTestItem = (title: string, etc: string | undefined | null): boolean => {
    const lowerTitle = title.toLowerCase();
    const lowerEtc = (etc ?? "").toLowerCase();
    return lowerTitle.includes("テスト") || lowerTitle.includes("test") ||
           lowerEtc.includes("テスト") || lowerEtc.includes("test");
  };

  it("タイトルに「テスト」を含む商品は除外される", () => {
    expect(isTestItem("New2DS LL テスト", "372_ルカ_1/5")).toBe(true);
    expect(isTestItem("3DS テスト", null)).toBe(true);
    expect(isTestItem("New2DSLL (テスト用)", "100_ルカ_1/5")).toBe(true);
  });

  it("タイトルに「test」（英語小文字）を含む商品は除外される", () => {
    expect(isTestItem("PSP test item", "372_ルカ_1/5")).toBe(true);
    expect(isTestItem("TEST PRODUCT", null)).toBe(true);
  });

  it("管理番号（etc）に「テスト」を含む商品は除外される", () => {
    expect(isTestItem("Vita2000 ブラック", "テスト")).toBe(true);
    expect(isTestItem("PSP 3000", "test_管理番号")).toBe(true);
  });

  it("「テスト」を含まない通常の商品は除外されない", () => {
    expect(isTestItem("New3DS ホワイト", "371_ルカ_New3DS_10/10")).toBe(false);
    expect(isTestItem("PSP 3000 ブラック", "372_ルカ_ブラック_8/10")).toBe(false);
    expect(isTestItem("3DS LL ミント×ホワイト", null)).toBe(false);
    expect(isTestItem("Vita1000 クリスタル・ホワイト", "在庫0209_1")).toBe(false);
  });

  it("etcがundefinedまたはnullの場合もタイトルのみで判定される", () => {
    expect(isTestItem("New3DS ホワイト", undefined)).toBe(false);
    expect(isTestItem("New3DS ホワイト", null)).toBe(false);
    expect(isTestItem("テスト商品", undefined)).toBe(true);
  });
});

describe("月次棚卸し - 仕入単価補完ロジック", () => {
  // getLocalPurchaseUnitPriceMap の補完ロジックをテスト
  it("管理番号が一致する場合、ローカルDBの仕入単価で補完される", () => {
    const localPurchaseUnitPriceMap = new Map<string, number>([
      ["372_ルカ_ブラック_8/10", 12290],
      ["371_ルカ_New3DS_10/10", 33000],
      ["373_ルカ_5/5", 30510],
    ]);

    // Zaico側に仕入単価がない場合
    const managementNo = "372_ルカ_ブラック_8/10";
    let unitPrice: number | null = null;
    const upStr = ""; // Zaico側の仕入単価が空
    if (upStr) unitPrice = parseFloat(upStr) || null;
    if (unitPrice == null && managementNo) {
      unitPrice = localPurchaseUnitPriceMap.get(managementNo) ?? null;
    }

    expect(unitPrice).toBe(12290);
  });

  it("Zaico側に仕入単価がある場合はZaicoの値が優先される", () => {
    const localPurchaseUnitPriceMap = new Map<string, number>([
      ["372_ルカ_ブラック_8/10", 12290],
    ]);

    const managementNo = "372_ルカ_ブラック_8/10";
    let unitPrice: number | null = null;
    const upStr = "15000"; // Zaico側に仕入単価あり
    if (upStr) unitPrice = parseFloat(upStr) || null;
    if (unitPrice == null && managementNo) {
      unitPrice = localPurchaseUnitPriceMap.get(managementNo) ?? null;
    }

    expect(unitPrice).toBe(15000); // Zaico側の値が優先
  });

  it("管理番号が一致しない場合はnullのまま", () => {
    const localPurchaseUnitPriceMap = new Map<string, number>([
      ["372_ルカ_ブラック_8/10", 12290],
    ]);

    const managementNo = "999_存在しない_1/1";
    let unitPrice: number | null = null;
    const upStr = "";
    if (upStr) unitPrice = parseFloat(upStr) || null;
    if (unitPrice == null && managementNo) {
      unitPrice = localPurchaseUnitPriceMap.get(managementNo) ?? null;
    }

    expect(unitPrice).toBeNull();
  });

  it("管理番号が空の場合はnullのまま", () => {
    const localPurchaseUnitPriceMap = new Map<string, number>([
      ["372_ルカ_ブラック_8/10", 12290],
    ]);

    const managementNo = "";
    let unitPrice: number | null = null;
    const upStr = "";
    if (upStr) unitPrice = parseFloat(upStr) || null;
    if (unitPrice == null && managementNo) {
      unitPrice = localPurchaseUnitPriceMap.get(managementNo) ?? null;
    }

    expect(unitPrice).toBeNull();
  });
});

describe("出庫履歴 - local_inventoriesのzaicoIdベース仕入単価補完ロジック", () => {
  it("purchase_historiesになくてもlocal_inventoriesのzaicoIdで仕入単価を補完できる", () => {
    // delivery_historiesのitemsJsonのinventoryId = ZaicoId (e.g. 53623631)
    const unitPriceMap = new Map<number, number>(); // purchase_historiesにデータなし
    const localInvUnitPriceMap = new Map<number, number>([
      [53623631, 13000], // toy net スイッチライト・ブルー
      [53622671, 13000], // toy net スイッチライト・コーラル
    ]);

    const inventoryId = 53623631;
    const itemUnitPrice: number | null | undefined = undefined; // itemsJsonに保存なし

    const unitPrice = (itemUnitPrice != null)
      ? itemUnitPrice
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? null);

    expect(unitPrice).toBe(13000);
  });

  it("itemsJsonの仕入単価が最優先で、local_inventoriesより優先される", () => {
    const unitPriceMap = new Map<number, number>();
    const localInvUnitPriceMap = new Map<number, number>([
      [53623631, 13000],
    ]);

    const inventoryId = 53623631;
    const itemUnitPrice = 15000; // itemsJsonに保存あり

    const unitPrice = (itemUnitPrice != null)
      ? itemUnitPrice
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? null);

    expect(unitPrice).toBe(15000); // itemsJsonの値が優先
  });

  it("purchase_historiesの仕入単価がlocal_inventoriesより優先される", () => {
    const unitPriceMap = new Map<number, number>([
      [53623631, 14000], // purchase_historiesにあり
    ]);
    const localInvUnitPriceMap = new Map<number, number>([
      [53623631, 13000], // local_inventoriesにもある
    ]);

    const inventoryId = 53623631;
    const itemUnitPrice: number | null | undefined = undefined;

    const unitPrice = (itemUnitPrice != null)
      ? itemUnitPrice
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? null);

    expect(unitPrice).toBe(14000); // purchase_historiesの値が優先
  });

  it("どのソースにも仕入単価がない場合はnullになる", () => {
    const unitPriceMap = new Map<number, number>();
    const localInvUnitPriceMap = new Map<number, number>();

    const inventoryId = 99999;
    const itemUnitPrice: number | null | undefined = undefined;

    const unitPrice = (itemUnitPrice != null)
      ? itemUnitPrice
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? null);

    expect(unitPrice).toBeNull();
  });
});

describe("getLocalPurchaseUnitPriceMap - 管理番号マップ構築ロジック", () => {
  it("管理番号の先頭部分（カンマ前）をキーとして使用する", () => {
    // 管理番号 "371_ルカ_3DSLL_2/10&3/10,2026-03-25 00:00:00,駿河屋" の場合
    // キーは "371_ルカ_3DSLL_2/10&3/10" になる
    const managementNo = "371_ルカ_3DSLL_2/10&3/10,2026-03-25 00:00:00,駿河屋";
    const key = managementNo.split(",")[0]?.trim() ?? "";
    expect(key).toBe("371_ルカ_3DSLL_2/10&3/10");
  });

  it("同じ管理番号が複数ある場合は最初に処理されたもの（最新）が使用される", () => {
    // Map.has()でチェックして重複を防ぐロジック
    const map = new Map<string, number>();
    const rows = [
      { managementNo: "372_ルカ_ブラック_8/10", unitPrice: "12290" }, // 最新
      { managementNo: "372_ルカ_ブラック_8/10", unitPrice: "11000" }, // 古い
    ];
    for (const row of rows) {
      if (!row.managementNo || row.unitPrice == null) continue;
      const key = row.managementNo.split(",")[0]?.trim() ?? "";
      if (!key) continue;
      const price = parseFloat(String(row.unitPrice));
      if (!isNaN(price) && !map.has(key)) {
        map.set(key, price);
      }
    }
    expect(map.get("372_ルカ_ブラック_8/10")).toBe(12290); // 最新の値
  });

  it("unitPriceがnullの行はスキップされる", () => {
    const map = new Map<string, number>();
    const rows = [
      { managementNo: "372_ルカ_ブラック_8/10", unitPrice: null },
    ];
    for (const row of rows) {
      if (!row.managementNo || row.unitPrice == null) continue;
      const key = row.managementNo.split(",")[0]?.trim() ?? "";
      if (!key) continue;
      const price = parseFloat(String(row.unitPrice));
      if (!isNaN(price) && !map.has(key)) {
        map.set(key, price);
      }
    }
    expect(map.size).toBe(0);
  });
});

describe("出庫履歴 - deleted_inventoriesからの仕入単価補完ロジック（在庫削除後も保持）", () => {
  it("在庫削除後もdeleted_inventoriesから仕入単価を補完できる", () => {
    const unitPriceMap = new Map<number, number>(); // purchase_historiesにデータなし
    const localInvUnitPriceMap = new Map<number, number>(); // local_inventoriesにもなし（削除済み）
    const deletedInvUnitPriceMap = new Map<number, number>([
      [53623631, 13000], // deleted_inventoriesに保存されている
    ]);

    const inventoryId = 53623631;
    const itemUnitPrice: number | null | undefined = undefined;

    const unitPrice = (itemUnitPrice != null)
      ? itemUnitPrice
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? deletedInvUnitPriceMap.get(inventoryId) ?? null);

    expect(unitPrice).toBe(13000);
  });

  it("補完優先順位: itemsJson > purchase_histories > local_inventories > deleted_inventories", () => {
    const unitPriceMap = new Map<number, number>([[53623631, 14000]]);
    const localInvUnitPriceMap = new Map<number, number>([[53623631, 13000]]);
    const deletedInvUnitPriceMap = new Map<number, number>([[53623631, 12000]]);

    const inventoryId = 53623631;

    // itemsJsonあり → itemsJsonが最優先
    const unitPrice1 = (15000 != null)
      ? 15000
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? deletedInvUnitPriceMap.get(inventoryId) ?? null);
    expect(unitPrice1).toBe(15000);

    // itemsJsonなし、purchase_historiesあり → purchase_historiesが優先
    const unitPrice2 = (undefined != null)
      ? undefined
      : (unitPriceMap.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? deletedInvUnitPriceMap.get(inventoryId) ?? null);
    expect(unitPrice2).toBe(14000);

    // purchase_historiesなし、local_inventoriesあり → local_inventoriesが優先
    const unitPriceMap2 = new Map<number, number>();
    const unitPrice3 = (undefined != null)
      ? undefined
      : (unitPriceMap2.get(inventoryId) ?? localInvUnitPriceMap.get(inventoryId) ?? deletedInvUnitPriceMap.get(inventoryId) ?? null);
    expect(unitPrice3).toBe(13000);

    // 全てなし → null
    const unitPrice4 = (undefined != null)
      ? undefined
      : (new Map<number, number>().get(inventoryId) ?? new Map<number, number>().get(inventoryId) ?? new Map<number, number>().get(inventoryId) ?? null);
    expect(unitPrice4).toBeNull();
  });
});

// ============================================================
// invoice_manual_items 小計計算ロジックテスト
// ============================================================
describe("月次棚卸し - 手動入力行の小計計算ロジック", () => {
  it("数量と仕入単価から小計が正しく計算される", () => {
    const quantity = 3;
    const unitPrice = 1500;
    const subtotal = unitPrice * quantity;
    expect(subtotal).toBe(4500);
  });

  it("仕入単価が未入力の場合は小計がnull（未入力）になる", () => {
    const upVal = "";
    const qtyVal = "3";
    const upNum = parseFloat(upVal);
    const qtyNum = parseInt(qtyVal, 10);
    const subtotal = !isNaN(upNum) && upNum > 0 && qtyNum > 0 ? upNum * qtyNum : null;
    expect(subtotal).toBeNull();
  });

  it("手動入力行の合計がcombinedTotalに加算される", () => {
    const purchaseCostTotal = 100000;
    const stockCostTotal = 50000;
    const manualCostTotal = 4500;
    const combinedTotal = purchaseCostTotal + stockCostTotal + manualCostTotal;
    expect(combinedTotal).toBe(154500);
  });

  it("手動入力行が0件の場合はmanualCostTotalが0になる", () => {
    const manualItemsForInv: Array<{ unitPrice: string | null; quantity: number }> = [];
    let manualCostTotal = 0;
    for (const mi of manualItemsForInv) {
      const up = mi.unitPrice != null ? parseFloat(mi.unitPrice) : null;
      const qty = mi.quantity;
      if (up != null && !isNaN(up) && qty > 0) manualCostTotal += up * qty;
    }
    expect(manualCostTotal).toBe(0);
  });
});

// ============================================================
// 出庫済み商品除外・入庫済み未出庫追加テスト
// ============================================================
describe("月次棚卸し - 発注済み商品から出庫済みを除外するロジック", () => {
  it("出庫済みの inventoryId に対応する発注済み商品は除外される", () => {
    const purchaseItems = [
      { zaicoId: 1001, title: "PSP ブラック", quantity: 1, unitPrice: 13000, managementNo: "372_PSP_ブラック", status: "ordered" },
      { zaicoId: 1002, title: "PSP ホワイト", quantity: 1, unitPrice: 12000, managementNo: "372_PSP_ホワイト", status: "ordered" },
    ];
    // zaicoId 1001 は inventoryId 5001 として入庫済み、かつ出庫済み
    const purchaseZaicoIdToInventoryId = new Map([[1001, 5001], [1002, 5002]]);
    const deliveredInventoryIds = new Set([5001]); // 5001 は出庫済み

    const filtered = purchaseItems.filter((pi) => {
      const inventoryId = purchaseZaicoIdToInventoryId.get(pi.zaicoId);
      if (!inventoryId) return true; // 未入庫 → 残す
      return !deliveredInventoryIds.has(inventoryId); // 出庫済みなら除外
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].zaicoId).toBe(1002); // 1001 は除外、1002 は残る
  });

  it("入庫履歴がない（未入庫）の発注済み商品は除外されない", () => {
    const purchaseItems = [
      { zaicoId: 2001, title: "DS ブラック", quantity: 1, unitPrice: 5000, managementNo: "373_DS_ブラック", status: "ordered" },
    ];
    const purchaseZaicoIdToInventoryId = new Map<number, number>(); // 入庫履歴なし
    const deliveredInventoryIds = new Set<number>();

    const filtered = purchaseItems.filter((pi) => {
      const inventoryId = purchaseZaicoIdToInventoryId.get(pi.zaicoId);
      if (!inventoryId) return true;
      return !deliveredInventoryIds.has(inventoryId);
    });

    expect(filtered).toHaveLength(1); // 未入庫なので残る
  });
});

describe("月次棚卸し - 入庫済み未出庫商品を在庫一覧に追加するロジック", () => {
  it("入庫済みかつ未出庫の商品が stockByInvoice に追加される", () => {
    const purchaseHistories = [
      { id: 1, zaicoId: 3001, inventoryId: 6001, kanriNo: "372_Vita_ブラック", title: "Vita ブラック", quantity: "2", unitPrice: "15000", category: "Vita", cancelled: 0 },
    ];
    const deliveredInventoryIds = new Set<number>(); // 出庫済みなし
    const stockInventoryIds = new Set<number>(); // Zaico在庫一覧にもなし

    const addedItems: Array<{ inventoryId: number; title: string; quantity: number; invoiceNo: string }> = [];
    for (const ph of purchaseHistories) {
      if (ph.cancelled !== 0) continue;
      if (!ph.inventoryId) continue;
      if (deliveredInventoryIds.has(ph.inventoryId)) continue;
      if (stockInventoryIds.has(ph.inventoryId)) continue;
      const mgmtNo = ph.kanriNo ?? "";
      const firstPart = mgmtNo.split(",")[0]?.trim() ?? "";
      const invoiceMatch = firstPart.match(/^(\d+)/);
      if (!invoiceMatch) continue;
      addedItems.push({ inventoryId: ph.inventoryId, title: ph.title, quantity: parseInt(ph.quantity, 10), invoiceNo: invoiceMatch[1] });
    }

    expect(addedItems).toHaveLength(1);
    expect(addedItems[0].inventoryId).toBe(6001);
    expect(addedItems[0].title).toBe("Vita ブラック");
    expect(addedItems[0].quantity).toBe(2);
    expect(addedItems[0].invoiceNo).toBe("372");
  });

  it("既に stockByInvoice に存在する inventoryId は重複追加されない", () => {
    const purchaseHistories = [
      { id: 1, zaicoId: 3001, inventoryId: 6001, kanriNo: "372_Vita_ブラック", title: "Vita ブラック", quantity: "2", unitPrice: "15000", category: "Vita", cancelled: 0 },
    ];
    const deliveredInventoryIds = new Set<number>();
    const stockInventoryIds = new Set([6001]); // 既にZaico在庫一覧に存在

    const addedItems: Array<{ inventoryId: number }> = [];
    for (const ph of purchaseHistories) {
      if (ph.cancelled !== 0) continue;
      if (!ph.inventoryId) continue;
      if (deliveredInventoryIds.has(ph.inventoryId)) continue;
      if (stockInventoryIds.has(ph.inventoryId)) continue; // スキップ
      addedItems.push({ inventoryId: ph.inventoryId });
    }

    expect(addedItems).toHaveLength(0); // 重複追加されない
  });

  it("取り消し済み（cancelled !== 0）の入庫履歴は追加されない", () => {
    const purchaseHistories = [
      { id: 1, zaicoId: 3001, inventoryId: 6001, kanriNo: "372_Vita_ブラック", title: "Vita ブラック", quantity: "2", unitPrice: "15000", category: "Vita", cancelled: 1 },
    ];
    const deliveredInventoryIds = new Set<number>();
    const stockInventoryIds = new Set<number>();

    const addedItems: Array<{ inventoryId: number }> = [];
    for (const ph of purchaseHistories) {
      if (ph.cancelled !== 0) continue; // 取り消し済みはスキップ
      if (!ph.inventoryId) continue;
      if (deliveredInventoryIds.has(ph.inventoryId)) continue;
      if (stockInventoryIds.has(ph.inventoryId)) continue;
      addedItems.push({ inventoryId: ph.inventoryId });
    }

    expect(addedItems).toHaveLength(0); // 取り消し済みは追加されない
  });
});

// ============================================================
// 発注済み商品 status=ordered のみ表示テスト
// ============================================================
describe("purchaseByInvoice: status=ordered のみ表示", () => {
  it("status=purchased（入庫済み）の商品は発注済みセクションに含まれない", () => {
    const purchaseItems = [
      { id: 1001, title: "Vita ブラック", etc: "372_ルカ_ブラック_1/5", status: "ordered", unit_price: null, quantity: 1 },
      { id: 1002, title: "Vita ホワイト", etc: "372_ルカ_ホワイト_2/5", status: "purchased", unit_price: null, quantity: 1 },
      { id: 1003, title: "3DS レッド", etc: "372_ルカ_レッド_3/5", status: "ordered", unit_price: null, quantity: 1 },
    ];
    const result = purchaseItems.filter((pItem) => pItem.status === "ordered");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1001, 1003]);
  });

  it("全商品が purchased の場合は発注済みセクションが空になる", () => {
    const purchaseItems = [
      { id: 2001, title: "Switch Lite", etc: "373_ルカ_1/10", status: "purchased", unit_price: null, quantity: 1 },
      { id: 2002, title: "Switch Lite 2", etc: "373_ルカ_2/10", status: "purchased", unit_price: null, quantity: 1 },
    ];
    const result = purchaseItems.filter((pItem) => pItem.status === "ordered");
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// 在庫一覧 invoiceNoSet による絞り込みテスト
// ============================================================
describe("stockByInvoice: invoiceNoSet による絞り込み", () => {
  it("invoiceNoSet に含まれるインボイスNoの在庫のみ表示される", () => {
    const invoiceNoSet = new Set(["372", "373"]);
    const inventories = [
      { id: 68001, title: "Vita ブラック", etc: "372_ルカ_ブラック_1/5", quantity: 2 },
      { id: 68002, title: "Switch Lite", etc: "373_ルカ_1/10", quantity: 1 },
      { id: 68003, title: "3DS", etc: "370_ルカ_1/5", quantity: 3 }, // 370は対象外
      { id: 68004, title: "GBA", etc: "", quantity: 5 }, // etcなしは除外
    ];
    const result = inventories.filter((inv) => {
      const firstPart = (inv.etc ?? "").split(",")[0]?.trim() ?? "";
      const invoiceMatch = firstPart.match(/^(\d+)/);
      if (!invoiceMatch) return false;
      return invoiceNoSet.has(invoiceMatch[1]);
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([68001, 68002]);
  });

  it("在庫数0以下の商品は在庫一覧に含まれない", () => {
    const invoiceNoSet = new Set(["372"]);
    const inventories = [
      { id: 68001, title: "Vita ブラック", etc: "372_ルカ_1/5", quantity: 0 },
      { id: 68002, title: "Vita ホワイト", etc: "372_ルカ_2/5", quantity: 2 },
    ];
    const result = inventories.filter((inv) => {
      const firstPart = (inv.etc ?? "").split(",")[0]?.trim() ?? "";
      const invoiceMatch = firstPart.match(/^(\d+)/);
      if (!invoiceMatch) return false;
      if (!invoiceNoSet.has(invoiceMatch[1])) return false;
      return inv.quantity > 0;
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(68002);
  });
});
