BEGIN;

-- ---------------------------------------------------------------------------
-- Environment engine data model (static libraries, measurement modules,
-- calculation runs, headcounts, audit history).
-- Depends on 202606110001_auth_companies.sql (public.companies,
-- public.is_company_member, public.is_company_admin). Does not alter it.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Static factor / reference libraries
-- ===========================================================================

CREATE TABLE public.source_library (
    source_id text PRIMARY KEY,
    source_title text NOT NULL,
    author_org text NOT NULL,
    publication_year integer NOT NULL,
    doi_or_url text,
    reliability_tier text NOT NULL
);

CREATE TABLE public.gwp_library (
    gwp_id text PRIMARY KEY,
    gas_name text NOT NULL,
    chemical_formula text NOT NULL,
    context text NOT NULL,
    gwp_ar4 double precision,
    gwp_ar5 double precision,
    gwp_ar6 double precision,
    source_reference text NOT NULL
);

CREATE TABLE public.unit_library (
    unit_id text PRIMARY KEY,
    unit_code text NOT NULL UNIQUE,
    unit_name text NOT NULL,
    dimension text NOT NULL,
    base_unit text NOT NULL,
    conversion_factor_to_base double precision NOT NULL
);

CREATE TABLE public.conversion_library (
    conversion_id text PRIMARY KEY,
    from_unit text NOT NULL,
    to_unit text NOT NULL,
    multiplier double precision NOT NULL,
    description text NOT NULL
);

CREATE TABLE public.electricity_library (
    elec_id text PRIMARY KEY,
    grid_code text NOT NULL UNIQUE,
    country_region text NOT NULL,
    year integer NOT NULL,
    ef_co2_kg_kwh double precision NOT NULL,
    ef_ch4_g_kwh double precision NOT NULL,
    ef_n2o_g_kwh double precision NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id),
    notes text,
    data_quality_tier text NOT NULL,
    uncertainty_pct double precision NOT NULL,
    -- VAL-002
    CONSTRAINT electricity_library_val_002 CHECK (ef_co2_kg_kwh >= 0 AND ef_co2_kg_kwh <= 3.0)
);

CREATE TABLE public.fuel_library (
    fuel_id text PRIMARY KEY,
    fuel_code text NOT NULL UNIQUE,
    fuel_name text NOT NULL,
    default_unit text NOT NULL,
    density_kg_l double precision,
    ncv_gj_unit double precision,
    co2_factor_kg_unit double precision,
    ch4_factor_g_unit double precision,
    n2o_factor_g_unit double precision,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id),
    -- VAL-003 (NULL density stays allowed, as in the original column)
    CONSTRAINT fuel_library_val_003 CHECK (density_kg_l IS NULL OR (density_kg_l > 0 AND density_kg_l < 2.0))
);

CREATE TABLE public.factor_library (
    factor_id text PRIMARY KEY,
    factor_code text NOT NULL UNIQUE,
    factor_name text NOT NULL,
    category text NOT NULL,
    scope text NOT NULL,
    unit text NOT NULL,
    value_co2e double precision NOT NULL,
    gwp_source text NOT NULL,
    geography text NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id),
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    data_quality_tier text NOT NULL,
    uncertainty_pct double precision NOT NULL
);

CREATE TABLE public.refrigerant_library (
    ref_id text PRIMARY KEY,
    refrigerant_code text NOT NULL,
    chemical_name text NOT NULL,
    gwp_100yr double precision NOT NULL,
    ods_potential double precision NOT NULL,
    safety_group text NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id),
    -- VAL-004
    CONSTRAINT refrigerant_library_val_004 CHECK (gwp_100yr >= 0)
);

CREATE TABLE public.transport_library (
    trans_id text PRIMARY KEY,
    mode_code text NOT NULL,
    mode_name text NOT NULL,
    vehicle_type text NOT NULL,
    fuel_type text NOT NULL,
    load_factor_pct double precision NOT NULL,
    ef_per_tkm_kgco2e double precision NOT NULL,
    ef_per_pkm_kgco2e double precision NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.waste_material (
    waste_mat_id text PRIMARY KEY,
    material_code text NOT NULL,
    material_name text NOT NULL,
    default_density_kg_m3 double precision NOT NULL,
    recyclability_potential text NOT NULL,
    biodegradability text NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.waste_destination (
    dest_id text PRIMARY KEY,
    destination_code text NOT NULL,
    destination_name text NOT NULL,
    ef_kgco2e_per_kg double precision NOT NULL,
    methane_recovery text NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.water_library (
    water_id text PRIMARY KEY,
    process_code text NOT NULL,
    process_name text NOT NULL,
    ef_supply_kgco2e_m3 double precision NOT NULL,
    ef_treatment_kgco2e_m3 double precision NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.material_library (
    mat_id text PRIMARY KEY,
    material_code text NOT NULL,
    material_name text NOT NULL,
    embodied_carbon_kgco2e_kg double precision NOT NULL,
    recycled_content_default_pct double precision NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.packaging_library (
    pkg_id text PRIMARY KEY,
    packaging_code text NOT NULL,
    packaging_name text NOT NULL,
    material_type text NOT NULL,
    avg_weight_g double precision NOT NULL,
    recyclable text NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.air_pollutants (
    pollutant_id text PRIMARY KEY,
    pollutant_code text NOT NULL,
    pollutant_name text NOT NULL,
    cas_number text NOT NULL,
    toxicity_weight_factor double precision NOT NULL,
    status text NOT NULL,
    source_id text REFERENCES public.source_library (source_id)
);

CREATE TABLE public.thresholds (
    threshold_id text PRIMARY KEY,
    parameter_category text NOT NULL,
    metric_name text NOT NULL,
    warning_limit double precision NOT NULL,
    critical_limit double precision NOT NULL,
    unit text NOT NULL,
    action_required text NOT NULL
);

CREATE TABLE public.methodology_version (
    component text PRIMARY KEY,
    standard_reference text NOT NULL,
    version text NOT NULL,
    description text NOT NULL,
    compliance text NOT NULL
);

CREATE TABLE public.validation_rules (
    rule_id text PRIMARY KEY,
    target_table text NOT NULL,
    field_name text NOT NULL,
    rule_type text NOT NULL,
    rule_expression text NOT NULL,
    error_message text NOT NULL
);

CREATE TABLE public.fallback_rules (
    fallback_id text PRIMARY KEY,
    target_category text NOT NULL,
    primary_condition text NOT NULL,
    fallback_action text NOT NULL,
    fallback_value_or_source text NOT NULL,
    justification text NOT NULL
);

CREATE TABLE public.engine_formulas (
    module_id text PRIMARY KEY,
    module_name text NOT NULL,
    scope_category text NOT NULL,
    input_variables text NOT NULL,
    formula_expression text NOT NULL,
    output_metric text NOT NULL,
    governing_standard text NOT NULL
);

CREATE TABLE public.data_quality_matrix (
    tier_level text PRIMARY KEY,
    precision_score integer NOT NULL,
    completeness_score integer NOT NULL,
    temporal_score integer NOT NULL,
    geographical_score integer NOT NULL,
    overall_dqi_rating text NOT NULL,
    description text NOT NULL
);

CREATE TABLE public.recommendation_engine (
    rec_id text PRIMARY KEY,
    domain_category text NOT NULL,
    finding_trigger text NOT NULL,
    probable_cause text NOT NULL,
    opportunity text NOT NULL,
    recommended_action text NOT NULL,
    indicative_investment text NOT NULL,
    timeframe text NOT NULL,
    priority text NOT NULL,
    venezuela_availability text NOT NULL,
    payback_months double precision
);

CREATE TABLE public.reporting_roadmap (
    phase_code text PRIMARY KEY,
    phase_name text NOT NULL,
    time_horizon text NOT NULL,
    core_objectives text NOT NULL,
    key_milestones text NOT NULL,
    deliverable_output text NOT NULL
);

-- ===========================================================================
-- 2. Measurement modules (mutable header) and immutable versions
-- ===========================================================================

CREATE TABLE public.measurement_modules (
    module_id text PRIMARY KEY,
    module_code text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    unit text NOT NULL,
    metric_name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Original: module_code TEXT NOT NULL UNIQUE COLLATE NOCASE
CREATE UNIQUE INDEX measurement_modules_module_code_key
    ON public.measurement_modules (lower(module_code));

CREATE TABLE public.measurement_module_versions (
    version_id text PRIMARY KEY,
    module_id text NOT NULL REFERENCES public.measurement_modules (module_id) ON DELETE RESTRICT,
    version integer NOT NULL CHECK (version >= 1),
    name text NOT NULL,
    description text NOT NULL,
    unit text NOT NULL,
    metric_name text NOT NULL,
    factor_value double precision,
    factor_unit text NOT NULL,
    source_reference text NOT NULL,
    status text NOT NULL CHECK (status IN ('VIGENTE', 'PENDIENTE_VALIDACION_OFICIAL')),
    valid_from date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (module_id, version),
    -- Engine rule: a parameter with a factor requires a documentary source.
    CONSTRAINT measurement_module_versions_factor_source
        CHECK (factor_value IS NULL OR btrim(source_reference) <> '')
);

CREATE INDEX measurement_module_versions_lookup_idx
    ON public.measurement_module_versions (module_id, valid_from DESC, version DESC);

-- ===========================================================================
-- 3. Tenant data: calculation runs, headcounts, audit history
-- ===========================================================================

CREATE TABLE public.calculation_runs (
    calculation_id text PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
    facility_id text NOT NULL,
    facility_name text NOT NULL,
    category text NOT NULL,
    subcategory text NOT NULL,
    scope text NOT NULL,
    activity_value double precision NOT NULL,
    activity_unit text NOT NULL,
    normalized_value double precision NOT NULL,
    normalized_unit text NOT NULL,
    geography text NOT NULL,
    reporting_period text NOT NULL CHECK (reporting_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    metric_value double precision NOT NULL,
    metric_unit text NOT NULL,
    co2e_total_tonnes double precision,
    factor_used text NOT NULL,
    factor_value double precision,
    factor_unit text NOT NULL,
    factor_status text NOT NULL,
    source_reference text NOT NULL,
    fallback_applied boolean NOT NULL,
    uncertainty_pct double precision NOT NULL,
    data_quality_score integer NOT NULL,
    data_quality_rating text NOT NULL,
    data_quality_tier text NOT NULL,
    threshold_status text NOT NULL,
    warnings_json jsonb NOT NULL,
    validation_json jsonb NOT NULL,
    breakdown_json jsonb NOT NULL,
    snapshot_json jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_by_role text NOT NULL DEFAULT 'admin' CHECK (created_by_role IN ('admin', 'member')),
    UNIQUE (tenant_id, facility_id, category, reporting_period, source_reference)
);

CREATE INDEX calculation_runs_tenant_period_idx
    ON public.calculation_runs (tenant_id, reporting_period DESC, created_at DESC);

CREATE TABLE public.facility_headcounts (
    tenant_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
    facility_id text NOT NULL,
    facility_name text NOT NULL,
    reporting_period text NOT NULL CHECK (reporting_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    employee_count integer NOT NULL CHECK (employee_count > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, facility_id, reporting_period)
);

-- No foreign key to calculation_runs: a recalculation deletes and re-inserts the
-- run under the same calculation_id, and audit rows must outlive both.
-- tenant_id is NOT NULL here (nullable in the legacy SQLite table only because it
-- was added by ALTER TABLE; every writer supplies it).
CREATE TABLE public.calculation_run_audit (
    audit_id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    calculation_id text NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
    action text NOT NULL CHECK (action IN ('EDIT', 'DELETE')),
    changed_at timestamptz NOT NULL DEFAULT now(),
    previous_record_json jsonb NOT NULL CHECK (jsonb_typeof(previous_record_json) = 'object')
);

CREATE INDEX calculation_run_audit_lookup_idx
    ON public.calculation_run_audit (tenant_id, calculation_id, changed_at DESC);

-- ===========================================================================
-- 4. Seed data (exact rows from server/environment-data.ts)
-- ===========================================================================

INSERT INTO public.source_library (source_id, source_title, author_org, publication_year, doi_or_url, reliability_tier) VALUES
    ('SRC-001', 'Estimación Interna Preliminar Venezuela', 'SW Environmental Engineering', 2026, 'Internal Registry', 'TIER_3_ESTIMATE'),
    ('SRC-002', 'EPA eGRID 2023 Summary Tables', 'US EPA', 2024, 'https://www.epa.gov/egrid', 'TIER_1_OFFICIAL'),
    ('SRC-003', 'DEFRA Greenhouse Gas Reporting: Conversion Factors 2024', 'UK Government (DESNZ)', 2024, 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'TIER_1_OFFICIAL'),
    ('SRC-004', 'IPCC Sixth Assessment Report (AR6) - Chapter 7', 'IPCC', 2021, 'https://www.ipcc.ch/assessment-report/ar6/', 'TIER_1_OFFICIAL'),
    ('SRC-005', 'Factor de Emisión del Sistema Interconectado Nacional de Colombia', 'UPME', 2023, 'https://www.upme.gov.co', 'TIER_1_OFFICIAL'),
    ('SRC-006', 'Directrices para los Inventarios Nacionales de Gases de Efecto Invernadero - Vol. 5 Residuos', 'IPCC', 2006, 'https://www.ipcc-nggip.iges.or.jp', 'TIER_1_OFFICIAL'),
    ('SRC-007', 'World Steel Association Life Cycle Inventory Data', 'World Steel', 2023, 'https://worldsteel.org', 'TIER_1_OFFICIAL'),
    ('SRC-008', 'Ecoinvent Database v3.9', 'Ecoinvent Association', 2023, 'https://ecoinvent.org', 'TIER_1_OFFICIAL'),
    ('SRC-009', 'EMEP/EEA air pollutant emission inventory guidebook 2023', 'EEA', 2023, 'https://www.eea.europa.eu', 'TIER_1_OFFICIAL');

INSERT INTO public.gwp_library (gwp_id, gas_name, chemical_formula, context, gwp_ar4, gwp_ar5, gwp_ar6, source_reference) VALUES
    ('GWP-001', 'Dióxido de carbono', 'CO2', 'Referencia', 1, 1, 1, 'IPCC AR6 Table 7.SM.7'),
    ('GWP-002', 'Metano', 'CH4', 'Combustión y biogénico', 25, 28, 27, 'IPCC AR6; Factor Library'),
    ('GWP-003', 'Metano', 'CH4', 'Fugitivo fósil / proceso', NULL, NULL, 29.8, 'IPCC AR6; Factor Library'),
    ('GWP-004', 'Óxido nitroso', 'N2O', 'Referencia', 298, 265, 273, 'IPCC AR6 Table 7.SM.7'),
    ('GWP-005', 'HFC-134a', 'CH2FCF3', 'Refrigerante', 1430, 1300, 1530, 'IPCC AR6 Table 7.SM.7'),
    ('GWP-006', 'R-410A', 'Blend', 'Refrigerante', 2088, 1924, 2256, 'IPCC AR6 Table 7.SM.7');

INSERT INTO public.unit_library (unit_id, unit_code, unit_name, dimension, base_unit, conversion_factor_to_base) VALUES
    ('UN-001', 'kg', 'Kilogramo', 'Masa', 'kg', 1),
    ('UN-002', 't', 'Tonelada métrica', 'Masa', 'kg', 1000),
    ('UN-003', 'g', 'Gramo', 'Masa', 'kg', 0.001),
    ('UN-004', 'kWh', 'Kilovatio-hora', 'Energía', 'kWh', 1),
    ('UN-005', 'MWh', 'Megavatio-hora', 'Energía', 'kWh', 1000),
    ('UN-006', 'liter', 'Litro', 'Volumen', 'liter', 1),
    ('UN-007', 'm3', 'Metro cúbico', 'Volumen', 'liter', 1000),
    ('UN-008', 'km', 'Kilómetro', 'Distancia', 'km', 1),
    ('UN-009', 'tkm', 'Tonelada-kilómetro', 'Transporte', 'tkm', 1),
    ('UN-010', 'unit', 'Unidad', 'Conteo', 'unit', 1),
    ('UN-011', 'Wh', 'Vatio-hora', 'Energía', 'kWh', 0.001),
    ('UN-012', 'GJ', 'Gigajulio', 'Energía', 'kWh', 277.7777778),
    ('UN-013', 'MJ', 'Megajulio', 'Energía', 'kWh', 0.277777778),
    ('UN-014', 'gal US', 'Galón estadounidense', 'Volumen', 'liter', 3.785411784);

INSERT INTO public.conversion_library (conversion_id, from_unit, to_unit, multiplier, description) VALUES
    ('CNV-001', 't', 'kg', 1000, 'Conversión de toneladas a kilogramos'),
    ('CNV-002', 'MWh', 'kWh', 1000, 'Conversión de MWh a kWh'),
    ('CNV-003', 'm3', 'liter', 1000, 'Conversión de metros cúbicos a litros'),
    ('CNV-004', 'g', 'kg', 0.001, 'Conversión de gramos a kilogramos'),
    ('CNV-005', 'Wh', 'kWh', 0.001, 'Conversión de Wh a kWh'),
    ('CNV-006', 'GJ', 'kWh', 277.7777778, 'Conversión de GJ a kWh'),
    ('CNV-007', 'MJ', 'kWh', 0.277777778, 'Conversión de MJ a kWh'),
    ('CNV-008', 'gal US', 'liter', 3.785411784, 'Conversión de galón estadounidense a litros');

INSERT INTO public.electricity_library (elec_id, grid_code, country_region, year, ef_co2_kg_kwh, ef_ch4_g_kwh, ef_n2o_g_kwh, status, source_id, notes, data_quality_tier, uncertainty_pct) VALUES
    ('ELC-001', 'VE_INTERCONECTADA', 'Venezuela (Nacional)', 2024, 0.485, 0.012, 0.002, 'PENDIENTE_VALIDACION_OFICIAL', 'SRC-001', 'Estimación preliminar sujeta a revisión oficial por ausencia de inventario público actualizado.', 'Tier 3', 20),
    ('ELC-002', 'US_CAMX', 'Estados Unidos (CAMX)', 2023, 0.000295, 0.00001, 0.000002, 'VIGENTE', 'SRC-002', 'EPA eGrid subregion CAMX factor.', 'Tier 1', 5),
    ('ELC-003', 'CO_NATIONAL', 'Colombia (Nacional)', 2023, 0.165, 0.004, 0.001, 'VIGENTE', 'SRC-005', 'UPME factor oficial Colombia.', 'Tier 1', 5);

INSERT INTO public.fuel_library (fuel_id, fuel_code, fuel_name, default_unit, density_kg_l, ncv_gj_unit, co2_factor_kg_unit, ch4_factor_g_unit, n2o_factor_g_unit, status, source_id) VALUES
    ('FUE-001', 'DIESEL_GENERIC', 'Gasóleo / Diésel Automotriz', 'liter', 0.84, 0.043, 2.6878, 0.23, 0.004, 'VIGENTE', 'SRC-003'),
    ('FUE-002', 'GASOLINE_GENERIC', 'Gasolina Automotriz Regular', 'liter', 0.745, 0.0342, 2.315, 0.38, 0.008, 'VIGENTE', 'SRC-003'),
    ('FUE-003', 'NATGAS_INDUSTRIAL', 'Gas Natural Industrial', 'm3', 0.75, 0.038, 1.912, 0.05, 0.0001, 'VIGENTE', 'SRC-003'),
    ('FUE-004', 'FO_HEAVY', 'Fuel Oil #6 (Bunker)', 'liter', 0.98, 0.0404, 3.114, 0.12, 0.005, 'VIGENTE', 'SRC-003');

INSERT INTO public.factor_library (factor_id, factor_code, factor_name, category, scope, unit, value_co2e, gwp_source, geography, status, source_id, valid_from, valid_to, data_quality_tier, uncertainty_pct) VALUES
    ('FAC-001', 'GRID_VE_2024', 'Electricidad Red Interconectada Nacional (VE)', 'ELECTRICITY', 'Scope 2', 'kWh', 0.485, 'IPCC AR6 (100-yr)', 'VE', 'PENDIENTE_VALIDACION_OFICIAL', 'SRC-001', '2024-01-01', '2026-12-31', 'Tier 3', 25),
    ('FAC-002', 'GRID_US_CAMX_2023', 'Electricity CAMX subregion (US)', 'ELECTRICITY', 'Scope 2', 'kWh', 0.000295, 'IPCC AR6 (100-yr)', 'US-CAMX', 'VIGENTE', 'SRC-002', '2023-01-01', '2026-12-31', 'Tier 1', 5),
    ('FAC-003', 'DIESEL_STATIONARY_DEFRA', 'Gasóleo / Diesel Estacionario (DEFRA)', 'FUEL', 'Scope 1', 'liter', 2.6878, 'IPCC AR6 (100-yr)', 'UK/Global', 'VIGENTE', 'SRC-003', '2024-01-01', '2026-12-31', 'Tier 1', 5),
    ('FAC-004', 'GASOLINE_VE_EST', 'Gasolina Automotriz (Estimación Base VE)', 'FUEL', 'Scope 1', 'liter', 2.315, 'IPCC AR6 (100-yr)', 'VE', 'PENDIENTE_VALIDACION_OFICIAL', 'SRC-001', '2024-01-01', '2026-12-31', 'Tier 1', 5),
    ('FAC-005', 'R134A_GWP', 'Refrigerante R-134a', 'REFRIGERANT', 'Scope 1', 'kg', 1430, 'IPCC AR6 (100-yr)', 'Global', 'VIGENTE', 'SRC-004', '2021-01-01', '2030-12-31', 'Tier 1', 5);

INSERT INTO public.refrigerant_library (ref_id, refrigerant_code, chemical_name, gwp_100yr, ods_potential, safety_group, status, source_id) VALUES
    ('REF-001', 'R-134a', '1,1,1,2-Tetrafluoroethane', 1430, 0, 'A1', 'VIGENTE', 'SRC-004'),
    ('REF-002', 'R-410A', 'Blend (R-32 / R-125)', 2088, 0, 'A1', 'VIGENTE', 'SRC-004'),
    ('REF-003', 'R-717', 'Amoniaco Anhidro', 0, 0, 'B2L', 'VIGENTE', 'SRC-004'),
    ('REF-004', 'R-404A', 'Blend (R-125 / R-143a / R-134a)', 3922, 0, 'A1', 'VIGENTE', 'SRC-004'),
    ('REF-005', 'R-22', 'Chlorodifluoromethane (HCFC)', 1810, 0.055, 'A1', 'OBSOLETO_MONTREAL', 'SRC-004');

INSERT INTO public.transport_library (trans_id, mode_code, mode_name, vehicle_type, fuel_type, load_factor_pct, ef_per_tkm_kgco2e, ef_per_pkm_kgco2e, status, source_id) VALUES
    ('TRN-001', 'ROAD_HDT_DIESEL', 'Camión Pesado (>32t)', 'Heavy Duty Truck', 'Diesel', 50, 0.0685, 0, 'VIGENTE', 'SRC-003'),
    ('TRN-002', 'ROAD_MDT_DIESEL', 'Camión Mediano (3.5t-7.5t)', 'Medium Duty', 'Diesel', 50, 0.215, 0, 'VIGENTE', 'SRC-003'),
    ('TRN-003', 'AIR_DOM_MKT', 'Avión Comercial (Doméstico)', 'Aircraft', 'Jet Kerosene', 80, 0, 0.185, 'VIGENTE', 'SRC-003'),
    ('TRN-004', 'SEA_CONTAINER', 'Buque Portacontenedores', 'Cargo Ship', 'Fuel Oil', 70, 0.015, 0, 'VIGENTE', 'SRC-003');

INSERT INTO public.waste_material (waste_mat_id, material_code, material_name, default_density_kg_m3, recyclability_potential, biodegradability, status, source_id) VALUES
    ('WST-001', 'MSW_ORGANIC', 'Residuo Orgánico / Compostable', 500, 'ALTO', 'ALTA', 'VIGENTE', 'SRC-006'),
    ('WST-002', 'MSW_PLASTIC_PET', 'Plástico PET Post-Consumo', 100, 'ALTO', 'NULA', 'VIGENTE', 'SRC-006'),
    ('WST-003', 'MSW_PAPER_CARD', 'Papel y Cartón', 150, 'ALTO', 'MEDIA', 'VIGENTE', 'SRC-006'),
    ('WST-004', 'HAZ_OIL_SLUDGE', 'Lodos Oleosos Industriales', 950, 'BAJO', 'NULA', 'VIGENTE', 'SRC-006');

INSERT INTO public.waste_destination (dest_id, destination_code, destination_name, ef_kgco2e_per_kg, methane_recovery, status, source_id) VALUES
    ('DST-001', 'LANDFILL_UNCONTROLLED', 'Vertedero a Cielo Abierto (Típico VE)', 1.25, 'NO', 'PENDIENTE_VALIDACION_OFICIAL', 'SRC-001'),
    ('DST-002', 'LANDFILL_CONTROLLED_FLARE', 'Vertedero Controlado con Quema de Biogás', 0.58, 'SI', 'VIGENTE', 'SRC-003'),
    ('DST-003', 'RECYCLING', 'Reciclaje / Aprovechamiento Material', -0.45, 'NO', 'VIGENTE', 'SRC-003'),
    ('DST-004', 'COMPOSTING', 'Compostaje Aeróbico', 0.05, 'NO', 'VIGENTE', 'SRC-003'),
    ('DST-005', 'INCINERATION', 'Incineración sin Recuperación de Energía', 0.95, 'NO', 'VIGENTE', 'SRC-003');

INSERT INTO public.water_library (water_id, process_code, process_name, ef_supply_kgco2e_m3, ef_treatment_kgco2e_m3, status, source_id) VALUES
    ('WTR-001', 'MUNICIPAL_SUPPLY', 'Suministro Agua Potable Municipal', 0.344, 0, 'VIGENTE', 'SRC-003'),
    ('WTR-002', 'WW_TREATMENT_CENTRAL', 'Tratamiento de Aguas Residuales Centralizado', 0, 0.708, 'VIGENTE', 'SRC-003'),
    ('WTR-003', 'DESALINATION_RO', 'Desalación por Osmosis Inversa', 3.2, 0, 'VIGENTE', 'SRC-003');

INSERT INTO public.material_library (mat_id, material_code, material_name, embodied_carbon_kgco2e_kg, recycled_content_default_pct, status, source_id) VALUES
    ('MAT-001', 'STEEL_PRIMARY', 'Acero Virgen (BOF)', 2.3, 5, 'VIGENTE', 'SRC-007'),
    ('MAT-002', 'STEEL_RECYCLED', 'Acero Reciclado (EAF)', 0.6, 90, 'VIGENTE', 'SRC-007'),
    ('MAT-003', 'ALUMINUM_PRIMARY', 'Aluminio Primario', 16.5, 10, 'VIGENTE', 'SRC-007'),
    ('MAT-004', 'CEMENT_OPC', 'Cemento Portland Ordinario', 0.85, 0, 'VIGENTE', 'SRC-007'),
    ('MAT-005', 'CONCRETE_25MPA', 'Concreto 25 MPa', 0.13, 0, 'VIGENTE', 'SRC-007');

INSERT INTO public.packaging_library (pkg_id, packaging_code, packaging_name, material_type, avg_weight_g, recyclable, status, source_id) VALUES
    ('PKG-001', 'PET_BOTTLE_500ML', 'Botella PET 500ml', 'PET', 18.5, 'SI', 'VIGENTE', 'SRC-008'),
    ('PKG-002', 'HDPE_JUG_5L', 'Envase HDPE 5 Litros', 'HDPE', 145, 'SI', 'VIGENTE', 'SRC-008'),
    ('PKG-003', 'CORRUGATED_BOX_MED', 'Caja de Cartón Corrugado Mediana', 'Papel/Cartón', 320, 'SI', 'VIGENTE', 'SRC-008'),
    ('PKG-004', 'LDPE_FILM_WRAP', 'Película Stretch LDPE', 'LDPE', 45, 'SI', 'VIGENTE', 'SRC-008');

INSERT INTO public.air_pollutants (pollutant_id, pollutant_code, pollutant_name, cas_number, toxicity_weight_factor, status, source_id) VALUES
    ('POL-001', 'SO2', 'Dióxido de Azufre', '7446-09-5', 1, 'VIGENTE', 'SRC-009'),
    ('POL-002', 'NOX', 'Óxidos de Nitrógeno', '11104-93-1', 1, 'VIGENTE', 'SRC-009'),
    ('POL-003', 'PM10', 'Material Particulado PM10', 'N/A', 1.5, 'VIGENTE', 'SRC-009'),
    ('POL-004', 'VOC', 'Compuestos Orgánicos Volátiles', 'N/A', 1.2, 'VIGENTE', 'SRC-009'),
    ('POL-005', 'CO', 'Monóxido de Carbono', '630-08-0', 0.5, 'VIGENTE', 'SRC-009');

INSERT INTO public.thresholds (threshold_id, parameter_category, metric_name, warning_limit, critical_limit, unit, action_required) VALUES
    ('THR-001', 'ELECTRICITY', 'Consumo energético mensual', 50000, 100000, 'kWh', 'Auditoría energética obligatoria'),
    ('THR-002', 'EMISSIONS', 'Emisiones Scope 1 mensuales', 100, 500, 'tCO2e', 'Reporte a gerencia ambiental'),
    ('THR-003', 'WATER', 'Consumo de agua industrial', 2000, 5000, 'm3', 'Revisión de fugas y sistemas de recirculación'),
    ('THR-004', 'WASTE', 'Generación de residuos peligrosos', 5, 20, 't', 'Verificación de manifiesto de disposición final');

INSERT INTO public.methodology_version (component, standard_reference, version, description, compliance) VALUES
    ('GHG Protocol Corporate Standard', 'WBCSD / WRI', 'Revised Edition', 'Estándar corporativo de contabilidad y reporte de GEI', 'COMPLIANT'),
    ('ISO 14064-1', 'ISO', '2018', 'Especificación para cuantificación e informe organizacional de GEI', 'COMPLIANT'),
    ('ISO 14040 / 14044', 'ISO', '2006 / Amendment 2020', 'Gestión ambiental — Análisis de ciclo de vida', 'COMPLIANT'),
    ('IPCC AR6 Methodology', 'IPCC', '2021', 'Potenciales de calentamiento global a 100 años', 'COMPLIANT');

INSERT INTO public.validation_rules (rule_id, target_table, field_name, rule_type, rule_expression, error_message) VALUES
    ('VD-001', 'ACTIVITY', 'activity_unit', 'EXISTS', 'unit_code exists in UNIT_LIBRARY', 'La unidad debe existir en la biblioteca.'),
    ('VD-002', 'ACTIVITY', 'reporting_period', 'PERIOD', 'YYYY-MM; start <= end', 'El período informado no es válido.'),
    ('VD-003', 'ACTIVITY', 'activity_value', 'RANGE', 'value >= 0 and finite', 'La magnitud debe ser un número finito no negativo.'),
    ('VD-004', 'ACTIVITY', 'activity_unit', 'DIMENSION', 'unit dimension matches category', 'La unidad no corresponde a la variable.'),
    ('VD-005', 'ACTIVITY', 'source_reference', 'REQUIRED', 'source reference is present', 'Todo dato debe incluir fuente.'),
    ('VD-006', 'ACTIVITY', 'quality', 'REQUIRED', 'all five DQ dimensions are present', 'Debe asignarse calidad al dato.'),
    ('VD-007', 'CALCULATION', 'factor_id', 'REQUIRED', 'factor snapshot is present', 'El cálculo debe identificar su factor.'),
    ('VD-008', 'ACTIVITY', 'geography', 'MATCH', 'factor applies to geography', 'El factor no corresponde a la geografía seleccionada.'),
    ('VD-009', 'FACTOR', 'year', 'REQUIRED', 'reference year is present', 'El factor debe tener año de referencia.'),
    ('VD-010', 'FACTOR', 'valid_from', 'PERIOD', 'factor valid for reporting period', 'El factor no es vigente para el período.'),
    ('VD-011', 'ACTIVITY', 'source_reference', 'DUPLICATE', 'source/category/facility/period is unique', 'Esta fuente ya fue contabilizada en el período.'),
    ('VD-012', 'ACTIVITY', 'facility_id', 'REQUIRED', 'facility boundary is identified', 'Debe identificarse la instalación del perímetro.'),
    ('VD-013', 'ACTIVITY', 'reporting_period', 'COMPLETENESS', 'missing periods are identified', 'El período presenta información incompleta.'),
    ('VD-014', 'ACTIVITY', 'source_type', 'ESTIMATE', 'estimates are explicitly labeled', 'El dato estimado debe quedar marcado como tal.'),
    ('VD-015', 'CALCULATION', 'conversion_factor', 'TRACE', 'normalization factor is retained', 'Debe conservarse el factor de conversión.'),
    ('VAL-001', 'FACTOR_LIBRARY', 'value_co2e', 'RANGE', 'value_co2e >= 0 except documented credits', 'El factor de emisión CO2e no puede ser negativo salvo créditos documentados.'),
    ('VAL-002', 'ELECTRICITY_LIBRARY', 'ef_co2_kg_kwh', 'RANGE', '0 <= ef_co2_kg_kwh <= 3.0', 'Factor de electricidad fuera de rango técnico realista.'),
    ('VAL-003', 'FUEL_LIBRARY', 'density_kg_l', 'RANGE', '0 < density_kg_l < 2.0', 'Densidad de combustible inválida.'),
    ('VAL-004', 'REFRIGERANT_LIBRARY', 'gwp_100yr', 'RANGE', 'gwp_100yr >= 0', 'El GWP no puede ser negativo.');

INSERT INTO public.fallback_rules (fallback_id, target_category, primary_condition, fallback_action, fallback_value_or_source, justification) VALUES
    ('FBK-001', 'ELECTRICITY', 'Country factor unavailable or PENDIENTE_VALIDACION_OFICIAL', 'USAR_GLOBAL_DEFAULT', 'IPCC_GLOBAL_GRID_AVERAGE_0.45_KG', 'Evita bloqueo del motor ante falta de dato nacional oficial.'),
    ('FBK-002', 'FUEL', 'Fuel density not reported', 'USAR_DEFRA_DEFAULT', 'DEFRA_FUEL_DEFAULT_TABLE', 'Permite estimación volumétrica estándar basada en masa o volumen.'),
    ('FBK-003', 'WASTE', 'Final waste destination unknown', 'ASUMIR_PEOR_CASO', 'DST-001', 'Principio de precaución ambiental y conservadurismo en cálculo de huella.');

INSERT INTO public.engine_formulas (module_id, module_name, scope_category, input_variables, formula_expression, output_metric, governing_standard) VALUES
    ('MOD-001', 'Combustión Fija / Móvil', 'Scope 1', 'activity_value, unit_conversion_factor, co2_ef, ch4_ef, n2o_ef, gwp_ch4, gwp_n2o', 'activity × (CO2 + CH4 × GWP_CH4 / 1000 + N2O × GWP_N2O / 1000) / 1000', 'tCO2e', 'GHG Protocol / IPCC AR6'),
    ('MOD-002', 'Electricidad Comprada', 'Scope 2', 'activity_value_kwh, grid_ef_co2, grid_ef_ch4, grid_ef_n2o, gwp_ch4, gwp_n2o', '(kWh / 1000) × (CO2 + CH4 × GWP_CH4 / 1000 + N2O × GWP_N2O / 1000)', 'tCO2e', 'GHG Protocol Scope 2 Guidance'),
    ('MOD-003', 'Transporte y Logística', 'Scope 3 / Direct', 'distance_or_mass, load_factor, ef_per_tkm_or_pkm', 'activity × factor', 'tCO2e', 'GHG Protocol Scope 3 Guidance'),
    ('MOD-004', 'Gestión de Residuos', 'Scope 3 / Waste', 'waste_mass_kg, destination_ef_kgco2e_kg', '(mass_kg × destination_factor) / 1000', 'tCO2e', 'IPCC Guidelines Vol 5 / ISO 14064'),
    ('MOD-005', 'Consumo de Agua', 'Water Footprint', 'water_volume_m3, supply_ef, treatment_ef', 'volume_m3 × (supply_ef + treatment_ef)', 'kgCO2e', 'ISO 14046'),
    ('MOD-006', 'Circularidad y Materiales', 'LCA / Materials', 'material_mass_kg, embodied_carbon_factor, recycled_content_pct', '(mass_kg × factor × (1 - recycled_pct / 100)) / 1000', 'tCO2e', 'ISO 14040/14044');

INSERT INTO public.data_quality_matrix (tier_level, precision_score, completeness_score, temporal_score, geographical_score, overall_dqi_rating, description) VALUES
    ('Tier 1', 5, 5, 5, 5, 'ALTA', 'Datos primarios medidos o factores oficiales nacionales vigentes.'),
    ('Tier 2', 4, 4, 3, 4, 'MEDIA-ALTA', 'Facturación, estimaciones secundarias o factores regionales proxy.'),
    ('Tier 3', 2, 3, 2, 2, 'PRELIMINAR / ESTIMADO', 'Estimaciones internas o factores globales por ausencia de dato nacional.');

INSERT INTO public.recommendation_engine (rec_id, domain_category, finding_trigger, probable_cause, opportunity, recommended_action, indicative_investment, timeframe, priority, venezuela_availability, payback_months) VALUES
    ('REC-001', 'ELECTRICITY', 'Consumo energético > THR-001', 'Ineficiencia en climatización o iluminación obsoleta.', 'Reducción de costos operativos y huella de Alcance 2.', 'Automatización BMS y sustitución a iluminación LED industrial.', 'Media ($10k - $30k)', '0-90 días', 'ALTA', 'Disponible bajo evaluación local', NULL),
    ('REC-002', 'WASTE', 'Disposición en vertedero a cielo abierto (DST-001)', 'Ausencia de infraestructura formal de reciclaje y separación en origen.', 'Valorización de subproductos y cumplimiento normativo.', 'Segregación en fuente y alianza con gestores certificados.', 'Baja (< $5k)', '3-6 meses', 'MEDIA', 'Requiere validar gestor local', NULL),
    ('REC-003', 'FUEL', 'Emisiones de flota elevadas (Scope 1)', 'Rutas no optimizadas y falta de mantenimiento preventivo.', 'Optimización de combustible y reducción de emisiones.', 'Software de ruteo y telemetría vehicular.', 'Media ($10k - $25k)', '6-12 meses', 'ALTA', 'Disponible bajo evaluación local', NULL),
    ('REC-004', 'WATER', 'Consumo hídrico industrial elevado (WTR-001)', 'Fugas no detectadas y ausencia de recirculación.', 'Disminución de costos por tarifas de suministro y tratamiento.', 'Medidores sectorizados y planta de tratamiento interna.', 'Alta (> $30k)', '12-36 meses', 'MEDIA', 'Requiere validación de proveedores locales', NULL);

INSERT INTO public.reporting_roadmap (phase_code, phase_name, time_horizon, core_objectives, key_milestones, deliverable_output) VALUES
    ('PH-1', 'Línea Base y Diagnóstico Rápido', '0 - 90 días', 'Inventario inicial y cálculo con factores actuales.', 'Validar fuentes; calcular Scope 1 y 2; identificar puntos críticos.', 'Reporte de Línea Base GES e Inventario Inicial de Factores.'),
    ('PH-2', 'Eficiencia Operativa y Quick Wins', '3 - 6 meses', 'Oportunidades de bajo costo y alta rentabilidad.', 'Meta guía: reducción eléctrica 10% y desvío de residuos a reciclaje 30%.', 'Plan de Acción de Mejora Continua y Reducción de Costos.'),
    ('PH-3', 'Optimización Tecnológica y Logística', '6 - 12 meses', 'Automatización, telemetría y modernización de equipos.', 'Optimizar rutas; instalar inversores y variadores de frecuencia.', 'Informe de Sostenibilidad Anual y Auditoría de Procesos.'),
    ('PH-4', 'Circularidad Integral y Neutralidad', '12 - 36 meses', 'Economía circular, materiales bajos en carbono y compensación.', 'Cierre de ciclo y metas de descarbonización.', 'Estrategia Corporativa Hacia Net-Zero y Certificación ISO 14064.');

-- ===========================================================================
-- 5. Trigger functions (immutability and integrity)
-- ===========================================================================

CREATE FUNCTION public.reject_immutable_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    RAISE EXCEPTION '%', TG_ARGV[0] USING ERRCODE = '23001';
    RETURN NULL;
END;
$function$;

-- Calculation runs are never updated in place; they are recalculated through an
-- audited delete + insert. The single exception is the ON DELETE SET NULL action of
-- created_by (auth user removal), which may only clear that one column.
CREATE FUNCTION public.reject_calculation_run_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF OLD.created_by IS NOT NULL
       AND NEW.created_by IS NULL
       AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'calculation runs must be recalculated' USING ERRCODE = '23001';
    RETURN NULL;
END;
$function$;

-- Deleting a run requires an EDIT/DELETE audit record snapshotting that exact run.
CREATE FUNCTION public.require_calculation_run_audit_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.calculation_run_audit AS audit
        WHERE audit.calculation_id = OLD.calculation_id
          AND audit.tenant_id = OLD.tenant_id
          AND audit.action IN ('EDIT', 'DELETE')
          AND jsonb_typeof(audit.previous_record_json -> 'created_at') = 'string'
          AND (audit.previous_record_json ->> 'created_at')::timestamptz = OLD.created_at
    ) THEN
        RAISE EXCEPTION 'calculation run deletion requires an audit record' USING ERRCODE = '23001';
    END IF;
    RETURN OLD;
END;
$function$;

-- An audit row must be a faithful snapshot of the current run it refers to.
CREATE FUNCTION public.validate_calculation_run_audit_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_run jsonb;
    v_prev_created_at timestamptz;
BEGIN
    SELECT to_jsonb(run)
    INTO v_run
    FROM public.calculation_runs AS run
    WHERE run.calculation_id = NEW.calculation_id
      AND run.tenant_id = NEW.tenant_id;

    IF v_run IS NULL THEN
        RAISE EXCEPTION 'audit record must reference an existing calculation run of the same tenant'
            USING ERRCODE = '23514';
    END IF;

    BEGIN
        v_prev_created_at := (NEW.previous_record_json ->> 'created_at')::timestamptz;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'audit snapshot has no valid created_at' USING ERRCODE = '23514';
    END;

    IF v_prev_created_at IS DISTINCT FROM (v_run ->> 'created_at')::timestamptz
       OR (NEW.previous_record_json - 'created_at') IS DISTINCT FROM (v_run - 'created_at') THEN
        RAISE EXCEPTION 'audit snapshot does not match the current calculation run' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE FUNCTION public.touch_facility_headcount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

CREATE FUNCTION public.guard_measurement_module_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF NEW.module_id IS DISTINCT FROM OLD.module_id
       OR NEW.module_code IS DISTINCT FROM OLD.module_code
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'measurement module identity is immutable' USING ERRCODE = '23001';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_immutable_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_calculation_run_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_calculation_run_audit_before_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_calculation_run_audit_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_facility_headcount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_measurement_module_update() FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- 6. Triggers
-- ===========================================================================

-- Immutable history tables: {table, update message, delete message}
DO $do$
DECLARE
    r text[];
BEGIN
    FOREACH r SLICE 1 IN ARRAY ARRAY[
        ['gwp_library', 'methodology history is immutable', 'methodology history is immutable'],
        ['unit_library', 'unit history is immutable', 'unit history is immutable'],
        ['conversion_library', 'conversion history is immutable', 'conversion history is immutable'],
        ['electricity_library', 'factor history is immutable; insert a new version', 'factor history is immutable'],
        ['factor_library', 'factor history is immutable; insert a new version', 'factor history is immutable'],
        ['fuel_library', 'factor history is immutable', 'factor history is immutable'],
        ['waste_destination', 'factor history is immutable', 'factor history is immutable'],
        ['water_library', 'factor history is immutable', 'factor history is immutable'],
        ['material_library', 'factor history is immutable', 'factor history is immutable'],
        ['refrigerant_library', 'factor history is immutable', 'factor history is immutable'],
        ['measurement_module_versions', 'measurement module versions are immutable; insert a new version', 'measurement module versions are immutable'],
        ['calculation_run_audit', 'calculation run history is immutable', 'calculation run history is immutable']
    ]::text[] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_change(%L)',
            r[1] || '_no_update', r[1], r[2]);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_change(%L)',
            r[1] || '_no_delete', r[1], r[3]);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_change(%L)',
            r[1] || '_no_truncate', r[1], r[3]);
    END LOOP;
END
$do$;

CREATE TRIGGER calculation_runs_no_update
    BEFORE UPDATE ON public.calculation_runs
    FOR EACH ROW EXECUTE FUNCTION public.reject_calculation_run_update();

CREATE TRIGGER calculation_runs_delete_requires_audit
    BEFORE DELETE ON public.calculation_runs
    FOR EACH ROW EXECUTE FUNCTION public.require_calculation_run_audit_before_delete();

CREATE TRIGGER calculation_runs_no_truncate
    BEFORE TRUNCATE ON public.calculation_runs
    FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_change('calculation runs must not be truncated');

CREATE TRIGGER calculation_run_audit_validate_insert
    BEFORE INSERT ON public.calculation_run_audit
    FOR EACH ROW EXECUTE FUNCTION public.validate_calculation_run_audit_insert();

CREATE TRIGGER facility_headcounts_touch
    BEFORE INSERT OR UPDATE ON public.facility_headcounts
    FOR EACH ROW EXECUTE FUNCTION public.touch_facility_headcount();

CREATE TRIGGER measurement_modules_guard_identity
    BEFORE UPDATE ON public.measurement_modules
    FOR EACH ROW EXECUTE FUNCTION public.guard_measurement_module_update();

-- ===========================================================================
-- 7. Row level security, grants and policies
-- ===========================================================================

ALTER TABLE public.calculation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_headcounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_run_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.calculation_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.facility_headcounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.calculation_run_audit FROM PUBLIC, anon, authenticated;

-- Static libraries, methodology and measurement modules: read-only for any
-- authenticated user; no client write privileges at all.
DO $do$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'source_library', 'gwp_library', 'unit_library', 'conversion_library',
        'electricity_library', 'fuel_library', 'factor_library', 'refrigerant_library',
        'transport_library', 'waste_material', 'waste_destination', 'water_library',
        'material_library', 'packaging_library', 'air_pollutants', 'thresholds',
        'methodology_version', 'validation_rules', 'fallback_rules', 'engine_formulas',
        'data_quality_matrix', 'recommendation_engine', 'reporting_roadmap',
        'measurement_modules', 'measurement_module_versions'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
            t || '_select_authenticated', t);
    END LOOP;
END
$do$;

-- Tenant records remain read-only until calculation writes are routed through
-- an atomic, server-validated RPC.
GRANT SELECT ON TABLE public.calculation_runs TO authenticated;

CREATE POLICY calculation_runs_select_member
    ON public.calculation_runs
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(tenant_id));

GRANT SELECT ON TABLE public.facility_headcounts TO authenticated;

CREATE POLICY facility_headcounts_select_member
    ON public.facility_headcounts
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(tenant_id));

GRANT SELECT ON TABLE public.calculation_run_audit TO authenticated;

CREATE POLICY calculation_run_audit_select_member
    ON public.calculation_run_audit
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(tenant_id));

COMMIT;
