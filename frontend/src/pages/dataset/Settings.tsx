import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useContractFetch } from "@/hooks/useContractFetch";
import { qualityReportSchema } from "@/lib/contracts/schemas";

/**
 * Settings: muestra los umbrales/severidad actuales de cada check, leídos
 * de contracts/quality.json. Los campos están deshabilitados a propósito:
 * editar y persistir contra quality.yaml es responsabilidad de un ticket
 * posterior (una vez exista quality.yaml real de Data Quality) — mostrarlo
 * como editable ahora, sin que el cambio se guarde en ningún lado, sería
 * un formulario que miente. Ver rúbrica 7.5.
 */
export function SettingsPage() {
  const report = useContractFetch("/contracts/quality.json", qualityReportSchema);

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
              Edición todavía no conectada a un <code>quality.yaml</code> real — estos valores se
              muestran de solo lectura hasta que exista la política real de Data Quality.
            </div>
            <ul className="divide-y divide-border">
              {report.data.checks.map((check) => (
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
                        readOnly
                        disabled
                        value={check.threshold ?? "—"}
                        className="w-20 rounded-lg border border-border bg-sidebar px-2 py-1 text-sm text-ink"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      Severidad
                      <select
                        disabled
                        value={check.severity}
                        className="rounded-lg border border-border bg-sidebar px-2 py-1 text-sm text-ink"
                      >
                        <option value="warn">warn</option>
                        <option value="fail">fail</option>
                      </select>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
