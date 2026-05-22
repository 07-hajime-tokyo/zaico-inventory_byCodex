/**
 * GitHub CSV 接続テスト
 * GITHUB_CSV_TOKEN が設定されている場合、プライベートリポジトリから
 * CSV を取得できることを確認する
 */
import { describe, it, expect } from "vitest";

const CSV_URL =
  process.env.GITHUB_CSV_URL ??
  "https://raw.githubusercontent.com/07-hajime-tokyo/csv-data-site/main/data.csv";

describe.skipIf(process.env.RUN_GITHUB_CSV_TESTS !== "true")("GitHub CSV fetch", () => {
  it("GITHUB_CSV_TOKEN を使って CSV を取得できる", async () => {
    const token = process.env.GITHUB_CSV_TOKEN;
    expect(token, "GITHUB_CSV_TOKEN is not set").toBeTruthy();
    const headers: Record<string, string> = {
      Authorization: `token ${token}`,
    };

    const res = await fetch(CSV_URL, { headers });

    expect(res.status).toBe(200);

    const text = await res.text();
    // 最低限データが存在することを確認（空でない）
    expect(text.length).toBeGreaterThan(0);
  }, 15000); // タイムアウト 15 秒
});
