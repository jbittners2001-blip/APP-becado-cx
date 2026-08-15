/**
 * Acceso a archivos usando la File System Access API cuando el
 * navegador la soporta (Chrome, Edge): deja elegir la carpeta o el
 * archivo EXACTO — por ejemplo, navegar directo a una carpeta
 * sincronizada con Google Drive Desktop — en vez de solo descargar
 * a la carpeta de descargas por defecto. Con fallback automático a
 * la descarga/selección clásica donde no está disponible (Firefox,
 * Safari).
 *
 * Esto NO es integración con la API de Google Drive (eso requiere
 * OAuth y un backend, fuera del alcance de un archivo estático). Es
 * el equivalente más honesto que se puede lograr solo con el
 * navegador: si el usuario tiene Drive sincronizado como carpeta
 * local, elegir esa carpeta aquí equivale a guardar en Drive.
 */

export async function guardarArchivo(nombreSugerido: string, contenido: string): Promise<boolean> {
  const w = window as any;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: nombreSugerido,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(contenido);
      await writable.close();
      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false; // el usuario canceló, no seguir al fallback
      // cualquier otro error: cae al método clásico
    }
  }
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombreSugerido; a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Devuelve el texto del archivo elegido, o null si el usuario
 *  canceló o el navegador no soporta el selector (el llamador debe
 *  tener un <input type="file"> de respaldo para ese caso). */
export async function abrirArchivo(): Promise<string | null> {
  const w = window as any;
  if (!w.showOpenFilePicker) return null;
  try {
    const [handle] = await w.showOpenFilePicker({
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
    });
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export function soportaSelectorDeArchivos(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}
