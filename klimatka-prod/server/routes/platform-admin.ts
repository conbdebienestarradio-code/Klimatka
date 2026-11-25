import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createMeasurementModule, getMeasurementModuleVersions, getMeasurementModules, syncEnvironmentModules, updateMeasurementModule } from "../environment-engine.js";
import { requirePlatformAdmin } from "../auth-middleware.js";
import { sha256 } from "../supabase.js";

const moduleFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  unit: z.string().trim().min(1).max(40),
  metricName: z.string().trim().min(1).max(80),
  factorValue: z.number().finite().nonnegative().nullable(),
  factorUnit: z.string().trim().max(80),
  sourceReference: z.string().trim().max(500),
  status: z.enum(["VIGENTE", "PENDIENTE_VALIDACION_OFICIAL"]),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};
const createSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i),
  ...moduleFields,
});
const updateSchema = z.object({
  ...moduleFields,
  active: z.boolean(),
});

export const platformAdminRouter = Router();
platformAdminRouter.use(requirePlatformAdmin);

async function loadRows(req: Request, table: "measurement_modules" | "measurement_module_versions", moduleId?: string) {
  const client = req.supabaseClient;
  if (!client) throw new Error("Authenticated Supabase client is unavailable.");
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from(table).select("*").range(from, from + 999);
    if (moduleId && table === "measurement_module_versions") query = query.eq("module_id", moduleId) as typeof query;
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) return rows;
  }
}

async function listModules(req: Request) {
  const [modules, versions] = await Promise.all([loadRows(req, "measurement_modules"), loadRows(req, "measurement_module_versions")]);
  return modules.sort((a, b) => String(a.name).localeCompare(String(b.name), "es")).map((module) => {
    const version = versions.filter((item) => item.module_id === module.module_id).sort((a, b) => Number(b.version) - Number(a.version))[0];
    return {
      id: String(module.module_id),
      code: String(module.module_code),
      name: String(module.name),
      description: String(module.description),
      unit: String(module.unit),
      metricName: String(module.metric_name),
      active: Boolean(module.active),
      currentVersion: version ? {
        id: String(version.version_id),
        moduleId: String(version.module_id),
        version: Number(version.version),
        name: String(version.name),
        description: String(version.description),
        unit: String(version.unit),
        metricName: String(version.metric_name),
        factorValue: version.factor_value === null ? null : Number(version.factor_value),
        factorUnit: String(version.factor_unit),
        sourceReference: String(version.source_reference),
        status: String(version.status),
        validFrom: String(version.valid_from),
        createdAt: String(version.created_at),
      } : null,
    };
  });
}

function secretHash() {
  const secret = process.env.KLIMATKA_ENVIRONMENT_WRITE_SECRET;
  if (!secret) throw Object.assign(new Error("La persistencia ambiental no está configurada."), { statusCode: 503 });
  return sha256(secret);
}

function sendError(res: Response, error: unknown, fallback: string) {
  const code = (error as { code?: string } | null)?.code;
  const status = code === "23505" ? 409 : code === "P0002" ? 404 : (error as { statusCode?: number } | null)?.statusCode ?? 500;
  const message = code === "23505" ? "Ya existe un módulo con ese código." : code === "P0002" ? "No se encontró el módulo." : (error as { message?: string } | null)?.message ?? fallback;
  res.status(status).json({ message });
}

platformAdminRouter.get("/modules", async (req, res) => {
  try {
    if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
      res.json(getMeasurementModules());
      return;
    }
    res.json(await listModules(req));
  } catch {
    res.status(503).json({ message: "No se pudieron cargar los módulos." });
  }
});
platformAdminRouter.get("/modules/:moduleId/versions", async (req, res) => {
  try {
    if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
      res.json(getMeasurementModuleVersions(req.params.moduleId));
      return;
    }
    const versions = await loadRows(req, "measurement_module_versions", req.params.moduleId);
    res.json(versions.sort((a, b) => Number(b.version) - Number(a.version)).map((version) => ({
      id: String(version.version_id),
      moduleId: String(version.module_id),
      version: Number(version.version),
      name: String(version.name),
      description: String(version.description),
      unit: String(version.unit),
      metricName: String(version.metric_name),
      factorValue: version.factor_value === null ? null : Number(version.factor_value),
      factorUnit: String(version.factor_unit),
      sourceReference: String(version.source_reference),
      status: String(version.status),
      validFrom: String(version.valid_from),
      createdAt: String(version.created_at),
    })));
  } catch {
    res.status(503).json({ message: "No se pudo cargar el historial del módulo." });
  }
});
platformAdminRouter.post("/modules", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Revisa los datos del módulo.", errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
    return;
  }
  try {
    if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
      res.status(201).json(createMeasurementModule(parsed.data));
      return;
    }
    const { code, ...fields } = parsed.data;
    const { error } = await req.supabaseClient!.rpc("klimatka_environment_create_module", {
      p_secret_hash: secretHash(),
      p_module: { module_id: `module-${randomUUID()}`, module_code: code.toUpperCase(), name: fields.name, description: fields.description, unit: fields.unit, metric_name: fields.metricName, active: true, created_at: new Date().toISOString() },
      p_version: { version_id: randomUUID(), name: fields.name, description: fields.description, unit: fields.unit, metric_name: fields.metricName, factor_value: fields.factorValue, factor_unit: fields.factorUnit, source_reference: fields.sourceReference, status: fields.status, valid_from: fields.validFrom },
    });
    if (error) throw error;
    res.status(201).json((await listModules(req)).find((module) => module.code === code.toUpperCase()));
  } catch (error) {
    sendError(res, error, "No se pudo crear el módulo.");
  }
});
platformAdminRouter.put("/modules/:moduleId", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Revisa los parámetros del módulo.", errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
    return;
  }
  try {
    if (process.env.KLIMATKA_LEGACY_ENVIRONMENT_TEST_MODE === "1") {
      res.json(updateMeasurementModule(req.params.moduleId, parsed.data));
      return;
    }
    const fields = parsed.data;
    const { error } = await req.supabaseClient!.rpc("klimatka_environment_update_module", {
      p_secret_hash: secretHash(),
      p_module_id: req.params.moduleId,
      p_module: { name: fields.name, description: fields.description, unit: fields.unit, metric_name: fields.metricName, active: fields.active },
      p_version: { version_id: randomUUID(), name: fields.name, description: fields.description, unit: fields.unit, metric_name: fields.metricName, factor_value: fields.factorValue, factor_unit: fields.factorUnit, source_reference: fields.sourceReference, status: fields.status, valid_from: fields.validFrom },
    });
    if (error) throw error;
    res.json((await listModules(req)).find((module) => module.id === req.params.moduleId));
  } catch (error) {
    sendError(res, error, "No se pudo guardar la nueva versión.");
  }
});
