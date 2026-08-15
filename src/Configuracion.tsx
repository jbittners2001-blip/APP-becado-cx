/**
 * Configuración y respaldo — global, fuera del Taller. Aquí se
 * elige QUÉ exportar (todo / una especialidad / un nodo con todo lo
 * que contiene) y, cuando el navegador lo permite, DÓNDE guardarlo
 * exactamente (ver fileIO.ts). Importar nunca modifica el archivo
 * original: crea una copia propia en este navegador.
 */
import { useState } from "react";
import { useStore } from "./store";
import { descendientesDe } from "./content";
import type { ContenidoUsuario, Nodo, Flashcard } from "./types";
import { hoyISO } from "./srs";
import { guardarArchivo, abrirArchivo, soportaSelectorDeArchivos } from "./fileIO";

type Alcance = "todo" | "especialidad" | "dominio";

export function Configuracion({ onCerrar }: { onCerrar: () => void }) {
  const { nodos, contenidoUsuario, importarContenido } = useStore();
  const especialidades = nodos.filter((n) => n.parent === null);
  const dominios = nodos.filter((n) => n.clase === "dominio" && n.parent !== null);

  const [alcance, setAlcance] = useState<Alcance>("todo");
  const [especialidadElegida, setEspecialidadElegida] = useState(especialidades[0]?.id ?? "");
  const [dominioElegido, setDominioElegido] = useState(dominios[0]?.id ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const soportaPicker = soportaSelectorDeArchivos();
  const totalCards = Object.values(contenidoUsuario.cards).reduce((a, l) => a + l.length, 0);

  const construirPayload = (): ContenidoUsuario => {
    if (alcance === "todo") return contenidoUsuario;

    const raizId = alcance === "especialidad" ? especialidadElegida : dominioElegido;
    if (!raizId) return { ...contenidoUsuario, nodos: [], cards: {} };

    const idsSubarbol = new Set([raizId, ...descendientesDe(nodos, raizId).map((d) => d.id)]);
    const nodosExport: Nodo[] = contenidoUsuario.nodos
      .filter((n) => idsSubarbol.has(n.id))
      .map((n) => (n.id === raizId && alcance === "dominio") ? { ...n, parent: null } : n);
    const cardsExport: Record<string, Flashcard[]> = {};
    for (const [id, cards] of Object.entries(contenidoUsuario.cards))
      if (idsSubarbol.has(id)) cardsExport[id] = cards;

    return {
      version: contenidoUsuario.version, nodos: nodosExport, cards: cardsExport,
      nodosOcultos: [], parentOverrides: {}, papelera: [],
    };
  };

  const nombreAlcance = alcance === "todo" ? "todo"
    : alcance === "especialidad" ? nodos.find((n) => n.id === especialidadElegida)?.titulo
    : nodos.find((n) => n.id === dominioElegido)?.titulo;

  const exportar = async () => {
    setGuardando(true);
    const payload = construirPayload();
    const nombre = `beca-rpg-${(nombreAlcance || "contenido").toLowerCase().replace(/\s+/g, "-")}-${hoyISO()}.json`;
    const ok = await guardarArchivo(nombre, JSON.stringify(payload, null, 2));
    setGuardando(false);
    setAviso(ok ? "Guardado." : null);
  };

  const procesarImportacion = (texto: string) => {
    try {
      const datos = JSON.parse(texto);
      if (!Array.isArray(datos.nodos)) throw new Error("estructura inválida");
      importarContenido(datos);
      setAviso(`Importado: ${datos.nodos.length} nodos.`);
    } catch (e: any) {
      setAviso(`Archivo inválido (${e.message}).`);
    }
  };

  const importar = async () => {
    const texto = await abrirArchivo();
    if (texto !== null) procesarImportacion(texto);
  };

  const importarClasico = (f: File) => {
    const r = new FileReader();
    r.onload = () => procesarImportacion(String(r.result));
    r.readAsText(f);
  };

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <span className="chip">Configuración y respaldo</span>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="stats-taller">
          <div><strong>{contenidoUsuario.nodos.length}</strong><span>nodos creados</span></div>
          <div><strong>{totalCards}</strong><span>flashcards</span></div>
          <div><strong>{contenidoUsuario.papelera.length}</strong><span>en papelera</span></div>
        </div>

        <p className="etiqueta-mono etiqueta-separador">GUARDAR / RESPALDAR</p>
        <p className="aviso-suave">
          {soportaPicker
            ? "Tu navegador te deja elegir exactamente dónde guardar. Si usas Google Drive para escritorio, navega directo a tu carpeta sincronizada — eso lo deja en Drive."
            : "Este navegador no permite elegir carpeta; el archivo cae en tu carpeta de descargas de siempre. Si esa carpeta está sincronizada con Drive, igual queda respaldado ahí."}
        </p>

        <label className="campo">
          <span>Qué exportar</span>
          <select value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)}>
            <option value="todo">Todo mi contenido</option>
            <option value="especialidad">Una especialidad completa</option>
            <option value="dominio">Un nodo y todo lo que contiene</option>
          </select>
        </label>

        {alcance === "especialidad" && (
          <label className="campo">
            <span>Especialidad</span>
            <select value={especialidadElegida} onChange={(e) => setEspecialidadElegida(e.target.value)}>
              {especialidades.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
            </select>
          </label>
        )}
        {alcance === "dominio" && (
          <label className="campo">
            <span>Nodo</span>
            <select value={dominioElegido} onChange={(e) => setDominioElegido(e.target.value)}>
              {dominios.map((d) => <option key={d.id} value={d.id}>{d.titulo} — {d.id}</option>)}
            </select>
          </label>
        )}

        <button className="boton-principal" disabled={guardando} onClick={exportar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>

        <p className="etiqueta-mono etiqueta-separador">CARGAR CONTENIDO</p>
        <p className="aviso-suave">
          Sirve para restaurar un respaldo tuyo, o para partir de la carpeta de
          otro becado sin tocar la suya: al importar, queda una copia en TU
          navegador — nada de lo que hagas después modifica el archivo original.
        </p>
        {soportaPicker ? (
          <button className="boton-secundario" onClick={importar}>Elegir archivo…</button>
        ) : (
          <label className="subir-archivo">
            Elegir archivo .json
            <input type="file" accept=".json"
                   onChange={(e) => e.target.files?.[0] && importarClasico(e.target.files[0])} />
          </label>
        )}

        {aviso && <p className="aviso-ok">{aviso}</p>}

        <p className="nota-fina" style={{ marginTop: 18 }}>
          Importar reemplaza todo el contenido de este navegador por el del
          archivo. Respalda antes si tienes algo sin guardar.
        </p>
      </aside>
    </div>
  );
}
