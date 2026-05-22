/**
 * formatSupplier ユニットテスト
 * クライアント側の lib/supplier.ts と同じロジックをサーバーテストで検証する
 */
import { describe, it, expect } from "vitest";

// ---- テスト対象ロジックをインライン定義（クライアントコードを直接importできないため） ----
type SiteRule = { keywords: string[]; label: string };

const SITE_RULES: SiteRule[] = [
  { keywords: ["駿河屋"], label: "" },
  { keywords: ["ヤフオク", "Yahoo!オークション", "yahoo!オークション", "ヤフーオークション"], label: "ヤフオク" },
  { keywords: ["ペイペイフリマ", "PayPayフリマ", "paypayフリマ", "ペイペイ フリマ"], label: "ペイペイフリマ" },
  { keywords: ["メルカリ", "Mercari", "mercari"], label: "メルカリ" },
  { keywords: ["Amazon", "amazon", "アマゾン"], label: "Amazon" },
  { keywords: ["ラクマ", "Rakuma", "rakuma"], label: "ラクマ" },
  { keywords: ["ジモティー", "Jmty", "jmty"], label: "ジモティー" },
  { keywords: ["フリル", "Fril", "fril"], label: "フリル" },
  { keywords: ["eBay", "ebay", "イーベイ"], label: "eBay" },
];

function formatSupplier(supplier: string): string {
  if (!supplier) return supplier;
  for (const rule of SITE_RULES) {
    const matched = rule.keywords.some((kw) => supplier.includes(kw));
    if (!matched) continue;
    if (rule.label === "") return supplier;
    if (supplier.startsWith(rule.label)) return supplier;
    let sellerName = supplier;
    for (const kw of rule.keywords) {
      sellerName = sellerName.replace(kw, "").trim();
    }
    sellerName = sellerName.replace(/^[\s　の：:・_\-]+/, "").trim();
    if (sellerName) return `${rule.label} ${sellerName}`;
    else return rule.label;
  }
  return supplier;
}
// ---- ここまで ----

describe("formatSupplier", () => {
  it("駿河屋はそのまま返す", () => {
    expect(formatSupplier("駿河屋立川北口店")).toBe("駿河屋立川北口店");
    expect(formatSupplier("駿河屋 秋葉原店")).toBe("駿河屋 秋葉原店");
  });

  it("ペイペイフリマの出品者名にサイト名を付与する", () => {
    expect(formatSupplier("ペイペイフリマ 田中太郎")).toBe("ペイペイフリマ 田中太郎");
    expect(formatSupplier("田中太郎（ペイペイフリマ）")).toBe("ペイペイフリマ 田中太郎（）");
  });

  it("メルカリの出品者名にサイト名を付与する", () => {
    expect(formatSupplier("メルカリ 山田")).toBe("メルカリ 山田");
    expect(formatSupplier("山田（メルカリ）")).toBe("メルカリ 山田（）");
  });

  it("ヤフオクの出品者名にサイト名を付与する", () => {
    expect(formatSupplier("ヤフオク 鈴木")).toBe("ヤフオク 鈴木");
    expect(formatSupplier("鈴木（ヤフオク）")).toBe("ヤフオク 鈴木（）");
  });

  it("既にサイト名で始まっている場合はそのまま返す", () => {
    expect(formatSupplier("メルカリ 佐藤")).toBe("メルカリ 佐藤");
    expect(formatSupplier("Amazon 出品者A")).toBe("Amazon 出品者A");
  });

  it("不明なサイトはそのまま返す", () => {
    expect(formatSupplier("不明な出品者")).toBe("不明な出品者");
    expect(formatSupplier("個人取引")).toBe("個人取引");
  });

  it("空文字はそのまま返す", () => {
    expect(formatSupplier("")).toBe("");
  });
});
