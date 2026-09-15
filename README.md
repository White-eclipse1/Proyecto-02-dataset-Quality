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
