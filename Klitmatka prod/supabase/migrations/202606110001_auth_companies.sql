BEGIN;

CREATE TABLE public.profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email text,
    first_name text,
    last_name text,
    job_title text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (name = btrim(name) AND name <> ''),
    rif text NOT NULL
        CHECK (rif <> '' AND rif = upper(btrim(rif))),
    company_email text NOT NULL
        CHECK (
            length(company_email) <= 254
            AND company_email = lower(btrim(company_email))
            AND company_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        ),
    employee_count integer NOT NULL CHECK (employee_count > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_memberships (
    company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'member')),
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    PRIMARY KEY (company_id, user_id)
);

CREATE UNIQUE INDEX companies_rif_normalized_idx
    ON public.companies (regexp_replace(rif, '[^A-Za-z0-9]', '', 'g'));

CREATE INDEX company_memberships_user_active_idx
    ON public.company_memberships (user_id, company_id)
    WHERE revoked_at IS NULL;

CREATE TABLE public.company_invitations (
    token_hash text PRIMARY KEY
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
    email text NOT NULL CHECK (email <> '' AND email = lower(btrim(email))),
    created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    revoked_at timestamptz
);

CREATE UNIQUE INDEX company_invitations_one_open_email_idx
    ON public.company_invitations (company_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX company_invitations_pending_idx
    ON public.company_invitations (company_id, expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE public.klimatka_runtime_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    environment_ready boolean NOT NULL DEFAULT false
);
INSERT INTO public.klimatka_runtime_state (id, environment_ready) VALUES (1, false);
ALTER TABLE public.klimatka_runtime_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.klimatka_runtime_state FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_invitations FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, job_title) ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.companies TO authenticated;
GRANT SELECT ON TABLE public.company_memberships TO authenticated;

CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF NOT coalesce((SELECT environment_ready FROM public.klimatka_runtime_state WHERE id = 1), false) THEN
        RAISE EXCEPTION 'Klimatka signup is not ready' USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.profiles (
        user_id,
        email,
        first_name,
        last_name,
        job_title
    )
    VALUES (
        NEW.id,
        lower(nullif(btrim(NEW.email), '')),
        nullif(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''),
        nullif(btrim(NEW.raw_user_meta_data ->> 'last_name'), ''),
        nullif(btrim(NEW.raw_user_meta_data ->> 'job_title'), '')
    );

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

CREATE FUNCTION public.sync_auth_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    UPDATE public.profiles
    SET email = lower(nullif(btrim(NEW.email), ''))
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_auth_user_email() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_auth_user_email();

CREATE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.company_memberships AS membership
            WHERE membership.company_id = p_company_id
              AND membership.user_id = auth.uid()
              AND membership.revoked_at IS NULL
       );
$function$;

CREATE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.company_memberships AS membership
            WHERE membership.company_id = p_company_id
              AND membership.user_id = auth.uid()
              AND membership.role = 'admin'
              AND membership.revoked_at IS NULL
       );
$function$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;

CREATE POLICY profiles_select_self
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY profiles_update_self
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY companies_select_member
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(id));

CREATE POLICY memberships_select_self
    ON public.company_memberships
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.create_company(
    p_name text,
    p_rif text,
    p_company_email text,
    p_employee_count integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_name text := btrim(coalesce(p_name, ''));
    v_rif text := upper(btrim(coalesce(p_rif, '')));
    v_company_email text := lower(btrim(coalesce(p_company_email, '')));
    v_company_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    IF v_name = '' OR v_rif = '' OR v_company_email = '' THEN
        RAISE EXCEPTION 'company name, RIF, and email are required' USING ERRCODE = '22023';
    END IF;
    IF p_employee_count IS NULL OR p_employee_count <= 0 THEN
        RAISE EXCEPTION 'employee count must be positive' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.companies (name, rif, company_email, employee_count)
    VALUES (v_name, v_rif, v_company_email, p_employee_count)
    RETURNING id INTO v_company_id;

    INSERT INTO public.company_memberships (company_id, user_id, role)
    VALUES (v_company_id, v_user_id, 'admin');

    RETURN v_company_id;
END;
$function$;

CREATE FUNCTION public.create_company_invitation(
    p_company_id uuid,
    p_email text,
    p_token_hash text,
    p_expires_at timestamptz
)
RETURNS TABLE (
    company_id uuid,
    email text,
    expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_token_hash text := lower(btrim(coalesce(p_token_hash, '')));
    v_locked_company_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    IF v_email = '' OR length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'invitation email is invalid' USING ERRCODE = '22023';
    END IF;
    IF v_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'token hash must be a SHA-256 hex digest' USING ERRCODE = '22023';
    END IF;
    IF p_expires_at IS NULL
       OR p_expires_at <= clock_timestamp()
       OR p_expires_at > clock_timestamp() + interval '7 days' + interval '1 minute' THEN
        RAISE EXCEPTION 'invitation expiry must be within seven days' USING ERRCODE = '22023';
    END IF;

    SELECT company.id
    INTO v_locked_company_id
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'company not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.company_memberships AS membership
        JOIN auth.users AS auth_user ON auth_user.id = membership.user_id
        WHERE membership.company_id = p_company_id
          AND membership.revoked_at IS NULL
          AND lower(btrim(auth_user.email)) = v_email
    ) THEN
        RAISE EXCEPTION 'email already belongs to a company member' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.company_invitations AS invitation
        WHERE invitation.company_id = p_company_id
          AND invitation.email = v_email
          AND invitation.accepted_at IS NULL
          AND invitation.revoked_at IS NULL
          AND invitation.expires_at > clock_timestamp()
    ) THEN
        RAISE EXCEPTION 'an active invitation already exists for this email' USING ERRCODE = '23505';
    END IF;

    -- Retire expired, unresolved rows so a new invitation can be created without losing history.
    UPDATE public.company_invitations AS invitation
    SET revoked_at = clock_timestamp()
    WHERE invitation.company_id = p_company_id
      AND invitation.email = v_email
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at <= clock_timestamp();

    INSERT INTO public.company_invitations (
        token_hash,
        company_id,
        email,
        created_by,
        expires_at
    )
    VALUES (
        v_token_hash,
        p_company_id,
        v_email,
        auth.uid(),
        p_expires_at
    );

    RETURN QUERY SELECT p_company_id, v_email, p_expires_at;
END;
$function$;

CREATE FUNCTION public.read_company_invitation(p_token_hash text)
RETURNS TABLE (
    company_id uuid,
    company_name text,
    email text,
    expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_token_hash text := lower(btrim(coalesce(p_token_hash, '')));
BEGIN
    IF v_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT invitation.company_id, company.name, invitation.email, invitation.expires_at
    FROM public.company_invitations AS invitation
    JOIN public.companies AS company ON company.id = invitation.company_id
    WHERE invitation.token_hash = v_token_hash
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > clock_timestamp();
END;
$function$;

CREATE FUNCTION public.accept_company_invitation(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_token_hash text := lower(btrim(coalesce(p_token_hash, '')));
    v_company_id uuid;
    v_invitation_email text;
    v_user_email text;
    v_email_confirmed_at timestamptz;
    v_jwt_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    IF v_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'invalid invitation' USING ERRCODE = '22023';
    END IF;

    SELECT invitation.company_id, invitation.email
    INTO v_company_id, v_invitation_email
    FROM public.company_invitations AS invitation
    WHERE invitation.token_hash = v_token_hash
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > clock_timestamp()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation is unavailable' USING ERRCODE = 'P0002';
    END IF;

    SELECT lower(btrim(auth_user.email)), auth_user.email_confirmed_at
    INTO v_user_email, v_email_confirmed_at
    FROM auth.users AS auth_user
    WHERE auth_user.id = v_user_id;

    IF coalesce(v_user_email, '') = ''
       OR v_email_confirmed_at IS NULL
       OR v_jwt_email = ''
       OR v_jwt_email <> v_user_email
       OR v_user_email <> v_invitation_email THEN
        RAISE EXCEPTION 'authenticated email does not match invitation' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.company_memberships AS membership
        WHERE membership.company_id = v_company_id
          AND membership.user_id = v_user_id
          AND membership.revoked_at IS NULL
    ) THEN
        RAISE EXCEPTION 'user is already a company member' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.company_memberships AS existing_membership (
        company_id,
        user_id,
        role
    )
    VALUES (v_company_id, v_user_id, 'member')
    ON CONFLICT (company_id, user_id) DO UPDATE
        SET role = CASE
                WHEN existing_membership.revoked_at IS NOT NULL THEN 'member'
                ELSE existing_membership.role
            END,
            revoked_at = NULL;

    UPDATE public.company_invitations AS invitation
    SET accepted_at = clock_timestamp()
    WHERE invitation.token_hash = v_token_hash
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL;

    RETURN v_company_id;
END;
$function$;

CREATE FUNCTION public.cancel_company_invitation(p_company_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_company_id IS NULL OR btrim(coalesce(p_email, '')) = '' THEN
        RETURN false;
    END IF;

    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;

    UPDATE public.company_invitations AS invitation
    SET revoked_at = clock_timestamp()
    WHERE invitation.company_id = p_company_id
      AND invitation.email = lower(btrim(p_email))
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL;

    RETURN FOUND;
END;
$function$;

CREATE FUNCTION public.revoke_company_member(
    p_company_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_target_role text;
    v_admin_count integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'target user is required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'company not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot revoke yourself' USING ERRCODE = '22023';
    END IF;

    SELECT membership.role
    INTO v_target_role
    FROM public.company_memberships AS membership
    WHERE membership.company_id = p_company_id
      AND membership.user_id = p_user_id
      AND membership.revoked_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_target_role = 'admin' THEN
        SELECT count(*)::integer
        INTO v_admin_count
        FROM public.company_memberships AS membership
        WHERE membership.company_id = p_company_id
          AND membership.role = 'admin'
          AND membership.revoked_at IS NULL;

        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'cannot revoke the last company admin' USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE public.company_memberships AS membership
    SET revoked_at = clock_timestamp()
    WHERE membership.company_id = p_company_id
      AND membership.user_id = p_user_id
      AND membership.revoked_at IS NULL;

    RETURN FOUND;
END;
$function$;

CREATE FUNCTION public.list_company_members(p_company_id uuid)
RETURNS TABLE (
    user_id uuid,
    email text,
    first_name text,
    last_name text,
    job_title text,
    role text,
    created_at timestamptz,
    revoked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR SHARE;

    IF NOT FOUND OR NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT membership.user_id,
           profile.email,
           profile.first_name,
           profile.last_name,
           profile.job_title,
           membership.role,
           membership.created_at,
           membership.revoked_at
    FROM public.company_memberships AS membership
    LEFT JOIN public.profiles AS profile ON profile.user_id = membership.user_id
    WHERE membership.company_id = p_company_id
    ORDER BY membership.created_at, membership.user_id;
END;
$function$;

CREATE FUNCTION public.list_company_pending_invitations(p_company_id uuid)
RETURNS TABLE (
    email text,
    created_by uuid,
    created_at timestamptz,
    expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR SHARE;

    IF NOT FOUND OR NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'company admin required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT invitation.email,
           invitation.created_by,
           invitation.created_at,
           invitation.expires_at
    FROM public.company_invitations AS invitation
    WHERE invitation.company_id = p_company_id
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > clock_timestamp()
    ORDER BY invitation.created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_company(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_company_invitation(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_company_invitation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_company_invitation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_company_invitation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_company_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_company_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_company_pending_invitations(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.klimatka_auth_setup_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT to_regclass('public.profiles') IS NOT NULL
       AND to_regclass('public.companies') IS NOT NULL
       AND to_regclass('public.company_memberships') IS NOT NULL
       AND to_regclass('public.company_invitations') IS NOT NULL
       AND coalesce((SELECT environment_ready FROM public.klimatka_runtime_state WHERE id = 1), false);
$function$;

REVOKE ALL ON FUNCTION public.klimatka_auth_setup_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.klimatka_auth_setup_ready() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_company(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_invitation(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_company_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_company_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_pending_invitations(uuid) TO authenticated;

COMMIT;
