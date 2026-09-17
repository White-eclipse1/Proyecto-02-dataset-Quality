import { Bot } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useContractFetch } from "@/hooks/useContractFetch";
import { qualityReportSchema } from "@/lib/contracts/schemas";

/**
 * Copilot: placeholder de ruta para APP-02 (scaffold). El servidor MCP y el
 * agente de solo lectura son APP-06/APP-07 — todavía no existen. Esta
 * pantalla sí lee un contrato real (quality.json) para no ser una ruta
 * vacía/estática, y deja claro qué falta y por qué, en vez de simular un
 * chat que no funciona.
 */
export function CopilotPage() {
  const report = useContractFetch("/contracts/quality.json", qualityReportSchema);

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
              El servidor MCP y el agente todavía no están conectados.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Esta pantalla ya puede leer el contrato de calidad (versión{" "}
              <span className="font-medium text-ink">{report.data.dataset_version}</span>, estado{" "}
              <span className="font-medium text-ink">{report.data.overall_status}</span>
              ), pero el chat en sí se implementa en APP-06 (servidor MCP) y APP-07 (agente).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
