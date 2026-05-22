import { describe, it, expect } from "vitest";

/**
 * Zaico オペレーター別APIトークンの動作確認テスト
 * 各オペレーターのトークンでZaico APIにアクセスできるか確認する
 */

const ZAICO_BASE = "https://web.zaico.co.jp/api/v1";
const requiredOperatorEnv = [
  "ZAICO_API_TOKEN",
  "ZAICO_OPERATOR_A_TOKEN",
  "ZAICO_OPERATOR_B_TOKEN",
  "ZAICO_OPERATOR_A_NAME",
  "ZAICO_OPERATOR_B_NAME",
  "ZAICO_OPERATOR_DEFAULT_NAME",
  "ZAICO_OPERATOR_DEFAULT_EMAIL",
  "ZAICO_OPERATOR_A_EMAIL",
  "ZAICO_OPERATOR_B_EMAIL",
] as const;
const shouldRunOperatorIntegration =
  process.env.RUN_ZAICO_OPERATOR_TESTS === "true" &&
  requiredOperatorEnv.every((key) => Boolean(process.env[key]));

async function testZaicoToken(token: string, label: string) {
  const res = await fetch(`${ZAICO_BASE}/inventories?page=1&per_page=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return { label, status: res.status, ok: res.ok };
}

describe.skipIf(!shouldRunOperatorIntegration)("Zaico Operator Tokens", () => {
  it("ZAICO_API_TOKEN (default/C) should be valid", async () => {
    const token = process.env.ZAICO_API_TOKEN;
    expect(token, "ZAICO_API_TOKEN is not set").toBeTruthy();
    const result = await testZaicoToken(token!, "C (default)");
    expect(result.ok, `Token C returned status ${result.status}`).toBe(true);
  }, 15000);

  it("ZAICO_OPERATOR_A_TOKEN should be valid", async () => {
    const token = process.env.ZAICO_OPERATOR_A_TOKEN;
    expect(token, "ZAICO_OPERATOR_A_TOKEN is not set").toBeTruthy();
    const result = await testZaicoToken(token!, "Operator A");
    expect(result.ok, `Token A returned status ${result.status}`).toBe(true);
  }, 15000);

  it("ZAICO_OPERATOR_B_TOKEN should be valid", async () => {
    const token = process.env.ZAICO_OPERATOR_B_TOKEN;
    expect(token, "ZAICO_OPERATOR_B_TOKEN is not set").toBeTruthy();
    const result = await testZaicoToken(token!, "Operator B");
    expect(result.ok, `Token B returned status ${result.status}`).toBe(true);
  }, 15000);

  it("ZAICO_OPERATOR_A_NAME and ZAICO_OPERATOR_B_NAME should be set", () => {
    expect(process.env.ZAICO_OPERATOR_A_NAME, "ZAICO_OPERATOR_A_NAME is not set").toBeTruthy();
    expect(process.env.ZAICO_OPERATOR_B_NAME, "ZAICO_OPERATOR_B_NAME is not set").toBeTruthy();
  });

  it("野田さんの表示名が「野田」に設定されていること", () => {
    expect(process.env.ZAICO_OPERATOR_DEFAULT_NAME).toBe("野田");
  });

  it("全オペレーターのメールアドレスが設定されていること", () => {
    expect(process.env.ZAICO_OPERATOR_DEFAULT_EMAIL, "ZAICO_OPERATOR_DEFAULT_EMAIL is not set").toBeTruthy();
    expect(process.env.ZAICO_OPERATOR_A_EMAIL, "ZAICO_OPERATOR_A_EMAIL is not set").toBeTruthy();
    expect(process.env.ZAICO_OPERATOR_B_EMAIL, "ZAICO_OPERATOR_B_EMAIL is not set").toBeTruthy();
    // メールアドレス形式の簡単な検証
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    expect(process.env.ZAICO_OPERATOR_DEFAULT_EMAIL).toMatch(emailRegex);
    expect(process.env.ZAICO_OPERATOR_A_EMAIL).toMatch(emailRegex);
    expect(process.env.ZAICO_OPERATOR_B_EMAIL).toMatch(emailRegex);
  });

  it("メールアドレスに基づく操作者照合ロジックが正しく動作すること", () => {
    const operators = [
      { key: "default", name: process.env.ZAICO_OPERATOR_DEFAULT_NAME ?? "野田", email: process.env.ZAICO_OPERATOR_DEFAULT_EMAIL ?? "" },
      { key: "A", name: process.env.ZAICO_OPERATOR_A_NAME ?? "", email: process.env.ZAICO_OPERATOR_A_EMAIL ?? "" },
      { key: "B", name: process.env.ZAICO_OPERATOR_B_NAME ?? "", email: process.env.ZAICO_OPERATOR_B_EMAIL ?? "" },
    ];
    for (const op of operators) {
      if (!op.email) continue;
      const matched = operators.find(
        (o) => o.email && o.email.toLowerCase() === op.email.toLowerCase()
      );
      expect(matched?.key).toBe(op.key);
    }
  });
});
