import { Router, type Request } from "express";
import { z } from "zod";
import { activityCategories, type EnvironmentalInput } from "../../shared/environment.js";
import { sha256 } from "../supabase.js";
import { createCalculation, deleteCalculation, prepareCalculation, prepareCalculationUpdate, syncEnvironmentModules, syncTenantEnvironmentData, updateCalculation, withEnvironmentCache, getAllRuns, getCalculationHistory, getDatabaseHealth, getFacilityHeadcount, getFacilityHeadcounts, getInputOptions, getLibrary, getOverview, getRuns } from "../environment-engine.js";
import { requireAdmin } from "../auth-middleware.js";

const qualityDimension = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const periodQuerySchema = z.object({ year: z.string().regex(/^\d{4}$/).optional(), month: z.string().regex(/^(0[1-9]|1[0-2])$/).optional() });
const headcountQuerySchema = z.object({ facilityId: z.string().min(1), reportingPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
const headcountsQuerySchema = z.object({ year: z.string().regex(/^\d{4}$/), month: z.string().regex(/^(0[1-9]|1[0-2])$/).optional() });
const inputSchema = z.object({
  facilityId: z.string(),
  facilityName: z.string(),
  category: z.enum(activityCategories),
  subcategory: z.string(),
  activityValue: z.number(),
  activityUnit: z.string(),
  geography: z.string(),
  reportingPeriod: z.string(),
  employeeCount: z.number().int().positive().optional(),
  sourceType: z.enum(["FACTURA_COMERCIAL", "MEDICION_DIRECTA", "REGISTRO_OPERATIVO", "ESTIMACION"]),
  sourceReference: z.string(),
  quality: z.object({ source: qualityDimension, measurement: qualityDimension, temporalRepresentativeness: qualityDimension, operationalRepresentativeness: qualityDimension, traceability: qualityDimension }),
  contractualFactor: z.number().optional(),
  contractualFactorSource: z.string().optional(),
  gasOrigin: z.enum(["combustion", "biogenic", "fugitiveFossil"]).optional(),
  recycledContentPct: z.number().optional(),
  recoveredMassKg: z.number().optional(),
  materialEligibleKg: z.number().optional(),
  productMassKg: z.number().optional(),
  byproductMassKg: z.number().optional(),
  dischargedM3: z.number().optional(),
  reusedM3: z.number().optional(),
  denominatorValue: z.number().optional(),
  denominatorUnit: z.string().optional(),
  wasteHazardous: z.boolean().optional(),
  digitalProvider: z.string().optional(),
  aiModel: z.string().optional(),
  aiInputTokens: z.number().int().nonnegative().optional(),
  aiOutputTokens: z.number().int().nonnegative().optional(),
  internetUploadGb: z.number().nonnegative().optional(),
  internetDownloadGb: z.number().nonnegative().optional(),
  reportedEnergyKwh: z.number().nonnegative().optional(),
  reportedWaterM3: z.number().nonnegative().optional(),
  reportedCo2eKg: z.number().nonnegative().optional(),
});

export const environmentRouter = Router();

function writeSecretHash() {
  const secret = process.env.KLIMATKA_ENVIRONMENT_WRITE_SECRET;
  if (!secret) throw Object.assign(new Error("La persistencia ambiental no está configurada."), { statusCode: 503 });
  return sha256(secret);
}

async function loadRows(client: NonNullable<Request["supabaseClient"]>, table: "calculation_runs" | "facility_headcounts" | "calculation_run_audit", tenantId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select("*").eq("tenant_id", tenantId).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) return rows;
  }
}

async function loadModuleRows(req: Request, table: "measurement_modules" | "measurement_module_versions") {
  const client = req.supabaseClient;
  if (!client) throw new Error("Authenticated Supabase client is unavailable.");
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) return rows;
  }
}

async function syncModules(req: Request) {
  if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") return;
  const [modules, versions] = await Promise.all([
    loadModuleRows(req, "measurement_modules"),
    loadModuleRows(req, "measurement_module_versions"),
  ]);
  syncEnvironmentModules(modules, versions);
}

async function syncTenant(req: Request) {
  if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") return;
  const client = req.supabaseClient;
  if (!client) throw new Error("Authenticated Supabase client is unavailable.");
  const tenantId = req.auth!.company!.id;
  const [runs, headcounts, audits] = await Promise.all([
    loadRows(client, "calculation_runs", tenantId),
    loadRows(client, "facility_headcounts", tenantId),
    loadRows(client, "calculation_run_audit", tenantId),
  ]);
  syncTenantEnvironmentData(tenantId, runs, headcounts, audits);
  await syncModules(req);
}

function databaseError(error: unknown, fallback: string) {
  const code = (error as { code?: string } | null)?.code;
  const statusCode = code === "23505" ? 409 : code === "P0002" ? 404 : code === "42501" ? 403 : (error as { statusCode?: number } | null)?.statusCode ?? 500;
  const message = code === "23505"
    ? "Esta fuente ya fue contabilizada para la instalación, categoría y período."
    : code === "P0002"
      ? "No se encontró el registro solicitado."
      : code === "42501"
        ? "No tienes permiso para realizar esta operación."
        : (error as { message?: string } | null)?.message ?? fallback;
  return { statusCode, message };
}

async function persistRun(req: Request, functionName: string, args: Record<string, unknown>) {
  const { data, error } = await req.supabaseClient!.rpc(functionName, { ...args, p_secret_hash: writeSecretHash() });
  if (error) throw error;
  await syncTenant(req);
  return data;
}

environmentRouter.get("/overview", async (req, res) => {
  try {
    const overview = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getOverview(req.auth!.company!.id);
    });
    res.json(overview);
  } catch {
    res.status(503).json({ message: "No se pudieron cargar los datos ambientales." });
  }
});
environmentRouter.get("/library", requireAdmin, (_req, res) => res.json(getLibrary()));
environmentRouter.get("/options", async (req, res) => {
  const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(req.query.reportingPeriod);
  if (req.query.reportingPeriod !== undefined && !period.success) {
    res.status(400).json({ message: "Selecciona un período válido." });
    return;
  }
  try {
    const options = await withEnvironmentCache(async () => {
      await syncModules(req);
      return getInputOptions(period.success ? period.data : undefined);
    });
    res.json(options);
  } catch {
    res.status(503).json({ message: "No se pudieron cargar las opciones de captura." });
  }
});
environmentRouter.get("/headcounts/current", async (req, res) => {
  const parsed = headcountQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Selecciona una sede y un período válido." });
    return;
  }
  try {
    const employeeCount = await withEnvironmentCache(async () => {
      await syncTenant(req);
      const { facilityId, reportingPeriod } = parsed.data;
      return getFacilityHeadcount(req.auth!.company!.id, facilityId, reportingPeriod);
    });
    res.json({ employeeCount });
  } catch {
    res.status(503).json({ message: "No se pudo consultar la dotación." });
  }
});
environmentRouter.get("/headcounts", async (req, res) => {
  const parsed = headcountsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Selecciona un período válido." });
    return;
  }
  try {
    const headcounts = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getFacilityHeadcounts(req.auth!.company!.id, parsed.data.year, parsed.data.month);
    });
    res.json(headcounts);
  } catch {
    res.status(503).json({ message: "No se pudo consultar la dotación." });
  }
});
environmentRouter.get("/runs", async (req, res) => {
  const parsed = periodQuerySchema.safeParse(req.query);
  if (!parsed.success || (parsed.data.month && !parsed.data.year)) {
    res.status(400).json({ message: "Selecciona un año válido y, para la vista mensual, un mes válido." });
    return;
  }
  try {
    const runs = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getRuns(req.auth!.company!.id, parsed.data.year, parsed.data.month);
    });
    res.json(runs);
  } catch {
    res.status(503).json({ message: "No se pudieron cargar los registros ambientales." });
  }
});
environmentRouter.get("/runs/export", async (req, res) => {
  try {
    const runs = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getAllRuns(req.auth!.company!.id);
    });
    res.json(runs);
  } catch {
    res.status(503).json({ message: "No se pudieron exportar los registros ambientales." });
  }
});
environmentRouter.get("/runs/:calculationId/history", async (req, res) => {
  try {
    const history = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getCalculationHistory(req.params.calculationId, req.auth!.company!.id);
    });
    res.json(history);
  } catch {
    res.status(503).json({ message: "No se pudo cargar el historial del registro." });
  }
});
environmentRouter.patch("/runs/:calculationId", async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Revisa los campos requeridos.", errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
    return;
  }
  if (req.auth!.role === "member" && parsed.data.employeeCount !== undefined) {
    res.status(403).json({ message: "Solo una persona administradora puede actualizar la dotación de la sede." });
    return;
  }
  try {
    const result = await withEnvironmentCache(async () => {
      const tenantId = req.auth!.company!.id;
      const input = { ...parsed.data, tenantId, createdByUserId: req.auth!.id } as EnvironmentalInput;
      if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
        return updateCalculation(req.params.calculationId, tenantId, input, { id: req.auth!.id, role: req.auth!.role as "admin" | "member" });
      }
      await syncTenant(req);
      const prepared = prepareCalculationUpdate(req.params.calculationId, tenantId, input, { id: req.auth!.id, role: req.auth!.role as "admin" | "member" });
      await persistRun(req, "klimatka_environment_update_run", {
        p_tenant_id: tenantId,
        p_calculation_id: req.params.calculationId,
        p_run: prepared.run,
        p_employee_count: parsed.data.employeeCount ?? null,
      });
      return prepared.result;
    });
    res.json(result);
  } catch (error) {
    const details = databaseError(error, "No se pudo actualizar el cálculo.");
    res.status(details.statusCode).json({ message: details.message, errors: (error as { errors?: string[] }).errors ?? [], warnings: (error as { warnings?: string[] }).warnings ?? [] });
  }
});
environmentRouter.delete("/runs/:calculationId", async (req, res) => {
  try {
    const result = await withEnvironmentCache(async () => {
      if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
        return deleteCalculation(req.params.calculationId, req.auth!.company!.id, { id: req.auth!.id, role: req.auth!.role as "admin" | "member" });
      }
      await syncTenant(req);
      return persistRun(req, "klimatka_environment_delete_run", { p_tenant_id: req.auth!.company!.id, p_calculation_id: req.params.calculationId });
    });
    res.json(result);
  } catch (error) {
    const details = databaseError(error, "No se pudo eliminar el cálculo.");
    res.status(details.statusCode).json({ message: details.message });
  }
});
environmentRouter.get("/health", async (req, res) => {
  try {
    const health = await withEnvironmentCache(async () => {
      await syncTenant(req);
      return getDatabaseHealth(req.auth!.company!.id);
    });
    res.json(health);
  } catch {
    res.status(503).json({ message: "No se pudo consultar el estado de la base de datos." });
  }
});
environmentRouter.post("/calculate", async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Revisa los campos requeridos.", errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
    return;
  }
  if (req.auth!.role === "member" && parsed.data.employeeCount !== undefined) {
    res.status(403).json({ message: "Solo una persona administradora puede actualizar la dotación de la sede." });
    return;
  }
  try {
    const result = await withEnvironmentCache(async () => {
      const input = { ...parsed.data, tenantId: req.auth!.company!.id, createdByUserId: req.auth!.id } as EnvironmentalInput;
      if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
        return createCalculation(input, req.auth!.role as "admin" | "member");
      }
      await syncTenant(req);
      const prepared = prepareCalculation(input, req.auth!.role as "admin" | "member");
      await persistRun(req, "klimatka_environment_create_run", { p_run: prepared.run, p_employee_count: parsed.data.employeeCount ?? null });
      return prepared.result;
    });
    res.status(201).json(result);
  } catch (error) {
    const details = databaseError(error, "No se pudo completar el cálculo.");
    res.status(details.statusCode).json({ message: details.message, errors: (error as { errors?: string[] }).errors ?? [], warnings: (error as { warnings?: string[] }).warnings ?? [] });
  }
});
