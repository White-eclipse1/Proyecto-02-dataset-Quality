import { useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useContractFetch } from "@/hooks/useContractFetch";
import { type QualityReport, qualityReportSchema, type Severity } from "@/lib/contracts/schemas";

type Edits = Record<string, { threshold: string; severity: Severity }>;

/**
 * Settings: muestra y permite editar los umbrales/severidad de cada check,
 * leídos de contracts/quality.json (AC de APP-05: "Quality thresholds can
 * be displayed and edited"). La edición vive solo en estado local de
 * React — no hay persistencia contra un `quality.yaml` real todavía (eso
 * sigue siendo alcance de un ticket posterior, una vez exista la política
 * real y editable de Data Quality). A propósito NO hay un botón "Guardar"
 * que pretenda escribir el cambio en algún lado: eso sí sería el
 * formulario que miente que este mismo archivo advertía antes de APP-05
 * (ver contracts/README.md, "Reconciliación con APP-05"). El banner deja
 * claro que el cambio no persiste al recargar.
 */
export function SettingsPage() {
  const report = useContractFetch("/contracts/quality.json", qualityReportSchema);
  const [edits, setEdits] = useState<Edits>({});

  const editedValue = (check: QualityReport["checks"][number]) =>
    edits[check.id] ?? {
      threshold: check.threshold === null ? "" : String(check.threshold),
      severity: check.severity,
    };

  const setThreshold = (checkId: string, check: QualityReport["checks"][number], value: string) =>
    setEdits((prev) => ({
      ...prev,
      [checkId]: { ...editedValue(check), threshold: value },
    }));

  const setSeverity = (checkId: string, check: QualityReport["checks"][number], value: Severity) =>
    setEdits((prev) => ({
      ...prev,
      [checkId]: { ...editedValue(check), severity: value },
    }));

  return (
    <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Umbrales y severidad por check de la quality gate.
          </p>
        </header>

        {report.status === "loading" && <Skeleton className="h-64" />}

        {report.status === "error" && (
          <ErrorState
            title="No se pudo cargar la configuración."
            message={report.message}
            onRetry={report.reload}
          />
        )}

        {report.status === "success" && (
          <div className="rounded-2xl border border-border bg-surface shadow-card">
            <div className="border-b border-border bg-status-pending-soft px-5 py-3 text-xs text-status-pending">
              Los cambios de esta pantalla son locales a esta sesión del navegador — todavía no se
              guardan contra un <code>quality.yaml</code> real, así que se pierden al recargar. La
              persistencia real es alcance de un ticket posterior de Data Quality.
            </div>
            <ul className="divide-y divide-border">
              {report.data.checks.map((check) => {
                const current = editedValue(check);
                return (
                  <li
                    key={check.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{check.label}</p>
                      <p className="text-xs text-ink-muted">id: {check.id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Umbral
                        <input
                          type="text"
                          value={current.threshold}
                          onChange={(event) => setThreshold(check.id, check, event.target.value)}
                          className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Severidad
                        <select
                          value={current.severity}
                          onChange={(event) =>
                            setSeverity(check.id, check, event.target.value as Severity)
                          }
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink"
                        >
                          <option value="warn">warn</option>
                          <option value="fail">fail</option>
                        </select>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
