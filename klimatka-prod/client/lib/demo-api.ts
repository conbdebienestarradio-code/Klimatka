import type { AuthCompany, AuthIdentity } from "@shared/auth";
import type {
  ActivityCategory,
  CalculationResult,
  EnvironmentalInput,
  EnvironmentalOverview,
  FacilityHeadcount,
} from "@shared/environment";
import { demoIdentity, demoOverview, demoRuns, getDemoHeadcounts } from "./demo-data";
import { supabase } from "./supabase";

const storageKey = "klimatka-demo-workspace-v1";
const currentYear = new Date().getFullYear();

type DemoHistoryEntry = {
  action: "EDIT" | "DELETE";
  changedAt: string;
  previousRecord: CalculationResult;
};

type DemoInvitation = {
  token: string;
  email: string;
  company: AuthCompany;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
};

type DemoPasswordReset = { email: string; token: string; expiresAt: string };

type DemoMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: "admin" | "member";
  companyId: string;
  joinedAt: string;
};

type DemoStore = {
  authenticated: boolean;
  identity: AuthIdentity;
  runs: CalculationResult[];
  history: Record<string, DemoHistoryEntry[]>;
  headcounts: FacilityHeadcount[];
  invitations: DemoInvitation[];
  passwordResets: DemoPasswordReset[];
  members: DemoMember[];
};

const demoLibrary = {
  modules: [{
    id: "demo-module-intensity",
    code: "CUSTOM_INTENSITY",
    name: "Intensidad de producción",
    description: "Indicador de ejemplo para la vista demostrativa.",
    unit: "t producto",
    metricName: "Producción reportada",
    active: true,
    currentVersion: {
      id: "demo-module-intensity-v1",
      moduleId: "demo-module-intensity",
      version: 1,
      name: "Intensidad de producción",
      description: "Indicador de ejemplo para la vista demostrativa.",
      unit: "t producto",
      metricName: "Producción reportada",
      factorValue: 0.25,
      factorUnit: "kgCO₂e/unidad",
      sourceReference: "Factor demostrativo",
      status: "VIGENTE",
      validFrom: `${currentYear}-01-01`,
      createdAt: new Date().toISOString(),
    },
  }],
  electricity: [{ code: "VE_INTERCONECTADA", name: "Venezuela · Red interconectada", co2Factor: 0.485, ch4Factor: 0.000012, n2oFactor: 0.000002, year: currentYear - 2, status: "PENDIENTE_VALIDACION_OFICIAL", sourceId: "SRC-DEMO", tier: "Tier 3", uncertaintyPct: 20 }],
  fuels: [
    { code: "DIESEL_GENERIC", name: "Gasóleo / Diésel", unit: "liter", co2Factor: 2.6878, ch4Factor: 0.00023, n2oFactor: 0.000004, density: 0.84, ncv: 0.043, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "GASOLINE_GENERIC", name: "Gasolina", unit: "liter", co2Factor: 2.315, ch4Factor: 0.00038, n2oFactor: 0.000008, density: 0.745, ncv: 0.0342, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "NATGAS_INDUSTRIAL", name: "Gas natural", unit: "m3", co2Factor: 1.912, ch4Factor: 0.00005, n2oFactor: 0.0000001, density: 0.75, ncv: 0.038, status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  water: [
    { code: "MUNICIPAL_SUPPLY", name: "Suministro municipal", supplyFactor: 0.344, treatmentFactor: 0.708, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "DESALINATION_RO", name: "Desalación", supplyFactor: 3.2, treatmentFactor: 0, status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  wasteDestinations: [
    { code: "LANDFILL_UNCONTROLLED", name: "Vertedero no controlado", factor: 1.25, status: "PENDIENTE_VALIDACION_OFICIAL", sourceId: "SRC-DEMO" },
    { code: "RECYCLING", name: "Reciclaje / aprovechamiento", factor: -0.45, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "COMPOSTING", name: "Compostaje", factor: 0.05, status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  materials: [
    { code: "STEEL_PRIMARY", name: "Acero virgen", embodiedFactor: 2.3, recycledContentPct: 5, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "STEEL_RECYCLED", name: "Acero reciclado", embodiedFactor: 0.6, recycledContentPct: 90, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "ALUMINUM_PRIMARY", name: "Aluminio primario", embodiedFactor: 16.5, recycledContentPct: 10, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "CEMENT_OPC", name: "Cemento", embodiedFactor: 0.85, recycledContentPct: 0, status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  packaging: [
    { code: "PET_BOTTLE_500ML", name: "Botella PET · 500 ml", material: "PET", avgWeightG: 18.5, recyclable: "SI", status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "HDPE_JUG_5L", name: "Envase HDPE · 5 l", material: "HDPE", avgWeightG: 145, recyclable: "SI", status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "CORRUGATED_BOX_MED", name: "Caja de cartón", material: "Papel/cartón", avgWeightG: 320, recyclable: "SI", status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  refrigerants: [
    { code: "R-134a", name: "R-134a", gwp: 1430, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "R-410A", name: "R-410A", gwp: 2256, status: "VIGENTE", sourceId: "SRC-DEMO" },
    { code: "R-717", name: "Amoníaco · R-717", gwp: 0, status: "VIGENTE", sourceId: "SRC-DEMO" },
  ],
  pollutants: [{ code: "CO2", name: "Dióxido de carbono", status: "VIGENTE", sourceId: "SRC-DEMO" }],
  sources: [{ id: "SRC-DEMO", title: "Biblioteca de ejemplo", organization: "Klimatka", year: currentYear, tier: "Demostración", reference: "Datos ficticios para capturas" }],
  roadmap: [{ code: "DEMO-ROADMAP", name: "Hoja de ruta demostrativa", horizon: "0–90 días", objectives: "Ejemplo de objetivo", output: "Ejemplo de resultado" }],
  gwp: [],
  conversions: [],
  rules: [],
  methodology: [],
  counts: { modules: 1, factors: 12, sources: 1 },
};

function initialStore(): DemoStore {
  return {
    authenticated: true,
    identity: { ...demoIdentity, companies: demoIdentity.company ? [demoIdentity.company] : [] },
    runs: demoRuns,
    history: {},
    headcounts: getDemoHeadcounts(String(currentYear)),
    invitations: [],
    passwordResets: [],
    members: [{ id: demoIdentity.id, email: demoIdentity.email, firstName: demoIdentity.firstName, lastName: demoIdentity.lastName, jobTitle: demoIdentity.jobTitle, role: "admin", companyId: (demoIdentity.company as AuthCompany).id, joinedAt: new Date().toISOString() }],
  };
}

function readStore(): DemoStore {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as DemoStore;
      if (typeof parsed.authenticated === "boolean" && parsed.identity && Array.isArray(parsed.runs) && parsed.history && Array.isArray(parsed.headcounts) && Array.isArray(parsed.invitations)) {
        const company = parsed.identity.company ?? demoIdentity.company as AuthCompany;
        const members = Array.isArray(parsed.members) ? parsed.members : [{ id: parsed.identity.id, email: parsed.identity.email, firstName: parsed.identity.firstName, lastName: parsed.identity.lastName, jobTitle: parsed.identity.jobTitle, role: parsed.identity.role === "member" ? "member" as const : "admin" as const, companyId: company.id, joinedAt: new Date().toISOString() }];
        const invitations = parsed.invitations.map((invitation) => ({ ...invitation, company: invitation.company ?? company }));
        const passwordResets = Array.isArray(parsed.passwordResets) ? parsed.passwordResets : [];
        return { ...parsed, members, invitations, passwordResets };
      }
    }
  } catch {
    return initialStore();
  }
  return initialStore();
}

function writeStore(store: DemoStore) {
  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function isDemoMode() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("demo") === "1";
}
let pendingWriteCount = 0;
const pendingWriteListeners = new Set<(count: number) => void>();

function publishPendingWriteCount() {
  pendingWriteListeners.forEach((listener) => listener(pendingWriteCount));
}

export function subscribeToPendingWrites(listener: (count: number) => void) {
  pendingWriteListeners.add(listener);
  listener(pendingWriteCount);
  return () => {
    pendingWriteListeners.delete(listener);
  };
}
export async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (isDemoMode()) return demoApiFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init?.headers);
  const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } };
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const activeCompanyId = window.localStorage.getItem("klimatka-active-company");
  if (activeCompanyId) headers.set("x-klimatka-company-id", activeCompanyId);
  if (isWrite) {
    pendingWriteCount += 1;
    publishPendingWriteCount();
  }
  try {
    return await window.fetch(input, { ...init, headers });
  } finally {
    if (isWrite) {
      pendingWriteCount -= 1;
      publishPendingWriteCount();
    }
  }
}

export async function appLogout() {
  if (isDemoMode()) {
    await demoApiFetch("/api/auth/logout", { method: "POST" });
    return;
  }
  await supabase?.auth.signOut({ scope: "local" });
  window.localStorage.removeItem("klimatka-active-company");
}

export function getDemoIdentity() {
  return readStore().identity;
}

export function resetDemoWorkspace() {
  window.localStorage.removeItem(storageKey);
  window.location.assign("/?demo=1");
}

export function setActiveCompanyId(companyId: string) {
  if (!isDemoMode()) window.localStorage.setItem("klimatka-active-company", companyId);
}

export function saveDemoIdentity(identity: AuthIdentity) {
  const store = readStore();
  store.identity = identity;
  store.authenticated = true;
  writeStore(store);
}

function parseBody(init?: RequestInit) {
  return typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
}

function facilityIdForName(name: string) {
  return `demo-${name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function normalizedActivityValue(input: EnvironmentalInput) {
  const conversions: Record<string, number> = {
    MWh: 1_000,
    Wh: 0.001,
    GJ: 277.7777778,
    MJ: 0.277777778,
    t: 1_000,
    kg: 1,
    g: 0.001,
    m3: 1,
    "m³": 1,
    liter: 1,
    L: 1,
    GB: 1,
    solicitudes: 1,
    unit: 1,
  };
  return input.activityValue * (conversions[input.activityUnit] ?? 1);
}

function getDemoFactor(input: EnvironmentalInput) {
  if (input.category === "ELECTRICITY") return input.subcategory === "MARKET_BASED" ? input.contractualFactor ?? 0.42 : 0.485;
  if (input.category === "FUEL") return input.subcategory.includes("GASOLINE") ? 2.315 : input.subcategory.includes("NATGAS") ? 1.912 : 2.6878;
  if (input.category === "WATER") return input.subcategory.includes("DESALINATION") ? 3.2 : 1.052;
  if (input.category === "WASTE") return input.subcategory === "RECYCLING" ? -0.45 : input.subcategory === "COMPOSTING" ? 0.05 : 1.25;
  if (input.category === "MATERIAL") return input.subcategory === "ALUMINUM_PRIMARY" ? 16.5 : input.subcategory === "STEEL_RECYCLED" ? 0.6 : input.subcategory === "CEMENT_OPC" ? 0.85 : 2.3;
  if (input.category === "PACKAGING") return 0.0023;
  if (input.category === "REFRIGERANT") return input.subcategory === "R-410A" ? 2256 : input.subcategory === "R-717" ? 0 : 1430;
  if (input.category === "AIR") return input.subcategory === "CO2" ? 1 : input.subcategory === "CH4" ? (input.gasOrigin === "fugitiveFossil" ? 29.8 : 27) : input.subcategory === "N2O" ? 273 : 0;
  return 0.25;
}

function getDemoScope(category: ActivityCategory) {
  if (["FUEL", "REFRIGERANT"].includes(category)) return "Scope 1";
  if (category === "ELECTRICITY") return "Scope 2";
  return "Scope 3";
}

function makeCalculation(input: EnvironmentalInput, calculationId?: string, revision = 1, createdByUserId = input.createdByUserId ?? demoIdentity.id, createdByRole: "admin" | "member" = "admin"): CalculationResult {
  const normalizedValue = normalizedActivityValue(input);
  const factorValue = getDemoFactor(input);
  const digital = input.category === "AI" || input.category === "INTERNET";
  const emissionsApplicable = !digital && !(input.category === "AIR" && !["CO2", "CH4", "N2O"].includes(input.subcategory));
  const co2eTotalTonnes = emissionsApplicable ? normalizedValue * factorValue / 1_000 : null;
  const score = Object.values(input.quality).reduce((total, value) => total + value, 0);
  const digitalUsage = input.category === "AI"
    ? { provider: input.digitalProvider || "Proveedor demostrativo", ...(input.aiModel ? { model: input.aiModel } : {}), ...(input.aiInputTokens !== undefined ? { inputTokens: input.aiInputTokens } : {}), ...(input.aiOutputTokens !== undefined ? { outputTokens: input.aiOutputTokens } : {}), ...(input.reportedEnergyKwh !== undefined ? { reportedEnergyKwh: input.reportedEnergyKwh } : {}), ...(input.reportedWaterM3 !== undefined ? { reportedWaterM3: input.reportedWaterM3 } : {}), ...(input.reportedCo2eKg !== undefined ? { reportedCo2eKg: input.reportedCo2eKg } : {}) }
    : input.category === "INTERNET"
      ? { provider: input.digitalProvider || "Proveedor demostrativo", ...(input.internetUploadGb !== undefined ? { uploadGb: input.internetUploadGb } : {}), ...(input.internetDownloadGb !== undefined ? { downloadGb: input.internetDownloadGb } : {}), ...(input.reportedEnergyKwh !== undefined ? { reportedEnergyKwh: input.reportedEnergyKwh } : {}), ...(input.reportedWaterM3 !== undefined ? { reportedWaterM3: input.reportedWaterM3 } : {}), ...(input.reportedCo2eKg !== undefined ? { reportedCo2eKg: input.reportedCo2eKg } : {}) }
      : undefined;
  const calculationKey = calculationId ?? `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fallbackApplied = input.category === "ELECTRICITY" && input.subcategory === "LOCATION_BASED";
  const recommendations = input.category === "ELECTRICITY" && normalizedValue > 20_000
    ? [{ id: "demo-energy-efficiency", category: input.category, probableCause: "Demanda eléctrica elevada en el período.", opportunity: "Revisar horarios de operación y equipos de mayor consumo.", action: "Programar una revisión de eficiencia energética", investment: "Inversión baja", timeframe: "0–90 días", priority: "ALTA", venezuelaAvailability: "Disponible localmente", paybackMonths: 8 }]
    : [];
  const activityUnit = input.category === "ELECTRICITY" && ["MWh", "Wh", "GJ", "MJ"].includes(input.activityUnit) ? "kWh" : input.category === "WASTE" || input.category === "MATERIAL" || input.category === "REFRIGERANT" || input.category === "AIR" ? "kg" : input.activityUnit;
  const snapshot: Record<string, unknown> = {
    activity: { ...input },
    factorSourceReference: input.category === "ELECTRICITY" ? "Biblioteca demostrativa · factor de red" : "Biblioteca demostrativa · factor de ejemplo",
    engineVersion: "1.0.0-demo",
    methodology: "Simulación local · datos ficticios",
    recommendations,
    revision,
  };
  return {
    calculationId: calculationKey,
    createdByUserId,
    createdByRole,
    category: input.category,
    scope: getDemoScope(input.category),
    activityValue: input.activityValue,
    activityUnit: input.activityUnit,
    normalizedValue,
    normalizedUnit: activityUnit,
    geography: input.geography,
    reportingPeriod: input.reportingPeriod,
    metricValue: co2eTotalTonnes === null ? normalizedValue : co2eTotalTonnes * 1_000,
    metricUnit: co2eTotalTonnes === null ? activityUnit : "kgCO₂e",
    co2eTotalTonnes,
    factorUsed: input.category === "ELECTRICITY" && input.subcategory === "LOCATION_BASED" ? "GRID_VE_2024" : input.subcategory,
    factorValue: emissionsApplicable ? factorValue : null,
    factorUnit: emissionsApplicable ? "kgCO₂e/unidad" : "No aplica",
    factorStatus: fallbackApplied ? "PENDIENTE_VALIDACION_OFICIAL" : digital ? "INFORMATIVO" : "VIGENTE",
    sourceReference: input.sourceReference,
    fallbackApplied,
    uncertaintyPct: 8,
    dataQualityScore: score,
    dataQualityRating: score >= 9 ? "Alta" : score >= 7 ? "Media-alta" : score >= 5 ? "Media" : score >= 3 ? "Baja" : "Insuficiente",
    dataQualityTier: score >= 9 ? "Tier 1" : score >= 7 ? "Tier 2" : "Tier 3",
    thresholdStatus: "NORMAL",
    warnings: [],
    validation: [],
    breakdown: co2eTotalTonnes === null ? {} : { CO2: co2eTotalTonnes * 1_000 },
    ...(input.category === "WATER" && input.dischargedM3 !== undefined ? { waterBalanceDifferenceM3: normalizedValue - input.dischargedM3 - (input.reusedM3 ?? 0) } : {}),
    ...(input.category === "WATER" && input.reusedM3 !== undefined ? { waterReusePct: normalizedValue > 0 ? input.reusedM3 / normalizedValue * 100 : 0 } : {}),
    ...(input.category === "MATERIAL" && input.recoveredMassKg !== undefined ? { recoverableMaterialPct: normalizedValue > 0 ? input.recoveredMassKg / normalizedValue * 100 : 0 } : {}),
    ...(digitalUsage ? { digitalUsage } : {}),
    snapshot,
    createdAt: new Date().toISOString(),
  };
}

function getOverview(runs: CalculationResult[]): EnvironmentalOverview {
  const emissions = runs.filter((run) => run.co2eTotalTonnes !== null && !run.digitalUsage);
  return {
    ...demoOverview,
    totals: {
      co2eTonnes: emissions.reduce((total, run) => total + (run.co2eTotalTonnes ?? 0), 0),
      co2eRunCount: emissions.length,
      electricityKwh: runs.filter((run) => run.category === "ELECTRICITY").reduce((total, run) => total + run.normalizedValue, 0),
      waterM3: runs.filter((run) => run.category === "WATER").reduce((total, run) => total + run.normalizedValue, 0),
      wasteTonnes: runs.filter((run) => run.category === "WASTE").reduce((total, run) => total + run.normalizedValue, 0) / 1_000,
      runCount: runs.length,
    },
    availablePeriods: [...new Set(runs.map((run) => run.reportingPeriod))].sort(),
    availableYears: [...new Set(runs.map((run) => run.reportingPeriod.slice(0, 4)))].sort().reverse(),
    recentRuns: runs.slice(0, 6),
  };
}

function updateHeadcount(store: DemoStore, input: EnvironmentalInput) {
  if (input.employeeCount === undefined) return;
  const facilityId = input.facilityId || facilityIdForName(input.facilityName);
  const next: FacilityHeadcount = { facilityId, facilityName: input.facilityName, reportingPeriod: input.reportingPeriod, employeeCount: input.employeeCount };
  store.headcounts = [next, ...store.headcounts.filter((item) => item.facilityId !== facilityId || item.reportingPeriod !== input.reportingPeriod)];
}

export async function demoApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(requestUrl, window.location.origin);
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const store = readStore();

  if (path === "/api/auth/me" && method === "GET") return store.authenticated && url.searchParams.get("invited") !== "1" ? jsonResponse(store.identity) : jsonResponse({ message: "No existe una sesión de demostración activa." }, 401);
  if (path === "/api/auth/login" && method === "POST") {
    const email = String(parseBody(init).email ?? "").trim().toLowerCase();
    const member = store.members.find((item) => item.email.toLowerCase() === email);
    if (!member) return jsonResponse({ message: "Correo o contraseña incorrectos." }, 401);
    const companyData = store.identity.companies.find((item) => item.id === member.companyId) ?? store.identity.company ?? demoIdentity.company as AuthCompany;
    const company: AuthCompany = { ...companyData, id: member.companyId, role: member.role };
    store.identity = { ...store.identity, id: member.id, email: member.email, firstName: member.firstName, lastName: member.lastName, jobTitle: member.jobTitle, company, companies: [company], role: member.role };
    store.authenticated = true;
    writeStore(store);
    return jsonResponse(store.identity);
  }
  if (path === "/api/auth/register" && method === "POST") {
    const body = parseBody(init);
    store.authenticated = true;
    store.identity = {
      ...store.identity,
      id: `demo-user-${crypto.randomUUID()}`,
      firstName: String(body.firstName ?? "Usuario"),
      lastName: String(body.lastName ?? "Demostración"),
      jobTitle: String(body.jobTitle ?? "Usuario"),
      email: String(body.email ?? "demo@klimatka.example"),
      company: null,
      companies: [],
      role: "none",
    };
    writeStore(store);
    return jsonResponse(store.identity);
  }
  if (path === "/api/auth/companies" && method === "POST") {
    const body = parseBody(init);
    const company: AuthCompany = {
      id: `demo-company-${crypto.randomUUID()}`,
      name: String(body.companyName ?? "Empresa de ejemplo"),
      rif: String(body.rif ?? "J-00000000-0"),
      email: String(body.companyEmail ?? "demo@empresa.example"),
      employeeCount: Number(body.employeeCount ?? 1),
      role: "admin",
    };
    store.identity = { ...store.identity, company, companies: [company, ...store.identity.companies], role: "admin" };
    store.members = [...store.members.filter((member) => member.id !== store.identity.id), { id: store.identity.id, email: store.identity.email, firstName: store.identity.firstName, lastName: store.identity.lastName, jobTitle: store.identity.jobTitle, role: "admin", companyId: company.id, joinedAt: new Date().toISOString() }];
    store.authenticated = true;
    writeStore(store);
    return jsonResponse(store.identity);
  }
  if (path === "/api/auth/companies/switch" && method === "POST") {
    const companyId = String(parseBody(init).companyId ?? "");
    const company = store.identity.companies.find((item) => item.id === companyId);
    if (!company) return jsonResponse({ message: "No se encontró el espacio de demostración." }, 404);
    store.identity = { ...store.identity, company, role: company.role };
    writeStore(store);
    return jsonResponse(store.identity);
  }
  if (path === "/api/auth/members" && method === "GET") {
    const companyId = store.identity.company?.id;
    return jsonResponse({ members: store.members.filter((member) => member.companyId === companyId), pendingInvitations: store.invitations.filter((invitation) => invitation.company.id === companyId && !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now()).map(({ email, expiresAt }) => ({ email, expiresAt })), emailConfigured: false });
  }
  const memberMatch = path.match(/^\/api\/auth\/members\/([^/]+)$/);
  if (memberMatch && method === "DELETE") {
    const userId = decodeURIComponent(memberMatch[1]);
    if (store.identity.role !== "admin" || userId === store.identity.id) return jsonResponse({ message: "No puedes revocar este acceso." }, 403);
    const member = store.members.find((item) => item.id === userId && item.companyId === store.identity.company?.id);
    if (!member) return jsonResponse({ message: "No se encontró a esa persona en la empresa." }, 404);
    store.members = store.members.filter((item) => item.id !== userId || item.companyId !== store.identity.company?.id);
    store.invitations = store.invitations.map((invitation) => invitation.email.toLowerCase() === member.email.toLowerCase() && invitation.company.id === member.companyId && !invitation.acceptedAt ? { ...invitation, revokedAt: new Date().toISOString() } : invitation);
    writeStore(store);
    return jsonResponse({ message: "Acceso revocado. Sus registros e historial se conservaron en los totales de la empresa." });
  }
  if (path === "/api/auth/password-reset/request" && method === "POST") {
    const email = String(parseBody(init).email ?? "").trim().toLowerCase();
    const reset = { email, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString() };
    store.passwordResets = [...store.passwordResets.filter((item) => item.email !== email), reset];
    writeStore(store);
    return jsonResponse({ message: "Solicitud simulada. En la demostración no se envía un correo real.", url: `/reset-password?token=${encodeURIComponent(reset.token)}&demo=1` });
  }
  if (path === "/api/auth/password-reset/complete" && method === "POST") {
    const token = String(parseBody(init).token ?? "");
    const reset = store.passwordResets.find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
    if (!reset) return jsonResponse({ message: "El enlace de demostración expiró o ya fue utilizado. Solicita uno nuevo." }, 400);
    store.passwordResets = store.passwordResets.filter((item) => item.token !== token);
    writeStore(store);
    return jsonResponse({ message: "Contraseña de demostración actualizada. No se cambió ninguna cuenta real." });
  }

  if (path.startsWith("/api/environment/") && store.identity.role === "member" && !store.members.some((member) => member.id === store.identity.id && member.companyId === store.identity.company?.id)) return jsonResponse({ message: "El acceso a esta empresa fue revocado." }, 409);
  if (path === "/api/environment/overview" && method === "GET") return jsonResponse(getOverview(store.runs));
  if (["/api/environment/library", "/api/environment/options"].includes(path) && method === "GET") return jsonResponse(demoLibrary);
  if (path === "/api/environment/runs/export" && method === "GET") return jsonResponse(store.runs);
  if (path === "/api/environment/runs" && method === "GET") {
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    return jsonResponse(store.runs.filter((run) => (!year || run.reportingPeriod.startsWith(`${year}-`)) && (!month || run.reportingPeriod.endsWith(`-${month}`))));
  }
  if (path === "/api/environment/headcounts/current" && method === "GET") {
    const facilityId = url.searchParams.get("facilityId");
    const reportingPeriod = url.searchParams.get("reportingPeriod");
    const match = store.headcounts.find((item) => item.facilityId === facilityId && item.reportingPeriod === reportingPeriod);
    return jsonResponse({ employeeCount: match?.employeeCount ?? null });
  }
  if (path === "/api/environment/headcounts" && method === "GET") {
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    return jsonResponse(store.headcounts.filter((item) => (!year || item.reportingPeriod.startsWith(`${year}-`)) && (!month || item.reportingPeriod.endsWith(`-${month}`))));
  }
  if (path === "/api/environment/calculate" && method === "POST") {
    const input = parseBody(init) as unknown as EnvironmentalInput;
    const run = makeCalculation(input, undefined, 1, store.identity.id, store.identity.role === "member" ? "member" : "admin");
    store.runs = [run, ...store.runs];
    updateHeadcount(store, input);
    writeStore(store);
    return jsonResponse(run);
  }
  const historyMatch = path.match(/^\/api\/environment\/runs\/([^/]+)\/history$/);
  if (historyMatch && method === "GET") return jsonResponse(store.history[decodeURIComponent(historyMatch[1])] ?? []);
  const runMatch = path.match(/^\/api\/environment\/runs\/([^/]+)$/);
  if (runMatch) {
    const calculationId = decodeURIComponent(runMatch[1]);
    const runIndex = store.runs.findIndex((item) => item.calculationId === calculationId);
    if (runIndex < 0) return jsonResponse({ message: "No se encontró el registro de demostración." }, 404);
    const previous = store.runs[runIndex];
    if (method === "PATCH") {
      if (store.identity.role === "member" && previous.createdByUserId !== store.identity.id) return jsonResponse({ message: "Solo puedes modificar tus propios registros." }, 403);
      const input = parseBody(init) as unknown as EnvironmentalInput;
      const revision = Number(previous.snapshot.revision ?? 1) + 1;
      const updated = makeCalculation(input, calculationId, revision, previous.createdByUserId ?? store.identity.id, previous.createdByRole ?? "admin");
      store.history[calculationId] = [{ action: "EDIT", changedAt: new Date().toISOString(), previousRecord: previous }, ...(store.history[calculationId] ?? [])];
      store.runs[runIndex] = updated;
      updateHeadcount(store, input);
      writeStore(store);
      return jsonResponse(updated);
    }
    if (method === "DELETE") {
      if (store.identity.role !== "admin" || previous.createdByRole === "member") return jsonResponse({ message: "Este registro no se puede eliminar; conserva su trazabilidad y su aporte a los totales empresariales." }, 403);
      store.history[calculationId] = [{ action: "DELETE", changedAt: new Date().toISOString(), previousRecord: previous }, ...(store.history[calculationId] ?? [])];
      store.runs.splice(runIndex, 1);
      writeStore(store);
      return jsonResponse({ message: "Registro eliminado de los cálculos activos y conservado en el historial de trazabilidad." });
    }
  }
  if (path === "/api/auth/invitations" && method === "POST") {
    if (store.identity.role !== "admin") return jsonResponse({ message: "Esta acción requiere permisos de administración." }, 403);
    const body = parseBody(init);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (store.members.some((member) => member.companyId === store.identity.company?.id && member.email.toLowerCase() === email)) return jsonResponse({ message: "Esta persona ya tiene acceso a la empresa." }, 409);
    if (store.invitations.some((invitation) => invitation.company.id === store.identity.company?.id && invitation.email.toLowerCase() === email && !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now())) return jsonResponse({ message: "Ya existe una invitación pendiente para este correo." }, 409);
    const invitation: DemoInvitation = {
      token: crypto.randomUUID(),
      email,
      company: store.identity.company as AuthCompany,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
    };
    store.invitations = [invitation, ...store.invitations];
    writeStore(store);
    return jsonResponse({ email, expiresAt: invitation.expiresAt, message: `Demostración: invitación preparada para ${email}; no se envía un correo real.`, url: `/register/invitation?token=${encodeURIComponent(invitation.token)}&demo=1&new=1` });
  }
  if (path === "/api/auth/invitations" && method === "DELETE") {
    if (store.identity.role !== "admin") return jsonResponse({ message: "Esta acción requiere permisos de administración." }, 403);
    const email = String(parseBody(init).email ?? "").trim().toLowerCase();
    const pending = store.invitations.find((invitation) => invitation.company.id === store.identity.company?.id && invitation.email.toLowerCase() === email && !invitation.acceptedAt && !invitation.revokedAt);
    if (!pending) return jsonResponse({ message: "No hay una invitación pendiente para ese correo." }, 404);
    pending.revokedAt = new Date().toISOString();
    writeStore(store);
    return jsonResponse({ message: "Invitación pendiente cancelada." });
  }
  if (path.startsWith("/api/auth/invitations/") && method === "POST" && path.endsWith("/accept")) {
    const pathParts = path.split("/");
    const token = decodeURIComponent(pathParts[pathParts.length - 2] ?? "");
    const invitation = store.invitations.find((item) => item.token === token);
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) return jsonResponse({ message: "La invitación de demostración no está disponible." }, 404);
    const company: AuthCompany = { ...invitation.company, role: "member" };
    const member: DemoMember = { id: store.identity.id, email: invitation.email, firstName: store.identity.firstName, lastName: store.identity.lastName, jobTitle: store.identity.jobTitle, role: "member", companyId: company.id, joinedAt: new Date().toISOString() };
    invitation.acceptedAt = member.joinedAt;
    store.members = [...store.members.filter((item) => item.companyId !== company.id || item.email.toLowerCase() !== invitation.email.toLowerCase()), member];
    store.identity = { ...store.identity, email: invitation.email, company, companies: [company, ...store.identity.companies.filter((item) => item.id !== company.id)], role: "member" };
    store.authenticated = true;
    writeStore(store);
    return jsonResponse(store.identity);
  }
  if (path.startsWith("/api/auth/invitations/") && method === "GET") {
    const token = decodeURIComponent(path.split("/").pop() ?? "");
    const invitation = store.invitations.find((item) => item.token === token);
    return invitation && !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now()
      ? jsonResponse({ email: invitation.email, companyName: invitation.company.name, expiresAt: invitation.expiresAt })
      : jsonResponse({ message: "La invitación de demostración no está disponible." }, 404);
  }
  if (path === "/api/auth/logout" && method === "POST") {
    store.authenticated = false;
    writeStore(store);
    return new Response(null, { status: 204 });
  }
  return jsonResponse({ message: "Acción no disponible en la demostración." }, 501);
}

export function readDemoHistory(calculationId: string) {
  return readStore().history[calculationId] ?? [];
}
