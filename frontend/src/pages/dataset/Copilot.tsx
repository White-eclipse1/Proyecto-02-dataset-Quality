import { Bot } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useValidatedFetch } from "@/hooks/useValidatedFetch";
import { qualityReportSchema } from "@/lib/contracts/schemas";

/**
 * Copilot: placeholder de ruta para APP-02 (scaffold). El servidor MCP y el
 * agente de solo lectura (APP-06) ya existen del lado de la pipeline
 * Python — lo que falta es cablear un chat de verdad en esta pantalla
 * contra ese agente, que sigue fuera del alcance de APP-07 (su Acceptance
 * Criteria es reemplazar los mocks de datos por las salidas reales de la
 * pipeline, no construir la UI de chat). Mientras tanto, esta pantalla lee
 * GET /quality-report (backend, SPEC-PIPE-001/APP-07) igual que Overview,
 * para no ser una ruta vacía/estática, y deja claro qué falta y por qué en
 * vez de simular un chat que no funciona.
 */
export function CopilotPage() {
  const report = useValidatedFetch("/quality-report", qualityReportSchema);

  return (
    <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">Copilot</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Dataset Copilot — agente de solo lectura sobre el estado del dataset.
          </p>
        </header>

        {report.status === "loading" && <Skeleton className="h-40" />}

        {report.status === "error" && (
          <ErrorState
            title="No se pudo cargar el contexto del dataset."
            message={report.message}
            onRetry={report.reload}
          />
        )}

        {report.status === "success" && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent-lilac-soft text-accent-lilac">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">
              El chat con el Dataset Copilot todavía no está cableado en esta pantalla.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Esta pantalla ya lee el reporte de calidad real de la pipeline (versión{" "}
              <span className="font-medium text-ink">{report.data.dataset_version}</span>, estado{" "}
              <span className="font-medium text-ink">{report.data.overall_status}</span>
              ), pero conectar la UI de chat contra el servidor MCP y el agente de APP-06 sigue
              siendo un ticket aparte.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
