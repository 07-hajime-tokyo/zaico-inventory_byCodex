import { ADMIN_EMAILS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  name: string;
  email?: string | null;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret || "development-only-change-me";
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; email?: string | null } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        name: options.name || "",
        email: options.email ?? null,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      name: payload.name,
      email: payload.email ?? null,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, name, email } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) {
        return null;
      }

      return {
        openId,
        name: isNonEmptyString(name) ? name : "",
        email: typeof email === "string" ? email : null,
      };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    const user = await db.getUserByOpenId(session.openId);

    if (!user) {
      if (!session.email) {
        throw ForbiddenError("User not found");
      }

      const email = session.email.toLowerCase();
      const fallbackUser: User = {
        id: 0,
        openId: session.openId,
        name: session.name || email.split("@")[0] || "local user",
        email,
        loginMethod: "email",
        role: ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email) ? "admin" : "user",
        createdAt: signedInAt,
        updatedAt: signedInAt,
        lastSignedIn: signedInAt,
      };

      await db.upsertUser({
        openId: fallbackUser.openId,
        name: fallbackUser.name,
        email: fallbackUser.email,
        loginMethod: fallbackUser.loginMethod,
        role: fallbackUser.role,
        lastSignedIn: signedInAt,
      });

      return fallbackUser;
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
