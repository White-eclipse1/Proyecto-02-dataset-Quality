import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import qualityFixture from "../public/contracts/quality.json";
import splitsFixture from "../public/contracts/splits.json";
import versionsFixture from "../public/contracts/versions.json";
import { App } from "../src/App";

/**
 * Smoke test del "Agent Test" de APP-02: arrancar la app y navegar a las
 * seis pantallas de Dataset Quality sin 404, rutas vacías ni crashes.
 * Sustituye `fetch` por el contenido real de `public/contracts/*.json`
 * (el mismo archivo que sirve la app en runtime, importado tal cual — no
 * una copia escrita a mano), así que si alguien rompe la forma del
 * contrato o el JSON servido, este test también falla.
 */
const CONTRACT_BODIES: Record<string, unknown> = {
  "quality.json": qualityFixture,
  "splits.json": splitsFixture,
  "versions.json": versionsFixture,
};

function mockContractsFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const fileName = Object.keys(CONTRACT_BODIES).find((name) => url.includes(name));
      if (!fileName) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response);
      }
      const body = CONTRACT_BODIES[fileName];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => body,
      } as Response);
    })
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DATASET_ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/overview", heading: /^overview$/i },
  { path: "/analyzers", heading: /^analyzers$/i },
  { path: "/splits", heading: /^splits$/i },
  { path: "/versions", heading: /^versions$/i },
  { path: "/copilot", heading: /^copilot$/i },
  { path: "/settings", heading: /^settings$/i },
];

describe("APP-02 - seis pantallas de Dataset Quality", () => {
  it.each(DATASET_ROUTES)(
    "la ruta $path renderiza su título y no muestra un error de contrato",
    async ({ path: routePath, heading }) => {
      mockContractsFetch();

      render(
        <MemoryRouter initialEntries={[routePath]}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
    }
  );

  it("el nav de Dataset Quality navega entre las seis pantallas sin recargar", async () => {
    mockContractsFetch();

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: /^overview$/i })
    ).toBeInTheDocument();

    for (const { heading } of DATASET_ROUTES.slice(1)) {
      const label = heading.source.replace(/[$^]/g, "");
      fireEvent.click(screen.getByRole("link", { name: new RegExp(label, "i") }));
      // Navegación secuencial pantalla por pantalla, a propósito: cada click
      // depende del DOM que dejó el anterior.
      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    }
  });
});
