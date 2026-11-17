import express from "express";
import { requireAuthenticated, requireCompany } from "./auth-middleware";
import { authRouter } from "./routes/auth";

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "ping" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/platform-admin", requireAuthenticated, async (req, res, next) => {
    const { platformAdminRouter } = await import("./routes/platform-admin");
    platformAdminRouter(req, res, next);
  });
  app.use("/api/environment", requireAuthenticated, requireCompany, async (req, res, next) => {
    const { environmentRouter } = await import("./routes/environment");
    environmentRouter(req, res, next);
  });

  return app;
}
