BEGIN;

CREATE TABLE public.klimatka_environment_write_guard (
    id smallint PRIMARY KEY CHECK (id = 1),
    secret_hash text CHECK (secret_hash IS NULL OR secret_hash ~ '^[0-9a-f]{64}$')
);

INSERT INTO public.klimatka_environment_write_guard (id, secret_hash)
VALUES (1, NULL);

ALTER TABLE public.klimatka_environment_write_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.klimatka_environment_write_guard FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.klimatka_environment_create_run(
    p_secret_hash text,
    p_run jsonb,
    p_employee_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_run public.calculation_runs;
    v_role text;
    v_expected_hash text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT secret_hash INTO v_expected_hash
    FROM public.klimatka_environment_write_guard
    WHERE id = 1;
    IF v_expected_hash IS NULL OR p_secret_hash IS DISTINCT FROM v_expected_hash THEN
        RAISE EXCEPTION 'environment write authorization failed' USING ERRCODE = '42501';
    END IF;

    v_run := jsonb_populate_record(NULL::public.calculation_runs, p_run);
    SELECT membership.role INTO v_role
    FROM public.company_memberships AS membership
    WHERE membership.company_id = v_run.tenant_id
      AND membership.user_id = v_user_id
      AND membership.revoked_at IS NULL;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'active company membership required' USING ERRCODE = '42501';
    END IF;
    IF v_run.created_by IS DISTINCT FROM v_user_id OR v_run.created_by_role IS DISTINCT FROM v_role THEN
        RAISE EXCEPTION 'run author does not match authenticated membership' USING ERRCODE = '42501';
    END IF;
    IF v_role <> 'admin' AND p_employee_count IS NOT NULL THEN
        RAISE EXCEPTION 'company admin required to update headcount' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.calculation_runs SELECT v_run.*;

    IF p_employee_count IS NOT NULL THEN
        INSERT INTO public.facility_headcounts (tenant_id, facility_id, facility_name, reporting_period, employee_count)
        VALUES (v_run.tenant_id, v_run.facility_id, v_run.facility_name, v_run.reporting_period, p_employee_count)
        ON CONFLICT (tenant_id, facility_id, reporting_period)
        DO UPDATE SET facility_name = EXCLUDED.facility_name,
                      employee_count = EXCLUDED.employee_count;
    END IF;

    RETURN to_jsonb(v_run);
END;
$function$;

CREATE FUNCTION public.klimatka_environment_update_run(
    p_secret_hash text,
    p_tenant_id uuid,
    p_calculation_id text,
    p_run jsonb,
    p_employee_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current public.calculation_runs;
    v_run public.calculation_runs;
    v_role text;
    v_expected_hash text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT secret_hash INTO v_expected_hash
    FROM public.klimatka_environment_write_guard
    WHERE id = 1;
    IF v_expected_hash IS NULL OR p_secret_hash IS DISTINCT FROM v_expected_hash THEN
        RAISE EXCEPTION 'environment write authorization failed' USING ERRCODE = '42501';
    END IF;

    SELECT run.* INTO v_current
    FROM public.calculation_runs AS run
    WHERE run.tenant_id = p_tenant_id
      AND run.calculation_id = p_calculation_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculation run not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT membership.role INTO v_role
    FROM public.company_memberships AS membership
    WHERE membership.company_id = p_tenant_id
      AND membership.user_id = v_user_id
      AND membership.revoked_at IS NULL;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'active company membership required' USING ERRCODE = '42501';
    END IF;
    IF v_role = 'member' AND v_current.created_by IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'members may only update their own records' USING ERRCODE = '42501';
    END IF;
    IF v_role <> 'admin' AND p_employee_count IS NOT NULL THEN
        RAISE EXCEPTION 'company admin required to update headcount' USING ERRCODE = '42501';
    END IF;

    v_run := jsonb_populate_record(NULL::public.calculation_runs, p_run);
    v_run.calculation_id := v_current.calculation_id;
    v_run.tenant_id := v_current.tenant_id;
    v_run.created_by := v_current.created_by;
    v_run.created_by_role := v_current.created_by_role;

    INSERT INTO public.calculation_run_audit (calculation_id, tenant_id, action, previous_record_json)
    VALUES (v_current.calculation_id, v_current.tenant_id, 'EDIT', to_jsonb(v_current));
    DELETE FROM public.calculation_runs
    WHERE calculation_id = v_current.calculation_id
      AND tenant_id = v_current.tenant_id;
    INSERT INTO public.calculation_runs SELECT v_run.*;

    IF p_employee_count IS NOT NULL THEN
        INSERT INTO public.facility_headcounts (tenant_id, facility_id, facility_name, reporting_period, employee_count)
        VALUES (v_run.tenant_id, v_run.facility_id, v_run.facility_name, v_run.reporting_period, p_employee_count)
        ON CONFLICT (tenant_id, facility_id, reporting_period)
        DO UPDATE SET facility_name = EXCLUDED.facility_name,
                      employee_count = EXCLUDED.employee_count;
    END IF;

    RETURN to_jsonb(v_run);
END;
$function$;

CREATE FUNCTION public.klimatka_environment_create_module(
    p_secret_hash text,
    p_module jsonb,
    p_version jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_module public.measurement_modules;
    v_version public.measurement_module_versions;
    v_expected_hash text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    SELECT secret_hash INTO v_expected_hash
    FROM public.klimatka_environment_write_guard
    WHERE id = 1;
    IF v_expected_hash IS NULL OR p_secret_hash IS DISTINCT FROM v_expected_hash THEN
        RAISE EXCEPTION 'environment write authorization failed' USING ERRCODE = '42501';
    END IF;

    v_module := jsonb_populate_record(NULL::public.measurement_modules, p_module);
    v_version := jsonb_populate_record(NULL::public.measurement_module_versions, p_version);
    IF btrim(coalesce(v_module.module_id, '')) = '' OR btrim(coalesce(v_module.module_code, '')) = '' THEN
        RAISE EXCEPTION 'module identifier and code are required' USING ERRCODE = '22023';
    END IF;
    IF v_version.version_id IS NULL OR v_version.valid_from IS NULL THEN
        RAISE EXCEPTION 'module version identifier and effective date are required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.measurement_modules (module_id, module_code, name, description, unit, metric_name, active)
    VALUES (v_module.module_id, upper(v_module.module_code), v_module.name, v_module.description, v_module.unit, v_module.metric_name, coalesce(v_module.active, true));
    INSERT INTO public.measurement_module_versions (version_id, module_id, version, name, description, unit, metric_name, factor_value, factor_unit, source_reference, status, valid_from)
    VALUES (v_version.version_id, v_module.module_id, 1, v_version.name, v_version.description, v_version.unit, v_version.metric_name, v_version.factor_value, v_version.factor_unit, v_version.source_reference, v_version.status, v_version.valid_from);

    RETURN jsonb_build_object('moduleId', v_module.module_id, 'version', 1);
END;
$function$;

CREATE FUNCTION public.klimatka_environment_update_module(
    p_secret_hash text,
    p_module_id text,
    p_module jsonb,
    p_version jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_module public.measurement_modules;
    v_version public.measurement_module_versions;
    v_next_version integer;
    v_expected_hash text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    SELECT secret_hash INTO v_expected_hash
    FROM public.klimatka_environment_write_guard
    WHERE id = 1;
    IF v_expected_hash IS NULL OR p_secret_hash IS DISTINCT FROM v_expected_hash THEN
        RAISE EXCEPTION 'environment write authorization failed' USING ERRCODE = '42501';
    END IF;

    SELECT module.* INTO v_module
    FROM public.measurement_modules AS module
    WHERE module.module_id = p_module_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'measurement module not found' USING ERRCODE = 'P0002';
    END IF;
    v_module := jsonb_populate_record(v_module, p_module);
    v_version := jsonb_populate_record(NULL::public.measurement_module_versions, p_version);
    IF v_version.version_id IS NULL OR v_version.valid_from IS NULL THEN
        RAISE EXCEPTION 'module version identifier and effective date are required' USING ERRCODE = '22023';
    END IF;

    UPDATE public.measurement_modules
    SET name = v_module.name,
        description = v_module.description,
        unit = v_module.unit,
        metric_name = v_module.metric_name,
        active = v_module.active
    WHERE module_id = p_module_id;

    SELECT coalesce(max(version), 0) + 1 INTO v_next_version
    FROM public.measurement_module_versions
    WHERE module_id = p_module_id;
    INSERT INTO public.measurement_module_versions (version_id, module_id, version, name, description, unit, metric_name, factor_value, factor_unit, source_reference, status, valid_from)
    VALUES (v_version.version_id, p_module_id, v_next_version, v_version.name, v_version.description, v_version.unit, v_version.metric_name, v_version.factor_value, v_version.factor_unit, v_version.source_reference, v_version.status, v_version.valid_from);

    RETURN jsonb_build_object('moduleId', p_module_id, 'version', v_next_version);
END;
$function$;

CREATE FUNCTION public.klimatka_environment_delete_run(
    p_secret_hash text,
    p_tenant_id uuid,
    p_calculation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current public.calculation_runs;
    v_expected_hash text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT secret_hash INTO v_expected_hash
    FROM public.klimatka_environment_write_guard
    WHERE id = 1;
    IF v_expected_hash IS NULL OR p_secret_hash IS DISTINCT FROM v_expected_hash THEN
        RAISE EXCEPTION 'environment write authorization failed' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_company_admin(p_tenant_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;

    SELECT run.* INTO v_current
    FROM public.calculation_runs AS run
    WHERE run.tenant_id = p_tenant_id
      AND run.calculation_id = p_calculation_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculation run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_current.created_by_role = 'member' THEN
        RAISE EXCEPTION 'member records cannot be deleted' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.calculation_run_audit (calculation_id, tenant_id, action, previous_record_json)
    VALUES (v_current.calculation_id, v_current.tenant_id, 'DELETE', to_jsonb(v_current));
    DELETE FROM public.calculation_runs
    WHERE calculation_id = v_current.calculation_id
      AND tenant_id = v_current.tenant_id;

    RETURN jsonb_build_object('calculationId', v_current.calculation_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.klimatka_environment_create_module(text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klimatka_environment_update_module(text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klimatka_environment_create_module(text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klimatka_environment_update_module(text, text, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.klimatka_environment_create_run(text, jsonb, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klimatka_environment_update_run(text, uuid, text, jsonb, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klimatka_environment_delete_run(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klimatka_environment_create_run(text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klimatka_environment_update_run(text, uuid, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klimatka_environment_delete_run(text, uuid, text) TO authenticated;

COMMIT;
