import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { AuthIdentity } from "../../shared/auth";
import { createSupabaseClient, getAuthIdentity, sha256 } from "../supabase";
import { requireAdmin, requireAuthenticated, requireCompany } from "../auth-middleware";

const email = z.string().trim().email().max(254);
const companyRegistrationSchema = z.object({
  companyEmail: email,
  rif: z.string().trim().min(6).max(30),
  companyName: z.string().trim().min(2).max(160),
  employeeCount: z.number().int().positive().max(10_000_000),
});
const invitationSchema = z.object({ email });
const memberIdSchema = z.object({ userId: z.string().uuid() });

function databaseStatus(error: { code?: string }) {
  if (error.code === "23505") return 409;
  if (error.code === "42501") return 403;
  if (error.code === "P0002") return 404;
  if (error.code === "22023" || error.code === "23514") return 400;
  return 500;
}

function invitationEmailConfigured() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return false;
  try {
    new URL("/register/invitation", process.env.KLIMATKA_APP_URL ?? "");
    return true;
  } catch {
    return false;
  }
}

function accessIdentity(req: Express.Request, companyId?: string): Promise<AuthIdentity> {
  return getAuthIdentity(req.supabaseClient!, req.supabaseUser!, companyId ?? req.auth?.company?.id);
}

export const authRouter = Router();

authRouter.get("/setup", async (_req, res) => {
  try {
    const client = createSupabaseClient();
    const { data, error } = await client.rpc("klimatka_auth_setup_ready");
    res.json({ ready: !error && data === true });
  } catch {
    res.status(503).json({ ready: false, message: "Supabase aún no está configurado." });
  }
});

authRouter.get("/me", requireAuthenticated, (req, res) => res.json(req.auth));

authRouter.post("/companies", requireAuthenticated, async (req, res) => {
  const parsed = companyRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Revisa los datos de la empresa.", errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
    return;
  }
  const { companyName, rif, companyEmail, employeeCount } = parsed.data;
  const { data: companyId, error } = await req.supabaseClient!.rpc("create_company", {
    p_name: companyName,
    p_rif: rif,
    p_company_email: companyEmail,
    p_employee_count: employeeCount,
  });
  if (error) {
    res.status(databaseStatus(error)).json({ message: error.code === "23505" ? "Ya existe una empresa con ese RIF." : "No se pudo crear la empresa." });
    return;
  }
  try {
    res.status(201).json(await accessIdentity(req, String(companyId)));
  } catch {
    res.status(503).json({ message: "La empresa se creó, pero no se pudo cargar su perfil. Intenta actualizar la página." });
  }
});

authRouter.post("/companies/switch", requireAuthenticated, async (req, res) => {
  const companyId = z.string().uuid().safeParse(req.body?.companyId);
  if (!companyId.success) {
    res.status(400).json({ message: "Selecciona una empresa válida." });
    return;
  }
  try {
    const identity = await accessIdentity(req, companyId.data);
    if (!identity.company) {
      res.status(403).json({ message: "No tienes acceso a esa empresa." });
      return;
    }
    res.json(identity);
  } catch {
    res.status(503).json({ message: "No se pudo cargar la empresa seleccionada." });
  }
});

authRouter.get("/invitations/:token", async (req, res) => {
  try {
    const client = createSupabaseClient();
    const { data, error } = await client.rpc("read_company_invitation", { p_token_hash: sha256(String(req.params.token)) });
    if (error) {
      res.status(databaseStatus(error)).json({ message: "No se pudo consultar la invitación." });
      return;
    }
    const invitation = Array.isArray(data) ? data[0] : data;
    if (!invitation) {
      res.status(404).json({ message: "La invitación no existe o expiró." });
      return;
    }
    res.json({ email: invitation.email, companyName: invitation.company_name, expiresAt: invitation.expires_at });
  } catch {
    res.status(503).json({ message: "El acceso seguro aún no está disponible." });
  }
});

authRouter.post("/invitations/:token/accept", requireAuthenticated, async (req, res) => {
  const { data: companyId, error } = await req.supabaseClient!.rpc("accept_company_invitation", {
    p_token_hash: sha256(String(req.params.token)),
  });
  if (error) {
    res.status(databaseStatus(error)).json({ message: "La invitación no es válida, expiró o corresponde a otro correo." });
    return;
  }
  try {
    res.json(await accessIdentity(req, String(companyId)));
  } catch {
    res.status(503).json({ message: "La invitación se aceptó, pero no se pudo cargar el perfil. Actualiza la página." });
  }
});

authRouter.get("/members", requireAuthenticated, requireCompany, requireAdmin, async (req, res) => {
  const companyId = req.auth!.company!.id;
  const [members, invitations] = await Promise.all([
    req.supabaseClient!.rpc("list_company_members", { p_company_id: companyId }),
    req.supabaseClient!.rpc("list_company_pending_invitations", { p_company_id: companyId }),
  ]);
  if (members.error || invitations.error) {
    res.status(503).json({ message: "No se pudo cargar la lista de accesos." });
    return;
  }
  res.json({
    members: (members.data ?? []).filter((member: { revoked_at: string | null }) => !member.revoked_at).map((member: Record<string, unknown>) => ({
      id: member.user_id,
      email: member.email ?? "",
      firstName: member.first_name ?? "",
      lastName: member.last_name ?? "",
      jobTitle: member.job_title ?? "",
      role: member.role,
      joinedAt: member.created_at,
    })),
    pendingInvitations: (invitations.data ?? []).map((invitation: Record<string, unknown>) => ({ email: invitation.email, expiresAt: invitation.expires_at })),
    emailConfigured: invitationEmailConfigured(),
  });
});

authRouter.delete("/members/:userId", requireAuthenticated, requireCompany, requireAdmin, async (req, res) => {
  const parsed = memberIdSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: "Selecciona una persona válida." });
    return;
  }
  const { error } = await req.supabaseClient!.rpc("revoke_company_member", {
    p_company_id: req.auth!.company!.id,
    p_user_id: parsed.data.userId,
  });
  if (error) {
    res.status(databaseStatus(error)).json({ message: error.code === "23514" ? "La empresa debe conservar al menos una persona administradora." : "No se pudo revocar el acceso." });
    return;
  }
  res.json({ message: "Acceso revocado. Sus registros y su historial se conservaron en los totales de la empresa." });
});

authRouter.post("/invitations", requireAuthenticated, requireCompany, requireAdmin, async (req, res) => {
  const parsed = invitationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Ingresa un correo electrónico válido." });
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !sender || !invitationEmailConfigured()) {
    res.status(503).json({ message: "El envío de invitaciones por correo aún no está configurado. Contacta con administración." });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const companyId = req.auth!.company!.id;
  const { data: created, error: createError } = await req.supabaseClient!.rpc("create_company_invitation", {
    p_company_id: companyId,
    p_email: parsed.data.email,
    p_token_hash: sha256(token),
    p_expires_at: expiresAt,
  });
  if (createError) {
    res.status(databaseStatus(createError)).json({ message: createError.code === "23505" ? "Ya existe una invitación activa o esta persona ya tiene acceso." : "No se pudo crear la invitación." });
    return;
  }

  const invitationUrl = new URL("/register/invitation", process.env.KLIMATKA_APP_URL);
  invitationUrl.searchParams.set("token", token);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: [parsed.data.email],
        subject: `Invitación a unirte a ${req.auth!.company!.name} en Klimatka`,
        text: `Te invitaron a colaborar en el registro ambiental de ${req.auth!.company!.name} en Klimatka.\n\nCrea tu acceso o inicia sesión con este mismo correo para registrar consumos y consultar los datos de la empresa:\n\n${invitationUrl}\n\nEl enlace vence en 7 días. Una vez que aceptes, tu acceso continuará hasta que una persona administradora lo revoque. Tus registros y su historial se conservarán en los totales de la empresa.`,
      }),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
    res.status(201).json({ email: parsed.data.email, expiresAt, message: `Invitación enviada a ${parsed.data.email}.` });
  } catch {
    await req.supabaseClient!.rpc("cancel_company_invitation", { p_company_id: companyId, p_email: parsed.data.email });
    res.status(502).json({ message: "No fue posible enviar el correo de invitación. Verifica la configuración e inténtalo de nuevo." });
  }
});

authRouter.delete("/invitations", requireAuthenticated, requireCompany, requireAdmin, async (req, res) => {
  const parsed = invitationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Ingresa un correo electrónico válido." });
    return;
  }
  const { data, error } = await req.supabaseClient!.rpc("cancel_company_invitation", {
    p_company_id: req.auth!.company!.id,
    p_email: parsed.data.email,
  });
  if (error) {
    res.status(databaseStatus(error)).json({ message: "No se pudo cancelar la invitación." });
    return;
  }
  if (!data) {
    res.status(404).json({ message: "No hay una invitación pendiente para ese correo." });
    return;
  }
  res.json({ message: "Invitación pendiente cancelada." });
});
