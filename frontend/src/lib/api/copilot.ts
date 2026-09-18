import { type CopilotAnswer, copilotAnswerSchema } from "../contracts/schemas";
import { ApiError, extractMessageField, jsonBody } from "./client";

/**
 * El Copilot es un servicio Python aparte (`copilot`, docker-compose.yml),
 * no una ruta del backend Node -- por eso tiene su propia base URL en vez de
 * usar `apiRequest`/`API_BASE_URL` (que apuntan al backend). En Docker,
 * nginx reenvía `/copilot/` a ese servicio (ver frontend/docker/nginx.conf);
 * fuera de Docker (`npm run dev`), vite.config.ts hace lo mismo.
 */
const configuredBaseUrl = import.meta.env.VITE_COPILOT_BASE_URL as string | undefined;

export const COPILOT_BASE_URL: string =
  configuredBaseUrl !== undefined && configuredBaseUrl.trim() !== ""
    ? configuredBaseUrl
    : "/copilot";

/**
 * Le hace una pregunta real al Dataset Copilot (POST /query) y valida la
 * respuesta contra `copilotAnswerSchema`. Nunca inventa el mensaje de error:
 * lo toma del cuerpo `{ "error": "..." }` que ya arma `http_app.py` (400
 * pregunta inválida, 502 falló el provider, 503 no configurado) — el mismo
 * patrón que `apiRequest`, replicado aquí porque este servicio vive en una
 * base URL distinta.
 */
export async function askCopilot(question: string): Promise<CopilotAnswer> {
  let res: Response;
  try {
    res = await fetch(`${COPILOT_BASE_URL}/query`, {
      method: "POST",
      ...jsonBody({ question }),
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el Copilot.");
  }

  if (!res.ok) {
    let message = "El Copilot no pudo responder. Intenta de nuevo.";
    try {
      const body: unknown = await res.json();
      message = extractMessageField(body) ?? message;
    } catch {
      // el body no era JSON, se usa el mensaje por defecto
    }
    throw new ApiError(res.status, message);
  }

  const json: unknown = await res.json();
  const parsed = copilotAnswerSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Respuesta inválida del Copilot: ${parsed.error.message}`);
  }
  return parsed.data;
}
