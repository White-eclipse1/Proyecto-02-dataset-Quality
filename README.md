# Proyecto-02-dataset-Quality
MLOps project for dataset quality, validation, reproducible splitting, versioning and release management using COCO, Pydantic, DVC, MinIO/S3, Docker, Terraform and GitHub Actions. Includes automated quality analyzers, quality gates, dataset versioning, a web dashboard and an MCP-based Dataset Copilot.
# Team 3 — Dataset Quality & Versioning Pipeline



Este proyecto implementa un pipeline reproducible para transformar un dataset en formato COCO en un dataset validado, analizado, particionado, versionado y liberable.

El objetivo principal es garantizar que una versión del dataset solo pueda ser liberada cuando cumpla las políticas de calidad definidas por el equipo.

---

## Team 3

- Hannah Chenoa
- Diego Lemus
- Mauricio Figueroa
- Santiago Ortiz

---

## Objetivo del proyecto

El sistema toma como entrada un dataset COCO y ejecuta un pipeline compuesto por cinco etapas principales:

1. Ingesta y validación del dataset
2. Análisis automático de calidad
3. Quality Gate
4. Generación reproducible de splits
5. Versionado y promoción del dataset

El pipeline puede terminar en dos estados:

- `PASS`: el dataset cumple las políticas y puede continuar hacia split y versionado.
- `FAIL`: el dataset no cumple una o más políticas críticas y el release queda bloqueado.

---

# Arquitectura

El flujo general del proyecto es:

```text
COCO Dataset
     │
     ▼
┌─────────────────┐
│ 1. Ingesta      │
│ + Pydantic      │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ 2. Quality Analyzers│
└─────────┬───────────┘
          │
          ▼
┌─────────────────┐
│ 3. Quality Gate │
│   quality.yaml  │
└───────┬─────────┘
        │
    ┌───┴────┐
    │        │
  PASS      FAIL
    │        │
    ▼        └──► Re-anotación / corrección
┌─────────────────┐
│ 4. Data Splits  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. DVC Version  │
└────────┬────────┘
         │
         ├──► DEV  / MinIO
         └──► PROD / AWS S3
```

---

## Pipeline (Python)

El pipeline de calidad vive en [`pipeline/`](pipeline/), como paquete Python separado del portal de anotación (`backend/`, `frontend/`). Fijado a Python 3.12 (`pipeline/pyproject.toml`, `pipeline/Dockerfile`).

Setup local:

```bash
cd pipeline
cp .env.example .env
python -m venv .venv && source .venv/bin/activate   # Windows: ver nota abajo
pip install -r requirements.txt -r requirements-dev.txt
ruff check .
pytest
```

Las dependencias se editan en `requirements.in` / `requirements-dev.in` y se recompilan con `pip-compile --generate-hashes` hacia `requirements.txt` / `requirements-dev.txt`. Nunca se editan a mano los `.txt` compilados — si se hace, se pierde el hash-locking.

### Notas para Windows

Los archivos `requirements*.txt` se compilan con `pip-compile --generate-hashes` en Linux/Mac. Eso deja fuera del lockfile cualquier dependencia transitiva marcada como solo-Windows (`sys_platform == "win32"` en su metadata) — `pip install -r requirements-dev.txt --require-hashes` falla en Windows con `"all requirements must have their versions pinned"` para esos paquetes, aunque el resto instale bien. Hasta ahora se han visto:

- `colorama` (dependencia de `pytest` en Windows).
- `pywin32` (dependencia de `mcp`, usado por el Dataset Copilot / APP-06, en Windows).

Si `pip install -r requirements-dev.txt --require-hashes` se queja de alguno de estos (o de otro paquete nuevo con el mismo patrón), instálalo suelto primero y repite el comando — pip lo va a tratar como ya satisfecho y va a saltarse el requisito de hash solo para ese paquete:

```powershell
pip install colorama pywin32
pip install -r requirements-dev.txt --require-hashes
```

Además, en Windows conviene usar el lanzador `py` en vez de `python` a secas (puede no apuntar a la versión correcta si hay varios Pythons instalados). El proyecto está fijado a Python 3.12 (`pyproject.toml`):

```powershell
py -0                       # lista los Pythons instalados
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

También corre contenedorizado junto al resto del stack. Está detrás de un profile de Docker Compose (`pipeline`) porque hoy es solo tooling de CLI/batch — sin servidor HTTP — así que `docker compose up` sigue levantando únicamente app + MariaDB + MinIO:

```bash
docker compose --profile pipeline run --rm pipeline <comando>
```

### DVC (OPS-04)

El pipeline reproducible vive en `pipeline/dvc.yaml`: `ingest → validate → analyze → quality_gate → split → release`. Parámetros (categorías objetivo, umbrales de analizadores, proporciones de split) en `pipeline/params.yaml`; el dataset crudo (`pipeline/data/raw/coco-dataset.json`) nunca se versiona en git — solo su puntero `.dvc` — y se sincroniza contra MinIO (DEV) como remote de DVC.

**Instalar DVC por separado**, no como parte de `requirements-dev.txt`: `dvc[s3]` trae `aiobotocore`, que exige un rango de `botocore` incompatible con el `boto3` ya fijado del pipeline — mezclarlos en el mismo lockfile rompe la resolución. Instálalo aislado (`pipx install "dvc[s3]"` es lo más simple) o en un entorno Python separado.

**El remote DEV usa el hostname de Compose** (`http://minio:9000` en `.dvc/config`, ya versionado), así que `dvc repro`/`push`/`pull` necesitan correr donde ese hostname resuelva — dentro del profile `pipeline` de Compose, o en un contenedor conectado a la misma red (`docker network connect` / `--network proyecto-02-dataset-quality_default`). Las credenciales (`minioadmin`/`minioadmin` en dev) van en `.dvc/config.local`, que está en `.gitignore` — nunca en el `.dvc/config` versionado.

```bash
cd pipeline
dvc remote modify --local dev access_key_id minioadmin
dvc remote modify --local dev secret_access_key minioadmin
PYTHONPATH=src dvc repro
dvc push -r dev
dvc pull -r dev
```

`dvc repro` corrido dos veces no debe rehacer ninguna etapa; tocar `params.yaml` o `quality.yaml` solo debe rehacer las etapas realmente afectadas (`dvc dag` muestra el grafo completo).

**Limitación conocida:** la verificación de `duplicates` (pHash) necesita descargar las imágenes reales desde el object store — el export COCO solo trae el nombre de archivo, no el `storage_key` de MinIO, así que la etapa `analyze` lo resuelve consultando la tabla `images` de MariaDB por `id` (los IDs de COCO son los mismos IDs de la BD). Si esa BD/objeto no está disponible en el entorno donde corre `dvc repro` (por ejemplo, corriendo contra un dataset anotado en otra instancia), la métrica degrada a `0` con un warning explícito en la salida — nunca se presenta como una medición limpia sin serlo.