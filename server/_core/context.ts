import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ADMIN_EMAILS } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function isLocalPreviewMode() {
  return !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";
}

function createLocalPreviewUser(): User {
  const now = new Date();
  const email = ADMIN_EMAILS[0] ?? "local@example.com";
  return {
    id: 0,
    openId: "local-preview",
    name: "Local Preview",
    email,
    loginMethod: "local-preview",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && isLocalPreviewMode()) {
    user = createLocalPreviewUser();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
