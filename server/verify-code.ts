/**
 * /api/verify-code
 *
 * 外部から招待コードを検証するための REST API エンドポイント。
 *
 * リクエスト:
 *   POST /api/verify-code
 *   Content-Type: application/json
 *   Body: { "code": "<検証したいコード>" }
 *
 * レスポンス:
 *   200 OK  { "valid": true }   — コードが正しい（または招待コード未設定）
 *   200 OK  { "valid": false }  — コードが間違っている
 *   400 Bad Request             — リクエストボディが不正
 *
 * CORS:
 *   ALLOWED_ORIGINS に含まれるオリジンからのリクエストを許可する。
 */

import type { Express, Request, Response } from "express";
import { getSystemSetting } from "./db";

/** CORS を許可するオリジン一覧 */
function getAllowedOrigins(): string[] {
  return (process.env.VERIFY_CODE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin ?? "";
  if (getAllowedOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function registerVerifyCodeRoutes(app: Express): void {
  // プリフライトリクエスト (OPTIONS) への応答
  app.options("/api/verify-code", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.sendStatus(204);
  });

  app.post("/api/verify-code", async (req: Request, res: Response) => {
    setCorsHeaders(req, res);

    const { code } = req.body as { code?: unknown };

    if (typeof code !== "string") {
      res.status(400).json({ error: 'Request body must contain a "code" string field.' });
      return;
    }

    try {
      const storedCode = await getSystemSetting("access_code");

      // 招待コードが未設定の場合は常に有効とみなす
      if (!storedCode) {
        res.json({ valid: true });
        return;
      }

      res.json({ valid: code === storedCode });
    } catch (err) {
      console.error("[verify-code] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
