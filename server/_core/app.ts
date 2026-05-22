import express from "express";
import { type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerWebhookRoutes } from "../webhook";
import { registerVerifyCodeRoutes } from "../verify-code";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerWebhookRoutes(app);
  registerVerifyCodeRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}

export async function createLocalApp(server: Server) {
  const app = createApiApp();

  const isBuiltServer = import.meta.url.includes("/dist/") || import.meta.url.includes("\\dist\\");
  if (process.env.NODE_ENV === "development" || (!process.env.NODE_ENV && !isBuiltServer)) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return app;
}
