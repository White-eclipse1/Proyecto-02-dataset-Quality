import { useState } from "react";
import { QualityStatusBadge } from "@/components/dataset/QualityStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useContractFetch } from "@/hooks/useContractFetch";
import { type QualityCheck, qualityReportSchema } from "@/lib/contracts/schemas";

/**
 * Analyzers: un tab por analizador de calidad (Tier 2 del pipeline), leído
 * de contracts/quality.json. Solo se listan los checks que representan
 * analizadores propiamente (se excluye min_images_per_class, que es la
 * política de la quality gate, no un analizador — ver Splits/Overview).
 */
const ANALYZER_IDS = [
  "small_objects",
  "class_imbalance",
  "duplicates",
  "invalid_boxes",
  "spatial_bias",
] as const;

export function AnalyzersPage() {
  const report = useContractFetch("/contracts/quality.json", qualityReportSchema);
  const [activeId, setActiveId] = useState<string>(ANALYZER_IDS[0]);

  return (
    <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">Analyzers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Objetos pequeños, desbalance de clases, duplicados, cajas inválidas y sesgo espacial.
          </p>
        </header>

        {report.status === "loading" && <Skeleton className="h-64" />}

        {report.status === "error" && (
          <ErrorState
            title="No se pudieron cargar los analizadores."
            message={report.message}
            onRetry={report.reload}
          />
        )}

        {report.status === "success" && (
          <AnalyzersTabs checks={report.data.checks} activeId={activeId} onChange={setActiveId} />
        )}
      </div>
    </main>
  );
}

function AnalyzersTabs({
  checks,
  activeId,
  onChange,
}: {
  checks: QualityCheck[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const analyzers = checks.filter((c) => (ANALYZER_IDS as readonly string[]).includes(c.id));
  const active = analyzers.find((c) => c.id === activeId) ?? analyzers[0];

  if (analyzers.length === 0) {
    return <EmptyState hasFilters={false} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {analyzers.map((check) => (
          <button
            key={check.id}
            type="button"
            onClick={() => onChange(check.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active?.id === check.id
                ? "bg-accent-lilac-soft text-accent-lilac"
                : "text-ink-muted hover:bg-sidebar hover:text-ink"
            }`}
          >
            {check.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">{active.label}</h2>
            <QualityStatusBadge status={active.status} />
          </div>

          {active.observed !== null && active.threshold !== null && (
            <p className="mt-2 text-sm text-ink-muted">
              Observado <span className="font-medium text-ink">{active.observed}</span>{" "}
              {active.unit} · umbral{" "}
              <span className="font-medium text-ink">{active.threshold}</span> {active.unit}
            </p>
          )}

          <p className="mt-4 text-sm font-medium text-ink">Muestras ofensoras</p>
          {active.offending_samples.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">Ninguna reportada.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-ink-muted">
              {active.offending_samples.map((sample) => (
                <li
                  key={JSON.stringify(sample)}
                  className="rounded-lg bg-sidebar px-3 py-2 font-mono"
                >
                  {JSON.stringify(sample)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
