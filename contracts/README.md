# Data Contracts — Web App & Dataset Copilot

Este directorio define los **contratos de datos** que la Web App (Overview,
Analyzers, Splits, Versions, Copilot, Settings) y el Dataset Copilot (MCP)
van a consumir desde el pipeline de calidad y versionado.

Se crean como parte de `APP-01` para que el desarrollo de la aplicación
pueda arrancar (`APP-02` y siguientes) **sin esperar** a que Data Quality
(analizadores, `quality.yaml`) y MLOps (DVC, splits) terminen su parte.

## Estado

Estos son **archivos de ejemplo (mock)**, no salidas reales del pipeline.
Las cifras son ilustrativas y deliberadamente no coinciden con ninguna
métrica real de producción — su propósito es fijar la **forma** de los
datos (nombres de campos, tipos, anidamiento), no el contenido.

Cuando los tiers 2-5 del pipeline (analizadores, quality gate, splits, DVC)
existan de verdad, sus salidas deben producir JSON con esta misma forma.
Cualquier cambio a la forma aquí definida debe acordarse con los dueños de
Data Quality y MLOps antes de mergear, y quedar reflejado en este README.

## Archivos

- `quality.json` — salida de la Quality Gate (Tier 3): resultado por check
  (`pass` / `warn` / `fail`), valor observado vs. umbral, y muestras
  ofensoras. Lo consumen las pantallas **Overview**, **Analyzers** y
  **Settings**, y las herramientas de solo lectura del Copilot.
- `splits.json` — salida del split estratificado (Tier 4): conteos y
  distribución de clases por partición, semilla usada, proporciones
  configuradas y resultado del chequeo de fuga (leakage) entre
  train/val/test. Lo consume la pantalla **Splits**.
- `versions.json` — salida del versionado con DVC (Tier 5): línea de
  tiempo de versiones semánticas, hash de contenido, estado de
  sincronización DEV (MinIO) / PROD (S3), y diff entre versión actual y
  anterior. Lo consume la pantalla **Versions**.

## Reconciliación con DQ-02

`DQ-02` definió la política real de la Quality Gate (`pipeline/quality.yaml`)
y los modelos Pydantic que la validan (`pipeline/src/dataset_quality/quality_gate/`).
Al mergear `main` en esta rama se ajustó `quality.json` para que coincida
exactamente con esa política:

- Los 5 checks (`min_images_per_class`, `class_imbalance`, `small_objects`,
  `duplicates`, `invalid_boxes`) usan el mismo `threshold`, `severity` y
  `unit` que `quality.yaml`.
- Se quitó el check `spatial_bias`: no está definido en la política de
  DQ-02 y el motor de evaluación (`evaluate_policy`) solo puede producir
  un resultado por check declarado ahí, así que un check fuera de esa
  lista nunca aparecería en una salida real. Si se retoma más adelante,
  debe agregarse primero a `quality.yaml` con un `threshold` numérico
  (el modelo `QualityCheckResult` no permite `threshold`/`observed`
  nulos).
- Se quitaron los campos `_contract`/`_note` del nivel superior: el
  modelo `QualityReport` usa `extra = "forbid"`, así que cualquier campo
  fuera de `dataset_version`, `generated_at`, `overall_status` y `checks`
  rompe la validación real del pipeline.

Verificado cargando este archivo con el `QualityReport` real de DQ-02
(`QualityReport.model_validate(...)`): valida sin errores y los 5 checks
coinciden 1:1 con `quality.yaml`.

## Reconciliación con APP-06

`APP-06` agrega el servidor MCP de solo lectura y el Dataset Copilot
(`pipeline/src/dataset_quality/copilot/`), que leen los tres contratos de
este directorio (`quality.json`, `splits.json`, `versions.json`) tal cual
están en disco — es el único I/O del Copilot (ver `copilot/store.py`).

`versions.json` (Tier 5) no tenía todavía un modelo Pydantic estricto —
`quality.json` ya lo tiene desde `DQ-02`, y `splits.json` lo obtiene en
`APP-04` (rama `feat/app-04-stratified-splits`, aún sin mergear). `APP-06`
define `VersionsReport` (`copilot/contracts.py`, `extra = "forbid"`) como
el modelo real de `versions.json`, y al reconciliar se ajustó el archivo:

- Se quitaron los campos `_contract`/`_note` del nivel superior, igual que
  se hizo con `quality.json` en `DQ-02`: `VersionsReport` no permite campos
  fuera de `current_version` y `versions`, así que cualquier metadato de
  mock rompe la validación real.
- No se tocó la forma de `environments` (`dev`/`prod`) ni `diff_from_previous`:
  ya coincidían campo por campo con `VersionEnvironments`/`VersionDiff`.

Verificado cargando este archivo con el `VersionsReport` real de APP-06
(`VersionsReport.model_validate(...)`): valida sin errores
(`tests/test_copilot.py::test_real_versions_contract_validates_with_the_new_model`).

Para `splits.json`, el Copilot usa a propósito un modelo propio y más
permisivo (`SplitsSummary`, `extra = "ignore"`) en lugar del `SplitResult`
estricto de `APP-04`, porque esa rama todavía no está en `main` y `APP-06`
no está bloqueado por `APP-04` en las dependencias declaradas del ticket
(solo por `APP-01`/`DQ-02`). Queda un `TODO(APP-04 merge)` en
`copilot/contracts.py` para reemplazarlo por el `SplitResult` real una vez
que `feat/app-04-stratified-splits` se mergee — sin eso, ninguna
herramienta del Copilot deja de funcionar contra `main` hoy.

## Pendiente (fuera de alcance de APP-01)

- Consumo real desde la Web App una vez exista el scaffolding de rutas
  (`APP-02`).