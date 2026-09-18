# Reporte de Auditoría Independiente — M3 y Analizadores (DQ-07)

**Fecha de auditoría:** 2026-09-18  
**Ticket:** [DQ-07] Perform final M3 and analyzer correctness audit (#32)  
**Responsable:** Santiago Ortiz (`Sir-roboot`) — Data Quality Engineer  
**Rama:** `feat/phase-3-rol1-dq07`  

---

## 1. Fuente y procedencia del dataset auditado

| Campo | Valor auditado |
| --- | --- |
| **Archivo origen** | `C:\Users\santi\Downloads\coco-dataset.json` |
| **SHA-256 verificado** | `935e9bb639bfe966fdc3b1bbe95becf07dcd09f7567079642f22a73646531936` |
| **Tamaño en disco** | 346,069 bytes |
| **Total imágenes** | 313 |
| **Total anotaciones** | 1,038 |
| **Categorías presentes** | 3 (`person`: id 1, `car`: id 2, `dog`: id 3) |
| **Clases objetivo confirmadas** | `person`, `car` |

> La huella SHA-256 coincide exactamente con las auditorías de línea base de DQ-03 y DQ-04, confirmando que se trata de la misma exportación oficial autorizada.

---

## 2. Tabla final de auditoría M3 por clase

M3 exige al menos **dos clases con $\ge$ 300 imágenes distintas y válidas**.

| Clase | ID | Total cajas | Cajas válidas | Cajas inválidas excluidas | Imágenes distintas con $\ge$ 1 caja válida | Umbral M3 | Estado antes de colapso | Faltante |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| **`person`** | 1 | 472 | 472 | 0 | **311** | 300 | **Cumple** | 0 |
| **`car`** | 2 | 566 | 566 | 0 | **309** | 300 | **Cumple** | 0 |
| **`dog`** | 3 | 0 | 0 | 0 | **0** | 300 | No seleccionada | N/A |

### Reglas de conteo y exclusión aplicadas independientemente
1. **Conteo por imagen:** Se contabilizan identificadores de imagen distintos (`image_id`), no la cantidad de cajas. Varias cajas de la misma clase en una imagen cuentan una sola vez.
2. **Exclusión de cajas inválidas:** Se auditaron todas las cajas del dataset. 0 cajas presentan ancho o alto no positivos, coordenadas negativas o límites fuera de las dimensiones declaradas de su imagen.
3. **Imágenes sin cajas válidas:** 2 imágenes del dataset de 313 no poseen cajas de las clases objetivo confirmadas (`person` o `car`).

---

## 3. Comparativa independiente vs. sistema de producción

Se compararon las métricas computadas por el motor independiente de auditoría (`dataset_quality.analyzers.dq07_audit`) contra los analizadores de producción (`dq04`, `dq05`, `m3`):

| Métrica | Cálculo Independiente | Sistema Producción | Tolerancia / Criterio | Discrepancia |
| --- | ---: | ---: | --- | --- |
| **Cajas inválidas** | 0 | 0 | Exacta (0 boxes) | **0 (Coincide)** |
| **Imágenes válidas `person`** | 311 | 311 | Exacta | **0 (Coincide)** |
| **Imágenes válidas `car`** | 309 | 309 | Exacta | **0 (Coincide)** |
| **Objetos pequeños ($< 32\times 32$ px)** | 14 cajas (1.3487%) | 14 cajas (1.3487%) | $\le 10^{-4}$ | **0 (Coincide)** |
| **Ratio de desbalance de clases** | 1.0065 | 1.0065 | $\le 10^{-4}$ | **0 (Coincide)** |
| **Clase mayoritaria** | `person` (311) | `person` (311) | Nominal | **0 (Coincide)** |
| **Clase minoritaria** | `car` (309) | `car` (309) | Nominal | **0 (Coincide)** |

**Resultado:** **0 discrepancias** entre el cálculo independiente y los analizadores del sistema.

---

## 4. Colapso de duplicados transitivos y estado de recursos

### Algoritmo de colapso transitivo implementado
El motor de auditoría implementa el agrupamiento de duplicados mediante componentes conexos transitivos (Disjoint Set Union):
- Si el par $(A, B)$ y el par $(B, C)$ son detectados como casi duplicados, forman un único grupo $\{A, B, C\}$.
- **Preservación de evidencia:** Si cualquier imagen del grupo contiene anotaciones de una clase (ej. `person`), el representante colapsado preserva la evidencia de dicha clase.
- Las imágenes independientes (no duplicadas) se conservan intactas.

### Estado del cálculo pHash sobre el dataset real
- El cálculo de pHash requiere los **píxeles reales** de cada imagen (como implementa `find_near_duplicate_images` vía Pillow e ImageHash).
- Se auditó el entorno local, `Downloads`, el workspace y el volumen Docker `proyecto-02-dataset-quality_minio_data` (el cual solo contiene `.minio.sys` sin buckets cargados). Los binarios reales de las 313 imágenes no están presentes en el entorno local.
- Conforme al procedimiento estipulado en `PROMPT_CONTINUACION_ROL_1_PROYECTO_02.md`:
  > *"Si faltan binarios o M3 no cumple, deja DQ-07 pendiente; continúa DQ-08 con fixtures controlados y distingue esas pruebas de la validación del dataset real."*
- **Estado de DQ-07:** La auditoría independiente de métricas COCO, exclusión de cajas, baseline M3 y algoritmo de colapso transitivo está **completada y verificada**. La validación final de M3 post-pHash sobre los datos reales queda **pendiente de la provisión de los binarios de las imágenes**.

---

## 5. Comandos de reproducción

En un contenedor Docker con Python 3.12 y el dataset montado en `/input/coco-dataset.json`:

```bash
python -m dataset_quality.analyzers.dq07_audit /input/coco-dataset.json \
  --target-classes person car \
  --min-images 300 \
  --output /workspace/docs/dq07-m3-audit.json
```

Para ejecutar las pruebas unitarias de la auditoría independiente:

```bash
pytest -q tests/test_dq07_audit.py
```
