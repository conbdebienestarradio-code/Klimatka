import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { CompanyInvitation } from "@shared/auth";
import { appFetch, isDemoMode, setActiveCompanyId } from "../lib/demo-api";
import { requireSupabase } from "../lib/supabase";
import klimatkaLogoWordmark from "../lib/klimatka-logo-wordmark.png";

type AuthMode = "register" | "login" | "invitation";
const USER_MANUAL_URL = "https://drive.google.com/file/d/1Uwyi5qRNvjYb9SQCsoQSHK7VasZOEDak/view?usp=sharing";

function hasValidEmailDomain(email: string) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== email.indexOf("@") || atIndex === email.length - 1) return false;
  const domain = email.slice(atIndex + 1);
  if (domain.length > 253 || domain.endsWith(".")) return false;
  try {
    const parsed = new URL(`http://${domain}`);
    if (parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) return false;
    const labels = parsed.hostname.toLowerCase().split(".");
    return labels.length > 1
      && labels.every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
      && /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels[labels.length - 1] ?? "");
  } catch {
    return false;
  }
}

function getPasswordChecks(password: string) {
  return [
    { label: "12 caracteres o más", met: password.length >= 12 },
    { label: "Una letra minúscula", met: /[a-z]/.test(password) },
    { label: "Una letra mayúscula", met: /[A-Z]/.test(password) },
    { label: "Un número", met: /[0-9]/.test(password) },
    { label: "Un símbolo", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitationToken = searchParams.get("token") ?? "";
  const demoMode = isDemoMode();
  const newDemoInvite = demoMode && mode === "invitation" && searchParams.get("new") === "1";
  const returnTo = searchParams.get("returnTo") ?? (demoMode ? "/?demo=1" : "/");
  const [invitation, setInvitation] = useState<CompanyInvitation | null>(null);
  const [invitationError, setInvitationError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const passwordChecks = getPasswordChecks(password);
  const passwordScore = passwordChecks.filter((check) => check.met).length;
  const passwordStrength = passwordScore === 0 ? "empty" : passwordScore < 3 ? "weak" : passwordScore < 5 ? "medium" : "strong";
  const passwordStrengthLabel = passwordStrength === "empty" ? "Sin evaluar" : passwordStrength === "weak" ? "Débil" : passwordStrength === "medium" ? "Intermedia" : "Fuerte";
  const title = mode === "login" ? "Inicia sesión" : mode === "invitation" ? "Únete a tu empresa" : "Crea tu perfil personal";

  useEffect(() => {
    let active = true;
    appFetch(newDemoInvite ? "/api/auth/me?invited=1" : "/api/auth/me").then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as { id: string };
    }).then(async (identity) => {
      if (!active) return;
      if (identity && mode === "invitation" && invitationToken) {
        const accepted = await appFetch(`/api/auth/invitations/${encodeURIComponent(invitationToken)}/accept`, { method: "POST" });
        const result = await accepted.json();
        if (accepted.ok) {
          if (result.company?.id) setActiveCompanyId(result.company.id);
          navigate("/", { replace: true });
        } else {
          setInvitationError(result.message ?? "No se pudo aceptar la invitación.");
        }
      } else if (identity && mode !== "invitation") navigate("/", { replace: true });
    }).finally(() => {
      if (active) setCheckingSession(false);
    });
    return () => { active = false; };
  }, [mode, navigate, invitationToken, newDemoInvite]);

  useEffect(() => {
    if (mode !== "invitation") return;
    if (!invitationToken) {
      setInvitationError("Falta el enlace de invitación.");
      return;
    }
    let active = true;
    appFetch(`/api/auth/invitations/${encodeURIComponent(invitationToken)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "La invitación no está disponible.");
        return data as CompanyInvitation;
      })
      .then((data) => {
        if (!active) return;
        setInvitation(data);
        setEmail(data.email);
      })
      .catch((cause) => {
        if (active) setInvitationError(cause instanceof Error ? cause.message : "La invitación no está disponible.");
      });
    return () => { active = false; };
  }, [mode, invitationToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setConfirmationPending(false);
    if (mode !== "login" && !hasValidEmailDomain(email.trim())) {
      setEmailTouched(true);
      setError("Ingresa un correo con un dominio válido, por ejemplo empresa.com.");
      return;
    }
    if (mode !== "login" && passwordScore !== passwordChecks.length) {
      setError("La contraseña debe tener 12 caracteres e incluir minúsculas, mayúsculas, números y símbolos.");
      return;
    }
    if (mode !== "login" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      if (demoMode) {
        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
        const payload = mode === "login" ? { email: email.trim(), password } : { firstName, lastName, jobTitle, email: email.trim(), password };
        const response = await appFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "No fue posible completar el acceso.");
      } else {
        const client = requireSupabase();
        if (mode === "login") {
          const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (authError) throw authError;
        } else {
          const setupResponse = await appFetch("/api/auth/setup");
          if (!setupResponse.ok) throw new Error("El registro aún se está configurando. Inténtalo más tarde.");
          const setup = await setupResponse.json();
          if (!setup.ready) throw new Error("El registro aún se está configurando. Inténtalo más tarde.");
          const emailRedirectTo = mode === "invitation"
            ? `${window.location.origin}/register/invitation?token=${encodeURIComponent(invitationToken)}`
            : `${window.location.origin}/`;
          const { data, error: authError } = await client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo,
              data: { first_name: firstName.trim(), last_name: lastName.trim(), job_title: jobTitle.trim() },
            },
          });
          if (authError) throw authError;
          if (!data.session) {
            setConfirmationPending(true);
            return;
          }
        }
      }
      if (mode === "invitation") {
        const accepted = await appFetch(`/api/auth/invitations/${encodeURIComponent(invitationToken)}/accept`, { method: "POST" });
        const identity = await accepted.json();
        if (!accepted.ok) throw new Error(identity.message ?? "No se pudo aceptar la invitación.");
        if (!demoMode && identity.company?.id) setActiveCompanyId(identity.company.id);
      }
      navigate(mode === "login" ? returnTo : demoMode ? "/?demo=1" : "/", { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No fue posible completar el acceso.";
      setError(message.includes("already registered") || message.includes("ya tiene una cuenta") || message.includes("ya tiene un perfil") ? "Este correo ya tiene un perfil. Inicia sesión para unirte a la empresa." : message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return <main className="auth-loading"><LoaderCircle className="spin" size={25} /><span>Preparando el acceso seguro…</span></main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand auth-brand-stacked"><img src={klimatkaLogoWordmark} alt="Klimatka" /><svg className="auth-brand-caption" viewBox="0 0 330 18" role="img" aria-label="Plataforma de inteligencia ambiental"><text x="0" y="13" textLength="330" lengthAdjust="spacing">PLATAFORMA DE INTELIGENCIA AMBIENTAL</text></svg></div>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Continúa con tu perfil de Klimatka." : mode === "invitation" ? invitation ? `Invitación para ${invitation.companyName}` : invitationError : "Tu perfil personal puede administrar varias empresas."}
        </p>
        {mode === "invitation" && invitationError && <div className="auth-error" role="alert">{invitationError}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode !== "login" && (
            <div className="auth-section">
              <h2>Datos personales</h2>
              <div className="auth-field-row">
                <label className="auth-field"><span>Nombre</span><input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={100} /></label>
                <label className="auth-field"><span>Apellidos</span><input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={100} /></label>
              </div>
              <label className="auth-field"><span>Cargo profesional</span><input autoComplete="organization-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required maxLength={120} placeholder="Consultora ambiental" /></label>
            </div>
          )}
          <div className="auth-section">
            {mode === "register" && <h2>Acceso a Klimatka</h2>}
            <label className="auth-field"><span>Correo electrónico</span><input type="email" autoComplete="email" value={email} onBlur={() => setEmailTouched(true)} onChange={(event) => setEmail(event.target.value)} required maxLength={254} readOnly={mode === "invitation"} placeholder="tu@correo.com" />{mode !== "login" && emailTouched && email.trim() && <small className={hasValidEmailDomain(email.trim()) ? "auth-validation-success" : "auth-validation-error"} role="status">{hasValidEmailDomain(email.trim()) ? "Formato del correo y dominio válido." : "Revisa el correo y usa un dominio como empresa.com."}</small>}</label>
            <label className="auth-field"><span>Contraseña</span><span className="auth-password"><input type={passwordVisible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? 1 : 12} maxLength={128} /><button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} title={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{mode !== "login" && <div className="auth-password-feedback" id="password-strength-guidance"><div className="password-strength" data-strength={passwordStrength} role="img" aria-label={`Fortaleza de la contraseña: ${passwordStrengthLabel}`}><span /><span /><span /><b>{passwordStrengthLabel}</b></div><ul className="password-requirements">{passwordChecks.map((check) => <li key={check.label} data-met={check.met}>{check.label}</li>)}</ul></div>}</label>
            {mode !== "login" && <label className="auth-field"><span>Confirmar contraseña</span><span className="auth-password"><input type={confirmVisible ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} /><button type="button" onClick={() => setConfirmVisible((visible) => !visible)} aria-label={confirmVisible ? "Ocultar contraseña" : "Mostrar contraseña"} title={confirmVisible ? "Ocultar contraseña" : "Mostrar contraseña"}>{confirmVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
          </div>
          {mode === "register" && <p className="auth-helper">Confirma tu correo si Supabase te lo solicita; luego podrás registrar tu primera empresa. <Link to="/email-preview/confirmation">Ver correo de confirmación</Link></p>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          {confirmationPending && <div className="auth-success" role="status">Revisa tu correo para confirmar la cuenta y luego inicia sesión. Si te invitó una empresa, vuelve al enlace de invitación después de confirmar.</div>}
          <button className="auth-submit" type="submit" disabled={submitting || (mode === "invitation" && !invitation)}>
            {submitting ? <LoaderCircle className="spin" size={17} /> : null}
            {submitting ? "Procesando…" : mode === "login" ? "Iniciar sesión" : mode === "invitation" ? "Crear perfil y unirme" : "Crear mi perfil"}
          </button>
        </form>
        {mode !== "invitation" && (
          <p className="auth-switch">
            {mode === "login" ? "¿Aún no tienes perfil? " : "¿Ya tienes un perfil? "}
            <Link to={mode === "login" ? demoMode ? "/register?demo=1" : "/register" : demoMode ? "/login?demo=1" : "/login"}>{mode === "login" ? "Crear mi perfil" : "Inicia sesión aquí"}</Link>
          </p>
        )}
        {mode === "login" && <p className="auth-recovery-link"><Link to={demoMode ? "/recover?demo=1" : "/recover"}>¿Olvidaste tu contraseña?</Link></p>}
        {mode === "invitation" && <p className="auth-switch">¿Ya tienes perfil? <Link to={`/login?returnTo=${encodeURIComponent(`/register/invitation?token=${invitationToken}${demoMode ? "&demo=1" : ""}`)}${demoMode ? "&demo=1" : ""}`}>Inicia sesión para aceptar la invitación</Link></p>}
        <p className="auth-recovery-link"><a href={USER_MANUAL_URL} target="_blank" rel="noopener noreferrer">Descargar manual de usuario (PDF)</a></p>
      </section>
    </main>
  );
}
