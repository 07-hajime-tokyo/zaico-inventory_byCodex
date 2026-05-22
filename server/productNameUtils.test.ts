import { describe, it, expect } from "vitest";
import { toEnglishProductName, normalizeProductName, isReturnProduct } from "../client/src/lib/productNameUtils";

describe("productNameUtils", () => {
  describe("isReturnProduct", () => {
    it("returns true for product names containing 返品", () => {
      expect(isReturnProduct("vita1000黒 返品")).toBe(true);
      expect(isReturnProduct("PS Vita 1000 ブラック 返品")).toBe(true);
    });
    it("returns false for normal product names", () => {
      expect(isReturnProduct("vita1000黒")).toBe(false);
      expect(isReturnProduct("PS Vita 1000 ブラック")).toBe(false);
    });
  });

  describe("normalizeProductName", () => {
    it("removes 返品 from product names", () => {
      expect(normalizeProductName("vita1000黒 返品")).toBe("vita1000黒");
      expect(normalizeProductName("PS Vita 1000 ブラック 返品")).toBe("PS Vita 1000 ブラック");
    });
    it("leaves normal product names unchanged", () => {
      expect(normalizeProductName("vita1000黒")).toBe("vita1000黒");
    });
  });

  describe("toEnglishProductName", () => {
    it("converts PS Vita 1000 names", () => {
      expect(toEnglishProductName("vita1000黒")).toBe("PS Vita 1000 Black");
      expect(toEnglishProductName("PS Vita 1000 ブラック")).toBe("PS Vita 1000 Black");
    });
    it("converts PS Vita 2000 names", () => {
      expect(toEnglishProductName("vita2000ホワイト")).toBe("PS Vita 2000 White");
    });
    it("converts Nintendo Switch Lite names", () => {
      expect(toEnglishProductName("Switch lite グレー")).toBe("Switch Lite Gray");
    });
    it("converts Nintendo Switch names", () => {
      expect(toEnglishProductName("Nintendo Switch ブルー")).toBe("Switch Blue");
    });
    it("converts 3DS LL names", () => {
      expect(toEnglishProductName("3DS LL ホワイト")).toBe("3DS LL White");
    });
    it("returns empty string for empty input", () => {
      expect(toEnglishProductName("")).toBe("");
    });
  });
});
