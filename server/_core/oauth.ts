import { ADMIN_EMAILS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { createHash } from "node:crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getAllowedEmails(): Set<string> {
  const configured = process.env.AUTH_ALLOWED_EMAILS
    ?.split(",")
    .map(normalizeEmail)
    .filter(Boolean) ?? [];
  const operatorEmails = [
    process.env.ZAICO_OPERATOR_DEFAULT_EMAIL,
    process.env.ZAICO_OPERATOR_A_EMAIL,
    process.env.ZAICO_OPERATOR_B_EMAIL,
  ]
    .filter((email): email is string => Boolean(email))
    .map(normalizeEmail);

  return new Set([
    ...ADMIN_EMAILS.map(normalizeEmail),
    ...operatorEmails,
    ...configured,
  ]);
}

function createLocalOpenId(email: string): string {
  const digest = createHash("sha256").update(email).digest("hex").slice(0, 32);
  return `email:${digest}`;
}

function getSafeRedirect(req: Request): string {
  const raw = typeof req.query.redirect === "string" ? req.query.redirect : "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function renderLoginPage(params: { error?: string; email?: string; redirect: string }) {
  const errorHtml = params.error
    ? `<p class="error">${escapeHtml(params.error)}</p>`
    : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zaico ログイン</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #0f172a; }
    main { width: min(92vw, 420px); background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 28px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 20px; color: #475569; line-height: 1.6; }
    label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; height: 44px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; font-size: 16px; }
    button { width: 100%; height: 44px; margin-top: 16px; border: 0; border-radius: 6px; background: #1f6feb; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
    .error { color: #b42318; background: #fff1f0; border: 1px solid #ffccc7; border-radius: 6px; padding: 10px 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Zaico 入出庫管理</h1>
    <p>許可されたメールアドレスでログインしてください。</p>
    ${errorHtml}
    <form method="post" action="/api/auth/login">
      <input type="hidden" name="redirect" value="${escapeHtml(params.redirect)}" />
      <label for="email">メールアドレス</label>
      <input id="email" name="email" type="email" autocomplete="email" required value="${escapeHtml(params.email ?? "")}" />
      <button type="submit">ログイン</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/login", (req: Request, res: Response) => {
    res.type("html").send(renderLoginPage({ redirect: getSafeRedirect(req) }));
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const redirect = typeof req.body.redirect === "string" && req.body.redirect.startsWith("/")
      ? req.body.redirect
      : "/";
    const email = normalizeEmail(String(req.body.email ?? ""));
    const allowedEmails = getAllowedEmails();

    if (!email || !allowedEmails.has(email)) {
      res
        .status(403)
        .type("html")
        .send(renderLoginPage({
          error: "このメールアドレスは許可されていません。",
          email,
          redirect,
        }));
      return;
    }

    const name = email.split("@")[0] || email;
    const openId = createLocalOpenId(email);
    const role = ADMIN_EMAILS.map(normalizeEmail).includes(email) ? "admin" : "user";

    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "email",
      role,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(openId, {
      name,
      email,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.redirect(redirect);
  });

  app.get("/api/oauth/login", (req: Request, res: Response) => {
    const redirect = getSafeRedirect(req);
    res.redirect(`/api/auth/login?redirect=${encodeURIComponent(redirect)}`);
  });

  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect("/api/auth/login");
  });
}
