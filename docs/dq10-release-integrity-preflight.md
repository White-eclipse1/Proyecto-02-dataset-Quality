# DQ-10 — Preflight de integridad del release

**Estado:** `BLOCKED` para la ejecución final del Quality Gate.  
**Fecha de verificación:** 2026-09-18  
**Rama:** `feat/phase-4-rol1-dq10`

## Evidencia restaurada

| Control | Resultado |
| --- | --- |
| Entrada COCO local | MD5 `0ac4ecdbbd5a9b3144624ec86009b9e7` |
| Puntero DVC esperado | MD5 `0ac4ecdbbd5a9b3144624ec86009b9e7` |
| Remoto DVC DEV | JSON COCO restaurado: `1 file pushed` |
| Ingesta y validacion | 311 imagenes, 1,038 anotaciones y 3 categorias procesadas |
| Esquema MariaDB | migraciones oficiales aplicadas; tabla `images` creada |
| Política `min_images_per_class` | `300`, `fail`, comparación `min` |
| Política `duplicates` | `5`, `fail`, comparación `max` |
| Política `invalid_boxes` | `0`, `fail`, comparación `max` |
| Resto de severidades | desbalance, objetos pequeños y sesgo espacial en `warn` |
| Suite de pipeline | `94 passed` |
| Estado Git antes de este informe | limpio; `git diff --check` sin salida |

Las pruebas aprobadas cubren las validaciones de política, cálculo de área, M3,
DQ-04 a DQ-08, contratos y splits. Esto confirma que no quedan las mutaciones
adversariales de comparación, umbrales, cajas o cálculo de área introducidas durante
las pruebas anteriores.

## Bloqueo real de release

El JSON COCO ya se restauró en DVC y las migraciones crearon el esquema de MariaDB.
Sin embargo, la tabla `images` contiene cero registros. Al ejecutar el analizador, el
pipeline falla cerrado con `DuplicateBytesUnavailableError`: faltan los 311 de 311
IDs de COCO en esa tabla.

Cada una de esas filas debe conservar el mismo `id` del COCO, incluir su `storage_key`
y apuntar al archivo real en MinIO. Sin esta relación no se pueden descargar los bytes
para medir duplicados mediante pHash.

El analizador de duplicados está diseñado para fallar cerrado cuando no puede leer esos
bytes. Sustituirlos por fixtures, datos de ejemplo o un valor de `duplicates: 0`
fabricado invalidaría el Quality Gate y no es aceptable.

## Para desbloquear DQ-10 y DQ-09

1. Cargar el release oficial correspondiente en MariaDB y MinIO, preservando los IDs
   que usa el COCO y sus `storage_key`.
2. Ejecutar desde el profile `pipeline`:

   ```sh
   dvc pull -r dev
   PYTHONPATH=src dvc repro
   ```

3. Verificar que `data/interim/quality.json` tiene salida `PASS`, sin checks `fail`
   rojos, y generar el reporte de release de DQ-09 con esas observaciones reales.

Hasta completar estos pasos, DQ-10 tiene su código y sus validaciones restaurados,
pero no debe cerrarse como aceptado ni debe cerrarse DQ-09.
