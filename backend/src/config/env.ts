import 'dotenv/config';
import { z } from 'zod';

/**
 * Valida las variables de entorno usadas por la aplicación.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1),

  MINIO_PORT: z.coerce.number().int().positive().default(9000),

  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  MINIO_ACCESS_KEY: z.string().min(1),

  MINIO_SECRET_KEY: z.string().min(1),

  MINIO_BUCKET: z.string().min(3),

  MAX_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),

  // SPEC-PIPE-001 — dónde vive el `contracts/` de Data Quality (quality.json,
  // splits.json, versions.json) y el `quality.yaml` que la pipeline Python
  // lee en cada corrida. En Docker Compose, ambos se montan como volumen
  // (ver docker-compose.yml); en desarrollo local (`npm run dev`, fuera de
  // Docker) los defaults apuntan a las rutas reales del monorepo, relativas
  // a este paquete (`backend/`).
  CONTRACTS_DIR: z.string().min(1).default('../contracts'),
  QUALITY_POLICY_PATH: z.string().min(1).default('../pipeline/quality.yaml'),
});

/**
 * Variables ya validadas y tipadas.
 * Si alguna configuración requerida falta, la aplicación falla al iniciar.
 */
export const env = envSchema.parse(process.env);
