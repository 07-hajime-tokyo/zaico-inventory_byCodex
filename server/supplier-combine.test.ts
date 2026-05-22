/**
 * combineSupplierInfo ユニットテスト
 * クライアント側の lib/supplier.ts と同じロジックをサーバーテストで検証する
 */
import { describe, it, expect } from "vitest";

// ---- テスト対象ロジックをインライン定義（クライアントコードを直接importできないため） ----
function combineSupplierInfo(
  supplierSite: string,
  csvSupplierName: string | null | undefined,
  customerName?: string | null
): string {
  const site = supplierSite.trim();
  const seller = (csvSupplierName ?? "").trim();
  const fallback = (customerName ?? "").trim();

  if (site && seller) {
    // 駿河屋の場合は出品者名（店舗名）をそのまま使う
    if (site.includes("駿河屋")) return site;
    return `${site} ${seller}`;
  }
  if (site) return site;
  if (seller) return seller;
  return fallback;
}
// ---- ここまで ----

describe("combineSupplierInfo", () => {
  it("supplierSiteとcsvSupplierNameの両方がある場合は結合する", () => {
    expect(combineSupplierInfo("ペイペイフリマ", "星川みつき")).toBe("ペイペイフリマ 星川みつき");
    expect(combineSupplierInfo("メルカリ", "田中太郎")).toBe("メルカリ 田中太郎");
  });

  it("駿河屋の場合はsupplierSiteをそのまま返す", () => {
    expect(combineSupplierInfo("駿河屋立川北口店", "出品者A")).toBe("駿河屋立川北口店");
    expect(combineSupplierInfo("駿河屋 秋葉原店", "出品者B")).toBe("駿河屋 秋葉原店");
  });

  it("supplierSiteのみがある場合はそれを返す", () => {
    expect(combineSupplierInfo("ペイペイフリマ", null)).toBe("ペイペイフリマ");
    expect(combineSupplierInfo("ヤフオク", undefined)).toBe("ヤフオク");
  });

  it("csvSupplierNameのみがある場合はそれを返す", () => {
    expect(combineSupplierInfo("", "星川みつき")).toBe("星川みつき");
    expect(combineSupplierInfo("", "田中太郎", "フォールバック")).toBe("田中太郎");
  });

  it("どちらもない場合はcustomerNameを返す", () => {
    expect(combineSupplierInfo("", null, "取引先A")).toBe("取引先A");
    expect(combineSupplierInfo("", undefined, "取引先B")).toBe("取引先B");
  });

  it("すべて空の場合は空文字を返す", () => {
    expect(combineSupplierInfo("", null, null)).toBe("");
    expect(combineSupplierInfo("", undefined, undefined)).toBe("");
  });
});
