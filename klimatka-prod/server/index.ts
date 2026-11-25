import express from "express";
import { requireAuthenticated, requireCompany } from "./auth-middleware.js";
import { authRouter } from "./routes/auth.js";

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "ping" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/platform-admin", requireAuthenticated, async (req, res, next) => {
    const { platformAdminRouter } = await import("./routes/platform-admin.js");
    platformAdminRouter(req, res, next);
  });
  app.use("/api/environment", requireAuthenticated, requireCompany, async (req, res, next) => {
    const { environmentRouter } = await import("./routes/environment.js");
    environmentRouter(req, res, next);
  });

  return app;
}
