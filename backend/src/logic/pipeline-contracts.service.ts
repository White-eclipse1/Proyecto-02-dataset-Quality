/**
 * SPEC-PIPE-001 — Lee los contratos de Data Quality (`quality.json`,
 * `splits.json`, `versions.json`) tal como los deja la pipeline Python en
 * `contracts/` (ver `env.CONTRACTS_DIR`).
 *
 * A propósito NO se re-valida el contenido contra un esquema aquí: la forma
 * ya está garantizada por los modelos Pydantic `extra="forbid"` del lado de
 * la pipeline (`quality_gate.models.QualityReport`, `splits.models.SplitResult`,
 * `copilot.contracts.VersionsReport`), y el frontend ya valida lo que recibe
 * con Zod (`frontend/src/lib/contracts/schemas.ts`). Duplicar esa validación
 * aquí en TypeScript solo arriesgaría que las dos copias del esquema se
 * desincronicen sin que nada lo detecte — este endpoint es un paso a través
 * (leer el archivo, parsear JSON, devolverlo), no una tercera fuente de
 * verdad sobre la forma del contrato.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { NotFoundError } from './errors.js';

async function readContractJson(filename: string, contractsDir: string): Promise<unknown> {
  const filePath = path.join(contractsDir, filename);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (error) {
    if (isEnoent(error)) {
      throw new NotFoundError(
        `${filename} no existe todavía en ${contractsDir} — corre la pipeline (dvc repro) primero.`,
      );
    }
    throw error;
  }

  return JSON.parse(raw);
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * Reporte actual del Quality Gate — `contracts/quality.json`.
 *
 * `contractsDir` por defecto es `env.CONTRACTS_DIR`; el parámetro existe
 * para poder probar esta función contra un directorio temporal sin fingir
 * variables de entorno (ver `tests/pipeline-contracts.test.ts`).
 */
export async function getQualityReport(contractsDir: string = env.CONTRACTS_DIR): Promise<unknown> {
  return readContractJson('quality.json', contractsDir);
}

/** Reporte actual de splits train/val/test — `contracts/splits.json`. */
export async function getSplitReport(contractsDir: string = env.CONTRACTS_DIR): Promise<unknown> {
  return readContractJson('splits.json', contractsDir);
}

/** Línea de tiempo de versiones del dataset — `contracts/versions.json`. */
export async function getVersionHistory(
  contractsDir: string = env.CONTRACTS_DIR,
): Promise<unknown> {
  return readContractJson('versions.json', contractsDir);
}
