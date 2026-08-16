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
import {
  leerConfigIA, guardarConfigIA, MODELOS_SUGERIDOS, NOMBRE_PROVEEDOR,
  type Proveedor, type IAConfig,
} from "./ia";
import {
  leerClientId, guardarClientId, conectarDrive, desconectarDrive,
  guardarEnDrive, cargarDeDrive, driveDisponible,
} from "./drive";

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

        <SeccionPerfiles />
        <SeccionIA />
        <SeccionDrive />

        <p className="etiqueta-mono etiqueta-separador">GUARDAR / RESPALDAR (archivo)</p>
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

/* ============================================================
   Perfiles de becado
   ============================================================ */
function SeccionPerfiles() {
  const { perfiles, crearPerfil, cambiarPerfil, eliminarPerfil } = useStore();
  const [nuevo, setNuevo] = useState("");
  const [abierto, setAbierto] = useState(false);

  return (
    <details className="seccion-config" open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary>👤 Perfiles de becado ({perfiles.lista.length})</summary>
      <p className="aviso-suave">
        Cada becado tiene su propio progreso (XP, misiones, repaso). El contenido
        de estudio (nodos, resúmenes, flashcards) es compartido entre todos.
      </p>
      <ul className="lista-perfiles">
        {perfiles.lista.map((p) => (
          <li key={p.id} className={p.id === perfiles.activo ? "activo" : ""}>
            <button className="perfil-nombre" onClick={() => cambiarPerfil(p.id)}>
              {p.id === perfiles.activo ? "● " : "○ "}{p.nombre}
            </button>
            {perfiles.lista.length > 1 && (
              <button className="boton-secundario chico"
                      onClick={() => { if (confirm(`¿Eliminar el perfil "${p.nombre}" y su progreso? El contenido no se borra.`)) eliminarPerfil(p.id); }}>
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="fila-input-boton">
        <input className="input-linea" value={nuevo} placeholder="Nombre del nuevo becado"
               onChange={(e) => setNuevo(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter" && nuevo.trim()) { crearPerfil(nuevo); setNuevo(""); } }} />
        <button className="boton-principal" style={{ marginTop: 0 }} disabled={!nuevo.trim()}
                onClick={() => { crearPerfil(nuevo); setNuevo(""); }}>
          + Crear
        </button>
      </div>
    </details>
  );
}

/* ============================================================
   Integración de IA (Claude / Gemini / ChatGPT)
   ============================================================ */
function SeccionIA() {
  const [cfg, setCfg] = useState<IAConfig>(() => leerConfigIA());
  const [guardado, setGuardado] = useState(false);

  const proveedores: Proveedor[] = ["anthropic", "google", "openai"];
  const actualizar = (nueva: IAConfig) => { setCfg(nueva); guardarConfigIA(nueva); setGuardado(true); setTimeout(() => setGuardado(false), 1200); };

  return (
    <details className="seccion-config">
      <summary>✨ Inteligencia artificial {cfg.claves[cfg.proveedor]?.trim() ? "· conectada" : "· sin clave"}</summary>
      <p className="aviso-suave">
        Pega tu propia API key para que la app genere resúmenes y flashcards
        automáticamente en el Taller. La clave se guarda solo en este navegador;
        no la uses en un equipo público. El flujo de copiar/pegar sigue disponible
        sin clave.
      </p>

      <label className="campo">
        <span>Proveedor (se prioriza Claude)</span>
        <select value={cfg.proveedor} onChange={(e) => actualizar({ ...cfg, proveedor: e.target.value as Proveedor })}>
          {proveedores.map((p) => <option key={p} value={p}>{NOMBRE_PROVEEDOR[p]}</option>)}
        </select>
      </label>

      <label className="campo">
        <span>API key de {NOMBRE_PROVEEDOR[cfg.proveedor]}</span>
        <input className="input-linea" type="password" autoComplete="off"
               value={cfg.claves[cfg.proveedor]}
               placeholder="pega tu clave aquí"
               onChange={(e) => actualizar({ ...cfg, claves: { ...cfg.claves, [cfg.proveedor]: e.target.value } })} />
      </label>

      <label className="campo">
        <span>Modelo</span>
        <select
          value={MODELOS_SUGERIDOS[cfg.proveedor].includes(cfg.modelos[cfg.proveedor]) ? cfg.modelos[cfg.proveedor] : "__otro__"}
          onChange={(e) => {
            const v = e.target.value;
            actualizar({ ...cfg, modelos: { ...cfg.modelos, [cfg.proveedor]: v === "__otro__" ? "" : v } });
          }}>
          {MODELOS_SUGERIDOS[cfg.proveedor].map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__otro__">Personalizado…</option>
        </select>
      </label>
      {!MODELOS_SUGERIDOS[cfg.proveedor].includes(cfg.modelos[cfg.proveedor]) && (
        <label className="campo">
          <span>Nombre del modelo (personalizado)</span>
          <input className="input-linea" value={cfg.modelos[cfg.proveedor]}
                 placeholder="ej: claude-sonnet-5"
                 onChange={(e) => actualizar({ ...cfg, modelos: { ...cfg.modelos, [cfg.proveedor]: e.target.value } })} />
        </label>
      )}

      {guardado && <p className="aviso-ok">Guardado.</p>}
      <p className="nota-fina">
        Claude: consola de Anthropic · Gemini: Google AI Studio · ChatGPT: platform.openai.com
      </p>
    </details>
  );
}

/* ============================================================
   Google Drive (respaldo en la nube del propio usuario)
   ============================================================ */
function SeccionDrive() {
  const { exportarEstado, importarEstado } = useStore();
  const [clientId, setClientId] = useState(() => leerClientId());
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const guardarId = () => { guardarClientId(clientId); setAviso("Client ID guardado."); };

  const subir = async () => {
    setCargando(true); setAviso(null);
    try {
      await conectarDrive();
      await guardarEnDrive(exportarEstado());
      setAviso("Guardado en tu Google Drive ✓");
    } catch (e: any) { setAviso(e.message); } finally { setCargando(false); }
  };

  const bajar = async () => {
    setCargando(true); setAviso(null);
    try {
      await conectarDrive();
      const json = await cargarDeDrive();
      if (json === null) { setAviso("No hay respaldo en tu Drive todavía."); }
      else { importarEstado(json); setAviso("Restaurado desde tu Google Drive ✓"); }
    } catch (e: any) { setAviso(e.message); } finally { setCargando(false); }
  };

  return (
    <details className="seccion-config">
      <summary>☁️ Google Drive {leerClientId() ? "" : "· sin configurar"}</summary>
      <p className="aviso-suave">
        Inicia sesión con tu cuenta de Google para guardar y restaurar tu
        contenido y progreso en <strong>tu</strong> Drive. Requiere un Client ID
        de Google (ver DEPLOY.md) y que la app esté publicada por HTTPS.
      </p>

      <label className="campo">
        <span>Google OAuth Client ID</span>
        <div className="fila-input-boton">
          <input className="input-linea" value={clientId}
                 placeholder="xxxxxxxx.apps.googleusercontent.com"
                 onChange={(e) => setClientId(e.target.value)} />
          <button className="boton-secundario chico" onClick={guardarId}>Guardar</button>
        </div>
      </label>

      {!driveDisponible() && (
        <p className="nota-fina">
          El script de Google no está cargado (¿sin conexión, o abriste el archivo
          local?). Publica la app por HTTPS para usar Drive.
        </p>
      )}

      <div className="fila-botones">
        <button className="boton-principal" style={{ marginTop: 0 }} disabled={cargando || !leerClientId()} onClick={subir}>
          {cargando ? "…" : "⬆ Guardar en Drive"}
        </button>
        <button className="boton-secundario" disabled={cargando || !leerClientId()} onClick={bajar}>
          ⬇ Restaurar de Drive
        </button>
      </div>
      <button className="boton-secundario chico" style={{ marginTop: 8 }} onClick={() => { desconectarDrive(); setAviso("Sesión de Drive cerrada."); }}>
        Cerrar sesión de Google
      </button>

      {aviso && <p className="aviso-suave" style={{ marginTop: 10 }}>{aviso}</p>}
    </details>
  );
}
