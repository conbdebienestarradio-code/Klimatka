import { createHash } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AuthCompany, AuthIdentity } from "../shared/auth.js";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

export function createSupabaseClient(accessToken?: string) {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
  });
}

export async function getAuthIdentity(client: SupabaseClient, user: User, requestedCompanyId?: string | null): Promise<AuthIdentity> {
  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    client.from("profiles").select("email, first_name, last_name, job_title").eq("user_id", user.id).maybeSingle(),
    client.from("company_memberships").select("role, created_at, company:companies(id, name, rif, company_email, employee_count)").eq("user_id", user.id).is("revoked_at", null).order("created_at"),
  ]);
  if (profileError) throw profileError;
  if (membershipError) throw membershipError;

  const companies = ((memberships ?? []) as Array<{ role: AuthCompany["role"]; company: { id: string; name: string; rif: string; company_email: string; employee_count: number } | Array<{ id: string; name: string; rif: string; company_email: string; employee_count: number }> | null }>)
    .map((membership): AuthCompany | null => {
      const company = Array.isArray(membership.company) ? membership.company[0] : membership.company;
      return company ? {
        id: company.id,
        name: company.name,
        rif: company.rif,
        email: company.company_email,
        employeeCount: company.employee_count,
        role: membership.role,
      } : null;
    })
    .filter((company): company is AuthCompany => company !== null);
  const company = requestedCompanyId
    ? companies.find((item) => item.id === requestedCompanyId) ?? null
    : companies[0] ?? null;
  const admins = (process.env.KLIMATKA_PLATFORM_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const email = String(profile?.email ?? user.email ?? "");

  return {
    id: user.id,
    email,
    firstName: String(profile?.first_name ?? ""),
    lastName: String(profile?.last_name ?? ""),
    jobTitle: String(profile?.job_title ?? ""),
    role: company?.role ?? "none",
    isPlatformAdmin: admins.includes(email.toLowerCase()),
    company,
    companies,
  };
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
