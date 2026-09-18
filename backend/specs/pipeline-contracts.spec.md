# SPEC-PIPE-001 — Datos reales de la pipeline de Data Quality

## Objetivo

APP-07 pide reemplazar los mocks estáticos de la Web App
(`frontend/public/contracts/*.json`) por las salidas reales de la pipeline
Python: `contracts/quality.json`, `contracts/splits.json`,
`contracts/versions.json` y `pipeline/quality.yaml`. Esta capa es el único
punto donde el backend (Fase 2) toca esos archivos — nunca directamente
desde el frontend, igual que ninguna otra pantalla accede a MariaDB/MinIO
directo.

## Contrato

```
GET  /quality-report    -> contracts/quality.json,  tal cual
GET  /split-report      -> contracts/splits.json,   tal cual
GET  /version-history   -> contracts/versions.json, tal cual
GET  /quality-policy    -> pipeline/quality.yaml, como JSON: { "<check_id>": { label, threshold, severity, comparison, unit }, ... }
PUT  /quality-policy    -> body: { "<check_id>": { threshold, severity }, ... } (todos los checks existentes, ninguno nuevo)
```

## Reglas

1. Los tres `GET` de solo lectura (`/quality-report`, `/split-report`,
   `/version-history`) NO revalidan la forma del JSON contra un esquema del
   lado del backend — leen el archivo y lo devuelven tal cual. La forma ya
   está garantizada por los modelos Pydantic `extra="forbid"` del lado de la
   pipeline, y el frontend ya la valida con Zod al recibirla. Mantener una
   tercera copia del esquema en TypeScript solo arriesgaría que las copias
   se desincronicen sin que nada lo note.
2. Si el archivo correspondiente no existe todavía (la pipeline no ha
   corrido), el backend responde 404 con un mensaje explícito ("corre la
   pipeline primero"), no un 500 genérico ni un array/objeto vacío que la UI
   pudiera confundir con un dataset real sin datos.
3. `GET /quality-policy` lee `pipeline/quality.yaml` y lo devuelve como JSON,
   con la misma forma plana (`check_id -> {label, threshold, severity,
   comparison, unit}`) que tiene en disco.
4. `PUT /quality-policy` es la única escritura de todo este spec. Edita
   ÚNICAMENTE `threshold` y `severity` por check — nunca `label`,
   `comparison` ni `unit`, que Settings no expone para editar y que se
   conservan tal cual estaban.
5. El body de `PUT /quality-policy` debe traer EXACTAMENTE el mismo
   conjunto de `check_id` que ya existe en `quality.yaml`: ni le puede
   faltar uno (400: "Faltan checks...") ni traer uno nuevo (400: "Checks
   desconocidos..."). Settings edita política existente; agregar o quitar
   checks sigue siendo decisión de Data Quality, no de la Web App.
6. `min_images_per_class` no puede quedar con `severity` distinta de
   `"fail"` ni con `threshold < 300` — el mismo invariante de negocio que
   `QualityPolicy.require_minimum_images_policy` exige del lado de la
   pipeline (`pipeline/src/dataset_quality/quality_gate/models.py`). Una
   edición que lo viole se rechaza con 400 y el archivo en disco no cambia.
7. Una escritura exitosa de `PUT /quality-policy` sobrescribe
   `pipeline/quality.yaml` completo. No existe ninguna otra copia de la
   política ni caché: la siguiente vez que corra
   `dataset_quality.quality_gate.runner` (`dvc repro`), lee este mismo
   archivo y usa los valores nuevos — así es como Settings "afecta la
   siguiente corrida del Quality Gate" (Agent Test de APP-07).
8. `env.CONTRACTS_DIR` y `env.QUALITY_POLICY_PATH` (`src/config/env.ts`)
   controlan dónde vive todo esto. En Docker Compose se montan como volumen
   compartido con la raíz del repo (ver `docker-compose.yml`); en
   desarrollo local (`npm run dev`, fuera de Docker) los defaults apuntan a
   las rutas reales del monorepo relativas a `backend/`.

## Flujo esperado

UI (`GET /quality-report` | `/split-report` | `/version-history` |
`GET`/`PUT /quality-policy`) → Logic (`pipeline-contracts.service.ts`,
`quality-policy.service.ts` + `quality-policy.builder.ts` para las reglas de
negocio del PUT) → sistema de archivos (`contracts/*.json`,
`pipeline/quality.yaml`) — nunca MariaDB ni MinIO.
