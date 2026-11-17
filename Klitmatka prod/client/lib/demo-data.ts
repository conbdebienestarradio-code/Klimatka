import type { AuthIdentity } from "@shared/auth";
import type {
  ActivityCategory,
  CalculationResult,
  EnvironmentalInput,
  EnvironmentalOverview,
  FacilityHeadcount,
} from "@shared/environment";

const currentYear = new Date().getFullYear();
const facilities = ["Planta Principal", "Centro Logístico"];

type DemoCategory = {
  category: ActivityCategory;
  subcategory: string;
  activityUnit: string;
  normalizedUnit: string;
  scope: string;
  factorUsed: string;
  factorValue: number | null;
  factorUnit: string;
  factorStatus: string;
  sourceReference: string;
  amount: (month: number, yearOffset: number) => number;
  digitalUsage?: CalculationResult["digitalUsage"];
};

const categories: DemoCategory[] = [
  {
    category: "ELECTRICITY",
    subcategory: "LOCATION_BASED",
    activityUnit: "kWh",
    normalizedUnit: "kWh",
    scope: "Scope 2",
    factorUsed: "GRID_VE_2024",
    factorValue: 0.485,
    factorUnit: "kgCO₂e/kWh",
    factorStatus: "PENDIENTE_VALIDACION_OFICIAL",
    sourceReference: "Factura eléctrica",
    amount: (month, yearOffset) => 12_400 + (month % 4) * 620 - yearOffset * 430,
  },
  {
    category: "FUEL",
    subcategory: "DIESEL_GENERIC",
    activityUnit: "L",
    normalizedUnit: "L",
    scope: "Scope 1",
    factorUsed: "DIESEL_STATIONARY_DEFRA",
    factorValue: 2.6878,
    factorUnit: "kgCO₂e/L",
    factorStatus: "VIGENTE",
    sourceReference: "Control de combustible",
    amount: (month, yearOffset) => 680 + (month % 3) * 55 - yearOffset * 25,
  },
  {
    category: "WATER",
    subcategory: "MUNICIPAL_SUPPLY",
    activityUnit: "m³",
    normalizedUnit: "m³",
    scope: "Scope 3",
    factorUsed: "MUNICIPAL_SUPPLY",
    factorValue: 1.052,
    factorUnit: "kgCO₂e/m³",
    factorStatus: "VIGENTE",
    sourceReference: "Factura de agua",
    amount: (month, yearOffset) => 315 + (month % 5) * 18 - yearOffset * 8,
  },
  {
    category: "WASTE",
    subcategory: "LANDFILL_UNCONTROLLED",
    activityUnit: "kg",
    normalizedUnit: "kg",
    scope: "Scope 3",
    factorUsed: "LANDFILL_UNCONTROLLED",
    factorValue: 1.25,
    factorUnit: "kgCO₂e/kg",
    factorStatus: "PENDIENTE_VALIDACION_OFICIAL",
    sourceReference: "Manifiesto de disposición",
    amount: (month, yearOffset) => 2_100 + (month % 4) * 160 - yearOffset * 90,
  },
  {
    category: "AI",
    subcategory: "USAGE_REPORTED",
    activityUnit: "solicitudes",
    normalizedUnit: "solicitudes",
    scope: "Uso digital",
    factorUsed: "No aplica",
    factorValue: null,
    factorUnit: "No aplica",
    factorStatus: "INFORMATIVO",
    sourceReference: "Panel del proveedor de IA",
    amount: (month, yearOffset) => 15_000 + (month % 4) * 1_250 - yearOffset * 700,
    digitalUsage: {
      provider: "Proveedor de ejemplo",
      model: "Modelo demostrativo",
      inputTokens: 420_000,
      outputTokens: 96_000,
      reportedEnergyKwh: 8.4,
      reportedWaterM3: 0.12,
      reportedCo2eKg: 3.7,
    },
  },
  {
    category: "INTERNET",
    subcategory: "TRAFFIC_REPORTED",
    activityUnit: "GB",
    normalizedUnit: "GB",
    scope: "Uso digital",
    factorUsed: "No aplica",
    factorValue: null,
    factorUnit: "No aplica",
    factorStatus: "INFORMATIVO",
    sourceReference: "Reporte de conectividad",
    amount: (month, yearOffset) => 82 + (month % 3) * 9 - yearOffset * 4,
    digitalUsage: {
      provider: "Red de ejemplo",
      uploadGb: 24.5,
      downloadGb: 57.5,
      reportedEnergyKwh: 2.1,
      reportedWaterM3: 0.03,
      reportedCo2eKg: 0.9,
    },
  },
];

function ratingForScore(score: number) {
  if (score >= 9) return "Alta";
  if (score >= 7) return "Media-alta";
  if (score >= 5) return "Media";
  if (score >= 3) return "Baja";
  return "Insuficiente";
}

function createDemoRun(year: number, month: number, category: DemoCategory, index: number): CalculationResult {
  const yearOffset = currentYear - year;
  const activityValue = category.amount(month, yearOffset);
  const reportingPeriod = `${year}-${String(month).padStart(2, "0")}`;
  const facilityName = facilities[index % facilities.length];
  const score = 6 + ((month + index) % 5);
  const quality = {
    source: 2 as const,
    measurement: (score >= 8 ? 2 : 1) as 1 | 2,
    temporalRepresentativeness: 1 as const,
    operationalRepresentativeness: 1 as const,
    traceability: (score >= 9 ? 2 : 1) as 1 | 2,
  };
  const input: EnvironmentalInput = {
    tenantId: "demo-company",
    createdByUserId: "demo-user",
    facilityId: index % facilities.length === 0 ? "demo-planta" : "demo-logistica",
    facilityName,
    category: category.category,
    subcategory: category.subcategory,
    activityValue,
    activityUnit: category.activityUnit,
    geography: "Venezuela",
    reportingPeriod,
    sourceType: "FACTURA_COMERCIAL",
    sourceReference: `${category.sourceReference} · ${reportingPeriod}`,
    quality,
    ...(category.category === "AI" ? { digitalProvider: "Proveedor de ejemplo", aiModel: "Modelo demostrativo" } : {}),
    ...(category.category === "INTERNET" ? { digitalProvider: "Red de ejemplo", internetUploadGb: 24.5, internetDownloadGb: 57.5 } : {}),
  };
  const normalizedValue = activityValue;
  const co2eTotalTonnes = category.digitalUsage
    ? null
    : normalizedValue * (category.factorValue ?? 0) / 1_000;
  const recommendations = category.category === "ELECTRICITY" && month === 4
    ? [{
        id: "demo-energy-efficiency",
        category: "ELECTRICITY",
        probableCause: "Consumo eléctrico sostenido en la instalación.",
        opportunity: "Revisar horarios de operación y equipos de mayor demanda.",
        action: "Programar una revisión de eficiencia energética",
        investment: "Inversión baja",
        timeframe: "0–90 días",
        priority: "ALTA",
        venezuelaAvailability: "Disponible localmente",
        paybackMonths: 8,
      }]
    : category.category === "WASTE" && month === 7
      ? [{
          id: "demo-waste-separation",
          category: "WASTE",
          probableCause: "Una parte de los residuos tiene potencial de aprovechamiento.",
          opportunity: "Separar materiales reciclables desde el punto de generación.",
          action: "Implementar segregación de residuos en origen",
          investment: "Inversión baja",
          timeframe: "0–90 días",
          priority: "MEDIA",
          venezuelaAvailability: "Coordinar con gestores autorizados",
          paybackMonths: null,
        }]
      : [];

  return {
    calculationId: `DEMO-${year}-${String(month).padStart(2, "0")}-${category.category}`,
    createdByUserId: "demo-user",
    category: category.category,
    scope: category.scope,
    activityValue,
    activityUnit: category.activityUnit,
    normalizedValue,
    normalizedUnit: category.normalizedUnit,
    geography: "Venezuela",
    reportingPeriod,
    metricValue: co2eTotalTonnes === null ? activityValue : co2eTotalTonnes * 1_000,
    metricUnit: category.digitalUsage ? category.activityUnit : "kgCO₂e",
    co2eTotalTonnes,
    factorUsed: category.factorUsed,
    factorValue: category.factorValue,
    factorUnit: category.factorUnit,
    factorStatus: category.factorStatus,
    sourceReference: `${category.sourceReference} · ${reportingPeriod}`,
    fallbackApplied: false,
    uncertaintyPct: category.factorValue === null ? 0 : 8,
    dataQualityScore: score,
    dataQualityRating: ratingForScore(score),
    dataQualityTier: score >= 9 ? "Tier 1" : score >= 7 ? "Tier 2" : "Tier 3",
    thresholdStatus: "NORMAL",
    warnings: [],
    validation: [],
    breakdown: co2eTotalTonnes === null ? {} : { CO2: co2eTotalTonnes * 1_000 },
    ...(category.digitalUsage ? { digitalUsage: category.digitalUsage } : {}),
    snapshot: {
      activity: input,
      factorSourceReference: category.sourceReference,
      engineVersion: "1.0.0-demo",
      methodology: "GHG Protocol / IPCC AR6 · datos de ejemplo",
      recommendations,
    },
    createdAt: `${reportingPeriod}-28T12:00:00.000Z`,
  };
}

export const demoIdentity: AuthIdentity = {
  id: "demo-user",
  email: "demo@klimatka.example",
  firstName: "Camila",
  lastName: "Bienestar",
  jobTitle: "Administración",
  role: "admin",
  isPlatformAdmin: false,
  company: {
    id: "demo-company",
    name: "Empresa Demostrativa, C.A.",
    rif: "J-00000000-0",
    email: "contacto@empresa-demo.example",
    employeeCount: 148,
    role: "admin",
  },
  companies: [],
};

export const demoRuns: CalculationResult[] = [
  ...[currentYear - 1, currentYear].flatMap((year) =>
    Array.from({ length: 12 }, (_, monthIndex) =>
      categories.map((category, categoryIndex) =>
        createDemoRun(year, monthIndex + 1, category, monthIndex + categoryIndex),
      ),
    ).flat(),
  ),
].sort((left, right) => right.reportingPeriod.localeCompare(left.reportingPeriod));

export const demoOverview: EnvironmentalOverview = {
  totals: {
    co2eTonnes: demoRuns
      .filter((run) => run.reportingPeriod.startsWith(String(currentYear)) && run.co2eTotalTonnes !== null)
      .reduce((sum, run) => sum + (run.co2eTotalTonnes ?? 0), 0),
    co2eRunCount: demoRuns.filter((run) => run.co2eTotalTonnes !== null).length,
    electricityKwh: demoRuns
      .filter((run) => run.category === "ELECTRICITY")
      .reduce((sum, run) => sum + run.normalizedValue, 0),
    waterM3: demoRuns
      .filter((run) => run.category === "WATER")
      .reduce((sum, run) => sum + run.normalizedValue, 0),
    wasteTonnes: demoRuns
      .filter((run) => run.category === "WASTE")
      .reduce((sum, run) => sum + run.normalizedValue, 0) / 1_000,
    runCount: demoRuns.length,
  },
  monthlyEmissions: Array.from({ length: 12 }, (_, monthIndex) => {
    const period = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    return {
      period,
      tonnes: demoRuns
        .filter((run) => run.reportingPeriod === period && run.co2eTotalTonnes !== null)
        .reduce((sum, run) => sum + (run.co2eTotalTonnes ?? 0), 0),
    };
  }),
  availablePeriods: [`${currentYear}-01`, `${currentYear}-12`],
  availableYears: [String(currentYear), String(currentYear - 1)],
  recentRuns: demoRuns.slice(0, 6),
  library: {
    tableCount: 24,
    factorCount: 48,
    sourceCount: 12,
    pendingNationalCount: 2,
    validationRuleCount: 22,
  },
  pendingFactors: [
    {
      code: "GRID_VE_2024",
      name: "Electricidad de red · Venezuela",
      status: "PENDIENTE_VALIDACION_OFICIAL",
      value: 0.485,
      unit: "kgCO₂e/kWh",
    },
  ],
};

export function getDemoRuns(year: string, month?: string) {
  return demoRuns.filter((run) =>
    run.reportingPeriod.startsWith(`${year}-`) && (!month || run.reportingPeriod.endsWith(`-${month}`)),
  );
}

export function getDemoHeadcounts(year: string, month?: string): FacilityHeadcount[] {
  return Array.from({ length: 12 }, (_, monthIndex) => monthIndex + 1)
    .filter((monthNumber) => !month || String(monthNumber).padStart(2, "0") === month)
    .flatMap((monthNumber) => {
      const reportingPeriod = `${year}-${String(monthNumber).padStart(2, "0")}`;
      return facilities.map((facilityName, index) => ({
        facilityId: index === 0 ? "demo-planta" : "demo-logistica",
        facilityName,
        reportingPeriod,
        employeeCount: index === 0 ? 96 : 52,
      }));
    });
}
