import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Mail, ShieldOff, Users, X } from "lucide-react";
import { appFetch } from "../lib/demo-api";

type CompanyMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: "admin" | "member";
  joinedAt: string;
};

type PendingInvitation = { email: string; expiresAt: string };

type AccessList = { members: CompanyMember[]; pendingInvitations: PendingInvitation[]; emailConfigured: boolean };

export default function CompanyAccessModal({ companyName, currentUserId, demoMode, onClose }: { companyName: string; currentUserId: string; demoMode: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [accessList, setAccessList] = useState<AccessList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoInviteUrl, setDemoInviteUrl] = useState("");

  const loadAccessList = useCallback(async () => {
    const response = await appFetch("/api/auth/members");
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "No se pudo cargar el acceso de la empresa.");
    setAccessList(result as AccessList);
  }, []);

  useEffect(() => {
    loadAccessList()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo cargar el acceso de la empresa."))
      .finally(() => setLoading(false));
  }, [loadAccessList]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await appFetch("/api/auth/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "No se pudo enviar la invitación.");
      setMessage(result.message ?? `Invitación enviada a ${email}.`);
      if (demoMode && typeof result.url === "string") setDemoInviteUrl(result.url);
      setEmail("");
      await loadAccessList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar la invitación.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeMember(member: CompanyMember) {
    if (!window.confirm(`¿Revocar el acceso de ${member.firstName} ${member.lastName}? Sus registros e historial permanecerán en los totales de ${companyName}.`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await appFetch(`/api/auth/members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "No se pudo revocar el acceso.");
      setMessage(result.message ?? "Acceso revocado; los registros se conservaron.");
      await loadAccessList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revocar el acceso.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvitation(invitation: PendingInvitation) {
    if (!window.confirm(`¿Cancelar la invitación enviada a ${invitation.email}?`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await appFetch("/api/auth/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invitation.email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "No se pudo cancelar la invitación.");
      setMessage(result.message ?? "Invitación cancelada.");
      await loadAccessList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar la invitación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-invite-modal company-access-modal" role="dialog" aria-modal="true" aria-labelledby="company-access-title">
        <button type="button" className="icon-button company-access-close" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        <div className="company-access-heading"><Users size={19} /><div><h2 id="company-access-title">Personas y accesos</h2><p>{companyName}</p></div></div>
        <p>Las personas invitadas podrán registrar consumos y consultar los datos de la empresa. El acceso continúa hasta que una administración lo revoque; sus registros e historial se conservan en los totales empresariales.</p>
        {demoMode && <div className="company-access-demo-note">Demostración local: aún no se envían correos.</div>}
        {!demoMode && accessList && !accessList.emailConfigured && <div className="company-access-email-warning" role="alert">El envío de correos aún no está configurado. No se enviará ninguna invitación hasta que administración configure el servicio de correo.</div>}
        <form className="company-access-invite-form" onSubmit={sendInvitation}>
          <label className="auth-field"><span>Correo electrónico de la persona</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="persona@empresa.com" /></label>
          <button className="button-primary" type="submit" disabled={saving || loading || !email || (!demoMode && accessList?.emailConfigured !== true)}><Mail size={15} />{saving ? "Procesando…" : "Enviar invitación por correo"}</button>
        </form>
        {message && <div className="auth-success" role="status">{message}</div>}
        {demoInviteUrl && <a className="company-access-demo-link" href={demoInviteUrl}>Abrir el flujo de invitación de ejemplo</a>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {loading ? <p className="company-access-loading"><LoaderCircle className="spin" size={17} /> Cargando accesos…</p> : (
          <div className="company-access-sections">
            <section>
              <h3>Acceso activo <span>{accessList?.members.length ?? 0}</span></h3>
              {accessList?.members.map((member) => (
                <article className="company-access-row" key={member.id}>
                  <span className="company-access-avatar">{`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase()}</span>
                  <span className="company-access-person"><b>{member.firstName} {member.lastName}{member.id === currentUserId ? " · Tú" : ""}</b><small>{member.email} · {member.jobTitle}</small></span>
                  <span className="company-access-role">{member.role === "admin" ? "Administración" : "Trabajador"}</span>
                  {member.id !== currentUserId && <button className="company-access-revoke" type="button" disabled={saving} onClick={() => void revokeMember(member)} aria-label={`Revocar acceso a ${member.firstName} ${member.lastName}`} title="Revocar acceso"><ShieldOff size={15} /></button>}
                </article>
              ))}
            </section>
            <section>
              <h3>Invitaciones pendientes <span>{accessList?.pendingInvitations.length ?? 0}</span></h3>
              {accessList?.pendingInvitations.length ? accessList.pendingInvitations.map((invitation) => (
                <article className="company-access-row" key={invitation.email}>
                  <span className="company-access-avatar"><Mail size={15} /></span>
                  <span className="company-access-person"><b>{invitation.email}</b><small>Vence {new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small></span>
                  <button className="company-access-cancel" type="button" disabled={saving} onClick={() => void cancelInvitation(invitation)}>Cancelar</button>
                </article>
              )) : <p className="company-access-empty">No hay invitaciones pendientes.</p>}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
