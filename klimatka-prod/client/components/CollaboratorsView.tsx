import { Building2, CalendarDays, Leaf, LockKeyhole, UserRound, Users } from "lucide-react";
import type { AuthIdentity } from "@shared/auth";
import type { CalculationResult } from "@shared/environment";

export type CompanyMemberProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: "admin" | "member";
  joinedAt: string;
  invitedBy: string | null;
};

type Props = {
  identity: AuthIdentity;
  companyRuns: CalculationResult[];
  collaborators: CompanyMemberProfile[];
  collaboratorsLoading: boolean;
  collaboratorsError: string;
  personalRuns: CalculationResult[];
  personalLoading: boolean;
  personalError: string;
  onInvite: () => void;
  onCreateCorporate: () => void;
  onCreatePersonal: () => void;
  onReloadPersonal: () => void;
};

const categoryLabels: Record<CalculationResult["category"], string> = {
  ELECTRICITY: "Electricidad",
  FUEL: "Combustible",
  WATER: "Agua",
  WASTE: "Residuos",
  MATERIAL: "Materiales",
  PACKAGING: "Empaques",
  REFRIGERANT: "Refrigerantes",
  AIR: "Emisiones al aire",
  AI: "Uso de IA",
  INTERNET: "Internet",
  CUSTOM: "Módulo personalizado",
};

function formatTonnes(value: number) {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
}

function emissionsFor(runs: CalculationResult[]) {
  return runs.reduce((total, run) => total + (run.co2eTotalTonnes ?? 0), 0);
}

function ProfileMetrics({ runs, personalRuns = [] }: { runs: CalculationResult[]; personalRuns?: CalculationResult[] }) {
  return (
    <div className="collaborator-metrics">
      <div><span>Impacto corporativo aportado</span><b>{formatTonnes(emissionsFor(runs))} t CO₂e</b><small>{runs.length} {runs.length === 1 ? "registro" : "registros"} incluidos en la empresa</small></div>
      <div><span>Impacto personal aislado</span><b>{formatTonnes(emissionsFor(personalRuns))} t CO₂e</b><small>{personalRuns.length} {personalRuns.length === 1 ? "medición privada" : "mediciones privadas"}</small></div>
    </div>
  );
}

function ProfileAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase() || "?";
  return <span className="collaborator-avatar">{initials}</span>;
}

function PersonalRunRow({ run }: { run: CalculationResult }) {
  return (
    <article className="personal-impact-row">
      <span className="personal-impact-icon"><Leaf size={15} /></span>
      <span className="personal-impact-copy"><b>{categoryLabels[run.category]} · {run.scope}</b><small>{run.reportingPeriod} · {run.factorUsed}</small></span>
      <b className="personal-impact-value">{run.co2eTotalTonnes === null ? "Sin GEI" : `${formatTonnes(run.co2eTotalTonnes)} t CO₂e`}</b>
    </article>
  );
}

export default function CollaboratorsView({ identity, companyRuns, collaborators, collaboratorsLoading, collaboratorsError, personalRuns, personalLoading, personalError, onInvite, onCreateCorporate, onCreatePersonal, onReloadPersonal }: Props) {
  const ownCorporateRuns = companyRuns.filter((run) => run.createdByUserId === identity.id);
  const pageTitle = identity.role === "admin" ? "Colaboradores" : "Mi perfil de colaborador";

  return (
    <div className="collaborators-page">
      <div className="page-heading page-heading-small collaborator-page-heading">
        <div><span className="eyebrow"><span className="eyebrow-line" /> EQUIPO Y HUELLA INDIVIDUAL</span><h1>{pageTitle}</h1><p>Consulta perfiles y distingue lo que aporta al reporte empresarial de tus mediciones privadas.</p></div>
        {identity.role === "admin" && <button type="button" className="button-secondary" onClick={onInvite}><Users size={15} /> Invitar colaborador</button>}
      </div>

      <section className="panel collaborator-own-profile" aria-labelledby="collaborator-own-title">
        <div className="collaborator-profile-heading">
          <ProfileAvatar firstName={identity.firstName} lastName={identity.lastName} />
          <div><span className="panel-kicker">TU PERFIL</span><h2 id="collaborator-own-title">{identity.firstName} {identity.lastName}</h2><p>{identity.jobTitle || (identity.role === "admin" ? "Administración" : "Colaborador")} · {identity.email}</p></div>
        </div>
        <ProfileMetrics runs={ownCorporateRuns} personalRuns={personalRuns} />
      </section>

      <section className="collaborator-capture-grid" aria-label="Registrar impacto individual">
        <article className="panel collaborator-capture-card collaborator-corporate-card">
          <span className="collaborator-capture-icon"><Building2 size={17} /></span>
          <div><span className="panel-kicker">IMPACTO CORPORATIVO</span><h2>Medición para la empresa</h2><p>Se atribuye a tu perfil y se suma a los indicadores, reportes y exportaciones de {identity.company?.name ?? "la empresa"}.</p></div>
          <button type="button" className="button-primary" onClick={onCreateCorporate}>Registrar impacto corporativo</button>
        </article>
        <article className="panel collaborator-capture-card collaborator-personal-card">
          <span className="collaborator-capture-icon"><LockKeyhole size={17} /></span>
          <div><span className="panel-kicker">MEDICIÓN PERSONAL AISLADA</span><h2>Tu impacto privado</h2><p>Solo tú puedes consultar estas mediciones. No afectan los totales, reportes ni exportaciones de la empresa.</p></div>
          <button type="button" className="button-secondary" onClick={onCreatePersonal}>Registrar impacto personal aislado</button>
        </article>
      </section>

      {identity.role === "admin" && (
        <section className="panel collaborator-team-panel" aria-labelledby="collaborator-team-title">
          <div className="collaborator-section-heading"><div><span className="panel-kicker">ACCESO ACTIVO</span><h2 id="collaborator-team-title">Colaboradores que aceptaron la invitación</h2><p>El aporte corporativo de cada persona queda atribuido a su perfil.</p></div><span className="collaborator-count"><Users size={14} /> {collaborators.length}</span></div>
          {collaboratorsLoading ? <p className="collaborator-loading">Cargando perfiles…</p> : collaboratorsError ? <p className="auth-error" role="alert">{collaboratorsError}</p> : collaborators.length ? (
            <div className="collaborator-list">
              {collaborators.map((person) => {
                const runs = companyRuns.filter((run) => run.createdByUserId === person.id);
                return <article className="collaborator-member-card" key={person.id}>
                  <div className="collaborator-profile-heading"><ProfileAvatar firstName={person.firstName} lastName={person.lastName} /><div><h3>{person.firstName} {person.lastName}</h3><p>{person.jobTitle || "Colaborador"} · {person.email}</p><small><CalendarDays size={12} /> Acceso activo desde {formatDate(person.joinedAt)}</small></div></div>
                  <div className="collaborator-member-impact"><b>{runs.length}</b><span>{runs.length === 1 ? "registro corporativo" : "registros corporativos"}</span><strong>{formatTonnes(emissionsFor(runs))} t CO₂e</strong></div>
                </article>;
              })}
            </div>
          ) : <div className="collaborator-empty"><UserRound size={18} /><span>Aún no hay colaboradores con invitaciones aceptadas.</span></div>}
        </section>
      )}

      <section className="panel personal-impact-panel" aria-labelledby="personal-impact-title">
        <div className="collaborator-section-heading"><div><span className="panel-kicker">SOLO VISIBLE PARA TI</span><h2 id="personal-impact-title">Mediciones personales aisladas</h2><p>Este historial permanece separado del espacio y del reporte empresarial.</p></div><span className="personal-private-badge"><LockKeyhole size={12} /> Privado</span></div>
        {personalLoading ? <p className="collaborator-loading">Cargando tus mediciones…</p> : personalError ? <div className="collaborator-personal-error"><p className="auth-error" role="alert">{personalError}</p><button type="button" className="button-secondary" onClick={onReloadPersonal}>Reintentar</button></div> : personalRuns.length ? <div className="personal-impact-list">{personalRuns.map((run) => <PersonalRunRow key={run.calculationId} run={run} />)}</div> : <div className="collaborator-empty"><LockKeyhole size={17} /><span>Todavía no guardas mediciones personales aisladas.</span></div>}
      </section>
    </div>
  );
}
