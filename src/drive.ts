/**
 * Integración real con Google Drive vía OAuth (Google Identity Services).
 *
 * Cada usuario inicia sesión con SU propia cuenta de Google y la app
 * guarda/lee un archivo JSON en SU Drive. Se usa el scope
 * `drive.file`: la app solo ve y toca los archivos que ella misma crea
 * — nunca el resto del Drive del usuario.
 *
 * Requisitos para que funcione en producción (ver DEPLOY.md):
 *  1. Crear un proyecto en Google Cloud + un OAuth Client ID (tipo
 *     "aplicación web") y autorizar el origen donde se publica la app
 *     (p. ej. https://tu-proyecto.web.app). OAuth NO funciona abriendo
 *     el archivo local (file://) — hay que servir la app por HTTPS.
 *  2. Pegar ese Client ID en Configuración (se guarda en este navegador).
 *
 * El script de Google (accounts.google.com/gsi/client) se carga desde
 * index.html.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const NOMBRE_ARCHIVO = "beca-rpg-contenido.json";

const K_CLIENT_ID = "beca-rpg:drive-client-id";
const K_FILE_ID = "beca-rpg:drive-file-id";

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpira = 0;

export function leerClientId(): string {
  return localStorage.getItem(K_CLIENT_ID) ?? "";
}
export function guardarClientId(id: string): void {
  localStorage.setItem(K_CLIENT_ID, id.trim());
  tokenClient = null; // fuerza reinicializar con el nuevo id
}

export function driveDisponible(): boolean {
  return typeof (window as any).google?.accounts?.oauth2 !== "undefined";
}

export function haySesionDrive(): boolean {
  return !!accessToken && Date.now() < tokenExpira;
}

/** Pide (o renueva) un token de acceso. Abre el popup de Google la
 *  primera vez. Devuelve el token o lanza un Error. */
export function conectarDrive(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = leerClientId();
    if (!clientId) return reject(new Error("Falta el Client ID de Google. Configúralo primero."));
    if (!driveDisponible()) return reject(new Error("No se cargó el script de Google. Revisa tu conexión y recarga."));

    const g = (window as any).google;
    if (!tokenClient) {
      tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) return reject(new Error(`Google rechazó el acceso: ${resp.error}`));
          accessToken = resp.access_token;
          tokenExpira = Date.now() + (Number(resp.expires_in ?? 3600) - 60) * 1000;
          resolve(accessToken!);
        },
      });
    }
    tokenClient.callback = (resp: any) => {
      if (resp.error) return reject(new Error(`Google rechazó el acceso: ${resp.error}`));
      accessToken = resp.access_token;
      tokenExpira = Date.now() + (Number(resp.expires_in ?? 3600) - 60) * 1000;
      resolve(accessToken!);
    };
    tokenClient.requestAccessToken({ prompt: haySesionDrive() ? "" : "consent" });
  });
}

export function desconectarDrive(): void {
  const g = (window as any).google;
  if (accessToken && g?.accounts?.oauth2?.revoke) g.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  tokenExpira = 0;
}

async function tokenValido(): Promise<string> {
  if (haySesionDrive()) return accessToken!;
  return conectarDrive();
}

/** Busca el archivo de la app en Drive; cachea su id. */
async function buscarArchivo(token: string): Promise<string | null> {
  const cacheado = localStorage.getItem(K_FILE_ID);
  if (cacheado) return cacheado;
  const q = encodeURIComponent(`name='${NOMBRE_ARCHIVO}' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(await errorDrive(r));
  const data = await r.json();
  const id = data.files?.[0]?.id ?? null;
  if (id) localStorage.setItem(K_FILE_ID, id);
  return id;
}

/** Guarda (crea o actualiza) el contenido JSON en Drive. */
export async function guardarEnDrive(contenidoJson: string): Promise<void> {
  const token = await tokenValido();
  const existente = await buscarArchivo(token);
  const metadata = { name: NOMBRE_ARCHIVO, mimeType: "application/json" };
  const limite = "-------beca314159265";
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n` +
    contenidoJson +
    `\r\n--${limite}--`;

  const url = existente
    ? `https://www.googleapis.com/upload/drive/v3/files/${existente}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const r = await fetch(url, {
    method: existente ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${limite}`,
    },
    body: cuerpo,
  });
  if (!r.ok) throw new Error(await errorDrive(r));
  const data = await r.json();
  if (data.id) localStorage.setItem(K_FILE_ID, data.id);
}

/** Lee el contenido JSON desde Drive. Devuelve null si no existe aún. */
export async function cargarDeDrive(): Promise<string | null> {
  const token = await tokenValido();
  const id = await buscarArchivo(token);
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(await errorDrive(r));
  return r.text();
}

async function errorDrive(r: Response): Promise<string> {
  let detalle = "";
  try {
    const j = await r.json();
    detalle = j.error?.message ?? JSON.stringify(j);
  } catch {
    detalle = await r.text().catch(() => "");
  }
  return `Drive respondió ${r.status}: ${detalle || "sin detalle"}`;
}
