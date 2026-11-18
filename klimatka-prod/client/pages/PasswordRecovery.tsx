import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import klimatkaLogoWordmark from "../lib/klimatka-logo-wordmark.png";
import { appFetch, isDemoMode } from "../lib/demo-api";
import { requireSupabase } from "../lib/supabase";

type RecoveryMode = "request" | "reset";

export default function PasswordRecovery({ mode }: { mode: RecoveryMode }) {
  const [searchParams] = useSearchParams();
  const demoMode = isDemoMode();
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [demoResetUrl, setDemoResetUrl] = useState("");
  const [recoverySession, setRecoverySession] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(mode !== "reset" || demoMode);

  useEffect(() => {
    if (mode !== "reset" || demoMode) return;
    const client = requireSupabase();
    const recoveryLink = searchParams.get("type") === "recovery" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoverySession(Boolean(data.session) && recoveryLink);
      setRecoveryChecked(true);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoverySession(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [mode, demoMode, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (mode === "reset" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      if (demoMode) {
        const response = await appFetch(`/api/auth/password-reset/${mode === "request" ? "request" : "complete"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "request" ? { email } : { token, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "No fue posible completar la solicitud.");
        setMessage(result.message ?? "Solicitud completada.");
        if (typeof result.url === "string") setDemoResetUrl(result.url);
      } else {
        const client = requireSupabase();
        if (mode === "request") {
          const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password?type=recovery` });
          if (resetError) throw resetError;
          setMessage("Si el correo corresponde a una cuenta, recibirás un enlace para recuperar el acceso.");
        } else {
          if (!recoverySession) throw new Error("El enlace expiró o ya fue utilizado. Solicita uno nuevo.");
          const { error: updateError } = await client.auth.updateUser({ password });
          if (updateError) throw updateError;
          setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
          await client.auth.signOut();
        }
      }
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible completar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  const invalidToken = mode === "reset" && recoveryChecked && (demoMode ? !token : !recoverySession);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="recovery-title">
        <div className="auth-brand auth-brand-stacked"><img src={klimatkaLogoWordmark} alt="Klimatka" /><svg className="auth-brand-caption" viewBox="0 0 330 18" role="img" aria-label="Plataforma de inteligencia ambiental"><text x="0" y="13" textLength="330" lengthAdjust="spacing">PLATAFORMA DE INTELIGENCIA AMBIENTAL</text></svg></div>
        <h1 id="recovery-title">{mode === "request" ? "Recupera tu acceso" : "Crea una contraseña nueva"}</h1>
        <p className="auth-subtitle">
          {mode === "request" ? "Te enviaremos un enlace seguro a tu correo electrónico." : "Elige una contraseña de al menos 12 caracteres."}
        </p>
        {mode === "reset" && !recoveryChecked ? (
          <p className="company-access-loading"><LoaderCircle className="spin" size={17} /> Validando el enlace…</p>
        ) : invalidToken ? (
          <div className="auth-error" role="alert">El enlace no es válido. Solicita uno nuevo para recuperar el acceso.</div>
        ) : complete ? (
          <div className="auth-success" role="status">{message}</div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "request" ? (
              <label className="auth-field"><span>Correo electrónico</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="tu@correo.com" /></label>
            ) : (
              <>
                <label className="auth-field"><span>Nueva contraseña</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} /></label>
                <label className="auth-field"><span>Confirmar contraseña</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} /></label>
              </>
            )}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" size={17} /> : null}
              {submitting ? "Procesando…" : mode === "request" ? "Enviar enlace" : "Actualizar contraseña"}
            </button>
          </form>
        )}
        {complete && mode === "request" && <p className="auth-recovery-note">{demoMode ? "La demostración no envía correos reales; usa el enlace de prueba que aparece aquí." : "Si no recibes el mensaje, revisa la carpeta de correo no deseado."}</p>}
        {demoResetUrl && <p className="auth-recovery-link"><Link to={demoResetUrl}>Abrir la pantalla de cambio de contraseña de prueba</Link></p>}
        <p className="auth-switch"><Link to={demoMode ? "/login?demo=1" : "/login"}>Volver a iniciar sesión</Link></p>
      </section>
    </main>
  );
}
