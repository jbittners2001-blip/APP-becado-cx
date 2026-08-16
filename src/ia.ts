/**
 * Integración de IA multi-proveedor, del lado del navegador.
 *
 * El usuario pega SU PROPIA API key (de Claude, Gemini o ChatGPT) en
 * Configuración; se guarda solo en este navegador (localStorage) y la
 * app llama directamente a la API del proveedor elegido para generar
 * megaresúmenes y flashcards. Prioriza Claude (Anthropic), pero deja
 * elegir cualquiera. El flujo de copiar/pegar sigue disponible como
 * respaldo (no requiere clave).
 *
 * Nota de seguridad: la clave vive en TU navegador. No la uses en un
 * equipo público compartido.
 */

export type Proveedor = "anthropic" | "google" | "openai";

export interface IAConfig {
  proveedor: Proveedor;
  claves: Record<Proveedor, string>;
  modelos: Record<Proveedor, string>;
}

export const NOMBRE_PROVEEDOR: Record<Proveedor, string> = {
  anthropic: "Claude (Anthropic)",
  google: "Gemini (Google)",
  openai: "ChatGPT (OpenAI)",
};

/** Modelos sugeridos por proveedor (editables por el usuario). El primero
 *  es el valor por defecto. Se dejan como texto libre porque los IDs
 *  cambian seguido. */
export const MODELOS_SUGERIDOS: Record<Proveedor, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-opus-5", "claude-opus-4-8", "claude-haiku-4-5"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest", "gemini-pro-latest"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
};

const K_IA = "beca-rpg:ia";

export function configVacia(): IAConfig {
  return {
    proveedor: "anthropic",
    claves: { anthropic: "", google: "", openai: "" },
    modelos: {
      anthropic: MODELOS_SUGERIDOS.anthropic[0],
      google: MODELOS_SUGERIDOS.google[0],
      openai: MODELOS_SUGERIDOS.openai[0],
    },
  };
}

export function leerConfigIA(): IAConfig {
  try {
    const crudo = localStorage.getItem(K_IA);
    if (!crudo) return configVacia();
    const base = configVacia();
    const guardado = JSON.parse(crudo) as Partial<IAConfig>;
    return {
      proveedor: guardado.proveedor ?? base.proveedor,
      claves: { ...base.claves, ...(guardado.claves ?? {}) },
      modelos: { ...base.modelos, ...(guardado.modelos ?? {}) },
    };
  } catch {
    return configVacia();
  }
}

export function guardarConfigIA(cfg: IAConfig): void {
  localStorage.setItem(K_IA, JSON.stringify(cfg));
}

/** ¿Hay una clave para el proveedor activo? */
export function hayClaveActiva(cfg: IAConfig): boolean {
  return !!cfg.claves[cfg.proveedor]?.trim();
}

/* ------------------------------------------------------------------ */

async function generarAnthropic(clave: string, modelo: string, prompt: string, maxTokens: number): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
      // Permite llamar la API directo desde el navegador (CORS).
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(await mensajeError(r));
  const data = await r.json();
  const bloque = (data.content ?? []).find((b: any) => b.type === "text");
  return bloque?.text ?? "";
}

async function generarGoogle(clave: string, modelo: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!r.ok) throw new Error(await mensajeError(r));
  const data = await r.json();
  const partes = data.candidates?.[0]?.content?.parts ?? [];
  return partes.map((p: any) => p.text ?? "").join("");
}

async function generarOpenAI(clave: string, modelo: string, prompt: string, maxTokens: number): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(await mensajeError(r));
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function mensajeError(r: Response): Promise<string> {
  let detalle = "";
  try {
    const j = await r.json();
    detalle = j.error?.message || j.error?.type || JSON.stringify(j.error ?? j);
  } catch {
    detalle = await r.text().catch(() => "");
  }
  if (r.status === 401 || r.status === 403)
    return `Clave rechazada (${r.status}). Revisa tu API key en Configuración. ${detalle}`;
  if (r.status === 404)
    return `Modelo no encontrado (404). Revisa el nombre del modelo. ${detalle}`;
  if (r.status === 429)
    return `Límite de uso alcanzado (429). Espera un momento y reintenta. ${detalle}`;
  return `Error ${r.status}: ${detalle || "sin detalle"}`;
}

/** Genera texto con el proveedor activo. Lanza Error con mensaje claro. */
export async function generarConIA(
  cfg: IAConfig, prompt: string, opciones?: { maxTokens?: number }
): Promise<string> {
  const clave = cfg.claves[cfg.proveedor]?.trim();
  if (!clave) throw new Error(`No hay API key configurada para ${NOMBRE_PROVEEDOR[cfg.proveedor]}.`);
  const modelo = cfg.modelos[cfg.proveedor]?.trim() || MODELOS_SUGERIDOS[cfg.proveedor][0];
  const maxTokens = opciones?.maxTokens ?? 4096;

  switch (cfg.proveedor) {
    case "anthropic": return generarAnthropic(clave, modelo, prompt, maxTokens);
    case "google":    return generarGoogle(clave, modelo, prompt, maxTokens);
    case "openai":    return generarOpenAI(clave, modelo, prompt, maxTokens);
  }
}
