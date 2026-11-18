import express from "express";

export async function createTestServer() {
  process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE = "1";
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get("/api/ping", (_req, res) => res.json({ message: process.env.PING_MESSAGE ?? "ping" }));

  const [{ authRouter }, { environmentRouter }, { platformAdminRouter }] = await Promise.all([
    import("./legacy-auth"),
    import("../routes/environment"),
    import("../routes/platform-admin"),
  ]);
  const { requireAuthenticated, requireCompany } = await import("./legacy-auth-middleware");

  app.use("/api/auth", authRouter);
  app.use("/api/platform-admin", requireAuthenticated, platformAdminRouter);
  app.use("/api/environment", requireAuthenticated, requireCompany, environmentRouter);
  return app;
}
