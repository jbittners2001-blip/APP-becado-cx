/**
 * TALLER DE CONTENIDO — el ciclo de autoría, racionalizado.
 *
 *   1. Fuentes: subes el material crudo a la carpeta de fuentes del
 *      nodo. El Taller arma el prompt para generar el megaresumen.
 *   2. Nodos: el megaresumen se analiza en DOS grupos, nunca
 *      mezclados:
 *        - ASPECTOS del nodo mismo (anatomía/fisiología, criterio de
 *          indicación, técnica y complicaciones): se crean SIEMPRE
 *          los 3, en orden progresivo, con el contenido que el
 *          megaresumen ya trae para cada uno.
 *        - SUBTEMAS: entidades específicas (ej. "Colecistitis",
 *          "Colgajo sural reverso") que merecen su propio tema
 *          completo aparte. Máximo ~5 sugeridos por nivel — para eso
 *          está el criterio de agrupación, no todo lo que aparece en
 *          el megaresumen necesita nodo propio.
 *   3. Flashcards: dificultad y dirección a elección.
 *
 *   Exportar/importar vive en Configuración (global), no aquí.
 */
import { useMemo, useState } from "react";
import { useStore } from "./store";
import {
  aSlug, nuevoId, type Flashcard, type Nodo, type TipoNodo, type EscalaEvaluacion,
} from "./types";
import { hoyISO } from "./srs";
import { leerConfigIA, hayClaveActiva, generarConIA, NOMBRE_PROVEEDOR } from "./ia";

type Pestana = "fuentes" | "nodos" | "cards";
const MAX_SUBTEMAS_SUGERIDOS = 5;

const PALABRAS_ASPECTO: Record<"anatomia" | "criterio" | "tecnica", RegExp> = {
  anatomia: /anatom|vascular|irrigac|angiosom|inervac|fisiolog|embriolog/i,
  criterio: /indicac|criterio|selecc|contraindic|epidemiolog|factor(es)? de riesgo|contexto( |$)|generalidades|definici[oó]n|clasificac|etiolog/i,
  tecnica: /t[eé]cnic|paso|dise[ñn]|disecc|abordaje|marcaci|complicac|manejo|tratamiento|postoperat|rescate|falla|necrosis|congesti/i,
};

function claseSeccion(titulo: string): "anatomia" | "criterio" | "tecnica" | "subtema" {
  if (PALABRAS_ASPECTO.anatomia.test(titulo)) return "anatomia";
  if (PALABRAS_ASPECTO.criterio.test(titulo)) return "criterio";
  if (PALABRAS_ASPECTO.tecnica.test(titulo)) return "tecnica";
  return "subtema";
}

const PARTES_ESTANDAR: { suf: string; tit: string; tipo: TipoNodo; esc: EscalaEvaluacion }[] = [
  { suf: "anatomia", tit: "Anatomía y fisiología", tipo: "anatomia", esc: "miller" },
  { suf: "criterio", tit: "Criterio de indicación", tipo: "criterio", esc: "miller" },
  { suf: "tecnica", tit: "Técnica y complicaciones", tipo: "tecnica", esc: "zwisch" },
];

interface PropuestaSubtema {
  elegido: boolean;
  titulo: string;
  slug: string;
  cuerpo: string;
  palabras: number;
}

interface AspectosDetectados {
  anatomia: string[];
  criterio: string[];
  tecnica: string[];
}

export function Taller({
  parentId, onCerrar, onIrANodo,
}: {
  parentId: string;
  onCerrar: () => void;
  onIrANodo: (id: string) => void;
}) {
  const { indice, resumenDe } = useStore();
  const padre = indice.get(parentId);
  const [pestana, setPestana] = useState<Pestana>(
    () => (padre && resumenDe(padre.id).trim() ? (padre.clase === "estudio" ? "fuentes" : "nodos") : "fuentes")
  );

  if (!padre) return null;

  // Si el padre es un nodo de ESTUDIO (hoja), el Taller solo sirve
  // para gestionar su contenido propio (fuentes + flashcards).
  // La creación de nodos hijos solo tiene sentido en DOMINIOS.
  const soloContenido = padre.clase === "estudio";

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <span className="chip chip-taller">TALLER DE CONTENIDO</span>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        <h2 className="modal-titulo">{padre.titulo}</h2>
        <p className="modal-id">{padre.id}</p>

        {soloContenido && (
          <p className="aviso-suave" style={{ marginBottom: 14 }}>
            Este es un nodo de estudio (hoja). Para crear la estructura de nodos hijos,
            abre el Taller desde el dominio padre
            {" "}<strong>{indice.get(padre.parent ?? "")?.titulo ?? "nivel superior"}</strong>.
            Aquí puedes gestionar las fuentes y flashcards de este nodo.
          </p>
        )}

        <nav className="pestanas">
          <button className={pestana === "fuentes" ? "pestana activa" : "pestana"}
                  onClick={() => setPestana("fuentes")}>
            {soloContenido ? "1" : "1"} · Fuentes
          </button>
          {!soloContenido && (
            <button className={pestana === "nodos" ? "pestana activa" : "pestana"}
                    onClick={() => setPestana("nodos")}>2 · Nodos</button>
          )}
          <button className={pestana === "cards" ? "pestana activa" : "pestana"}
                  onClick={() => setPestana("cards")}>
            {soloContenido ? "2" : "3"} · Flashcards
          </button>
        </nav>

        {pestana === "fuentes" && <PasoFuentes padre={padre} />}
        {pestana === "nodos" && <PasoNodos padre={padre} onIrANodo={onIrANodo} />}
        {pestana === "cards" && <PasoCards padre={padre} />}
      </aside>
    </div>
  );
}

/* ============================================================
   PASO 1 — Carpeta de fuentes → prompt de megaresumen
   ============================================================ */

function PasoFuentes({ padre }: { padre: Nodo }) {
  const { fuentesDe, agregarFuente, eliminarFuente, resumenDe, guardarResumen } = useStore();
  const fuentes = fuentesDe(padre.id);
  const [nombre, setNombre] = useState("");
  const [texto, setTexto] = useState("");
  const [mostrarPrompt, setMostrarPrompt] = useState(fuentes.length > 0 || !!resumenDe(padre.id));
  const [megaresumen, setMegaresumen] = useState(resumenDe(padre.id) || "");
  const [copiado, setCopiado] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [iaCargando, setIaCargando] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const cfgIA = leerConfigIA();

  const agregar = () => {
    if (!texto.trim()) return;
    agregarFuente(padre.id, nombre.trim() || `Fuente ${fuentes.length + 1}`, texto.trim());
    setNombre(""); setTexto("");
  };

  const cargarArchivo = (f: File) => {
    const r = new FileReader();
    r.onload = () => { setTexto(String(r.result)); if (!nombre) setNombre(f.name); };
    r.readAsText(f);
  };

  const promptMega = useMemo(() => {
    const cuerpo = fuentes.map((f, i) => `--- FUENTE ${i + 1}: ${f.nombre} ---\n${f.contenido}`).join("\n\n");
    return [
      `Actúa como docente de cirugía preparando material de estudio para un becado.`,
      `Con las fuentes que van al final, redacta un MEGARESUMEN sobre "${padre.titulo}" en español, estructurado con encabezados ## por subtema.`,
      ``,
      `ESTRUCTURA OBLIGATORIA — usa estos encabezados exactos si el contenido lo permite:`,
      `## Anatomía y fisiología`,
      `## Criterio de indicación`,
      `## Técnica y complicaciones`,
      `Luego, agrega un encabezado ## aparte por cada entidad, patología o técnica ESPECÍFICA que merezca su propio desarrollo (ej. "## Colecistitis", "## Colgajo sural reverso") — pero sé selectivo: máximo ${MAX_SUBTEMAS_SUGERIDOS} de estas secciones específicas. Si hay más de ${MAX_SUBTEMAS_SUGERIDOS} candidatas, agrupa las menos relevantes dentro de una sección general en vez de darles encabezado propio.`,
      ``,
      `REGLAS:`,
      `- Rigor clínico, sin inventar datos que no estén en las fuentes.`,
      `- Cuando una fuente dé una cifra o cita, consérvala.`,
      `- Extensión libre, prioriza cobertura completa sobre brevedad.`,
      ``,
      fuentes.length
        ? `--- FUENTES ---\n${cuerpo}`
        : `(No agregaste fuentes: redacta desde tu conocimiento general, marcando con [verificar] cualquier cifra de la que no estés seguro.)`,
    ].join("\n");
  }, [fuentes, padre.titulo]);

  const copiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptMega);
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch { /* portapapeles bloqueado, el usuario puede seleccionar a mano */ }
  };

  const guardar = () => {
    guardarResumen(padre.id, megaresumen);
    setGuardadoOk(true); setTimeout(() => setGuardadoOk(false), 1600);
  };

  const generarIA = async () => {
    setIaCargando(true); setIaError(null);
    try {
      const texto = await generarConIA(cfgIA, promptMega, { maxTokens: 8000 });
      setMegaresumen(texto.trim());
    } catch (e: any) {
      setIaError(e.message || "No se pudo generar.");
    } finally {
      setIaCargando(false);
    }
  };

  return (
    <div className="paso">
      <p className="aviso-suave">
        Carpeta de fuentes de <strong>{padre.titulo}</strong>: el material crudo
        (papers, capítulos, apuntes) que respalda su resumen.
      </p>

      {fuentes.length > 0 && (
        <ul className="lista-fuentes">
          {fuentes.map((f) => (
            <li key={f.id}>
              <div>
                <strong>{f.nombre}</strong>
                <span className="nota-fina"> · {f.contenido.split(/\s+/).length} palabras · {f.agregadoEl}</span>
              </div>
              <button className="boton-secundario chico" onClick={() => eliminarFuente(padre.id, f.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="campo">
        <span>Nombre de la fuente</span>
        <input className="input-linea" value={nombre} onChange={(e) => setNombre(e.target.value)}
               placeholder="Ej: Grabar 2020, capítulo de colgajos" />
      </label>
      <label className="subir-archivo">
        Subir archivo .txt / .md
        <input type="file" accept=".txt,.md,.markdown"
               onChange={(e) => e.target.files?.[0] && cargarArchivo(e.target.files[0])} />
      </label>
      <textarea className="area-mega" rows={7} placeholder="Pega aquí el texto de la fuente…"
                value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button className="boton-secundario" disabled={!texto.trim()} onClick={agregar}>
        Agregar a la carpeta de fuentes
      </button>

      <div className="separador-taller" />

      <button className="boton-principal" onClick={() => setMostrarPrompt((s) => !s)}>
        {mostrarPrompt ? "Ocultar" : "Generar"} prompt de megaresumen
      </button>

      {mostrarPrompt && (
        <>
          <div className="caja-prompt">
            <div className="caja-prompt-cabecera">
              <span className="etiqueta-mono">PROMPT PARA CLAUDE</span>
              <button className="boton-secundario chico" onClick={copiarPrompt}>
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
            <pre className="prompt-texto">{promptMega}</pre>
          </div>

          <div className="fila-ia">
            {hayClaveActiva(cfgIA) ? (
              <button className="boton-ia" disabled={iaCargando} onClick={generarIA}>
                {iaCargando ? "Generando…" : `✨ Generar con ${NOMBRE_PROVEEDOR[cfgIA.proveedor]}`}
              </button>
            ) : (
              <p className="nota-fina">
                Configura una API key en ⚙ Configuración para generar el resumen
                automáticamente, o copia el prompt y pégalo en tu IA.
              </p>
            )}
          </div>
          {iaError && <p className="aviso-suave">{iaError}</p>}

          <label className="campo">
            <span>Pega aquí el megaresumen resultante (carpeta de resúmenes)</span>
            <textarea className="area-mega" rows={10} value={megaresumen}
                      onChange={(e) => setMegaresumen(e.target.value)} />
          </label>
          <div className="fila-botones">
            <button className="boton-secundario" disabled={!megaresumen} onClick={() => setMegaresumen("")}>
              Vaciar
            </button>
            <button className="boton-principal" disabled={!megaresumen.trim()} onClick={guardar}>
              {guardadoOk ? "Guardado ✓" : "Guardar como resumen de este nodo"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   PASO 2 — Megaresumen → aspectos automáticos + subtemas (máx. 5)
   ============================================================ */

function PasoNodos({ padre, onIrANodo }: { padre: Nodo; onIrANodo: (id: string) => void }) {
  const { indice, hijos, crearNodos, actualizarNodo, guardarResumen, resumenDe } = useStore();
  const existentes = hijos(padre.id);
  const [mega, setMega] = useState(resumenDe(padre.id) || "");
  const [aspectos, setAspectos] = useState<AspectosDetectados | null>(null);
  const [propuestas, setPropuestas] = useState<PropuestaSubtema[] | null>(null);
  const [encadenar, setEncadenar] = useState(true);
  const [creados, setCreados] = useState<string[] | null>(null);

  const idUnico = (slug: string) => {
    let candidato = `${padre.id}.${slug}`;
    let n = 2;
    while (indice.has(candidato)) candidato = `${padre.id}.${slug}_${n++}`;
    return candidato;
  };

  const analizar = () => {
    const lineas = mega.split("\n");
    const secciones: { titulo: string; cuerpo: string[] }[] = [];
    for (const l of lineas) {
      const h = l.match(/^(#{2,3})\s+(.+?)\s*$/);
      if (h) secciones.push({ titulo: h[2].replace(/[*_`]/g, "").trim(), cuerpo: [] });
      else if (secciones.length) secciones[secciones.length - 1].cuerpo.push(l);
    }
    const det: AspectosDetectados = { anatomia: [], criterio: [], tecnica: [] };
    const candidatas: { titulo: string; cuerpo: string }[] = [];
    for (const s of secciones) {
      const cuerpoTxt = s.cuerpo.join("\n").trim();
      if (!cuerpoTxt || s.titulo.length < 3) continue;
      const clase = claseSeccion(s.titulo);
      if (clase === "subtema") candidatas.push({ titulo: s.titulo, cuerpo: cuerpoTxt });
      else det[clase].push(`### ${s.titulo}\n${cuerpoTxt}`);
    }
    const ordenadas = candidatas
      .map((c) => ({ ...c, palabras: c.cuerpo.split(/\s+/).length }))
      .sort((a, b) => b.palabras - a.palabras);
    setAspectos(det);
    setPropuestas(ordenadas.map((c, i) => ({
      elegido: i < MAX_SUBTEMAS_SUGERIDOS,
      titulo: c.titulo, slug: aSlug(c.titulo), cuerpo: c.cuerpo, palabras: c.palabras,
    })));
  };

  const confirmar = () => {
    if (!aspectos || !propuestas) return;
    const nuevos: Nodo[] = [];
    const idsUsados = new Set<string>();
    const idLocal = (slug: string) => {
      let c = idUnico(slug);
      while (idsUsados.has(c)) c = idUnico(slug + "_x");
      idsUsados.add(c);
      return c;
    };

    // 1. Los 3 aspectos estándar, SIEMPRE, en orden progresivo, encadenados.
    //    Si el nodo ya tenía alguno, se le AÑADE el contenido nuevo sin duplicar el nodo.
    const contenidoPorAspecto = { anatomia: aspectos.anatomia.join("\n\n"), criterio: aspectos.criterio.join("\n\n"), tecnica: aspectos.tecnica.join("\n\n") } as const;
    let anteriorAspecto: string | null = null;
    const aspectoIds: string[] = [];
    for (const p of PARTES_ESTANDAR) {
      const id = `${padre.id}.${p.suf}`;
      const contenido = contenidoPorAspecto[p.suf as keyof typeof contenidoPorAspecto];
      if (indice.has(id)) {
        if (contenido.trim()) {
          const previo = resumenDe(id);
          actualizarNodo(id, { resumen: previo ? `${previo}\n\n${contenido}` : contenido });
        }
      } else {
        nuevos.push({
          id, titulo: p.tit, clase: "estudio", parent: padre.id, tipo: p.tipo, escala: p.esc,
          prerequisitos: anteriorAspecto ? [anteriorAspecto] : [], xp: 110, origen: "taller",
          resumen: contenido || undefined,
        });
      }
      aspectoIds.push(id);
      anteriorAspecto = id;
    }

    // 2. Los subtemas elegidos: SIEMPRE tema completo (nunca nodo suelto).
    const elegidas = propuestas.filter((p) => p.elegido);
    let anteriorTema: string | null = encadenar ? anteriorAspecto : null;
    const temaIds: string[] = [];
    for (const p of elegidas) {
      const idTema = idLocal(p.slug);
      const temaNode: Nodo = {
        id: idTema, titulo: p.titulo, clase: "dominio", parent: padre.id, tipo: null, escala: null,
        prerequisitos: anteriorTema ? [anteriorTema] : [], xp: 0, origen: "taller",
        fuentes: [{ id: nuevoId(), nombre: "Extracto del megaresumen", contenido: p.cuerpo, agregadoEl: hoyISO() }],
      };
      let prevHijo: string | null = null;
      const hijosTema: Nodo[] = PARTES_ESTANDAR.map((h) => {
        const hid = `${idTema}.${h.suf}`;
        const nn: Nodo = {
          id: hid, titulo: h.tit, clase: "estudio", parent: idTema, tipo: h.tipo, escala: h.esc,
          prerequisitos: prevHijo ? [prevHijo] : [], xp: 110, origen: "taller",
        };
        prevHijo = hid;
        return nn;
      });
      nuevos.push(temaNode, ...hijosTema);
      temaIds.push(idTema);
      anteriorTema = idTema;
    }

    if (mega.trim()) guardarResumen(padre.id, mega);
    crearNodos(nuevos);
    setCreados([...aspectoIds, ...temaIds]);
    setPropuestas(null);
    setAspectos(null);
  };

  if (creados)
    return (
      <div className="fin-sesion">
        <p className="aviso-ok">
          Estructura lista bajo {padre.titulo}: 3 aspectos + {creados.length - 3} subtema(s).
        </p>
        <ul className="lista-creados">
          {creados.map((id) => (
            <li key={id}><button onClick={() => onIrANodo(id)}>{indice.get(id)?.titulo ?? id}</button></li>
          ))}
        </ul>
        <p className="aviso-suave">
          Los 3 aspectos ya traen el contenido que encontré en el megaresumen
          para cada uno — revísalo y complétalo. Cada subtema quedó en blanco,
          listo para que le subas su propia carpeta de fuentes y generes su
          resumen específico. Luego, pestaña 3 para sus flashcards.
        </p>
        <button className="boton-secundario" onClick={() => setCreados(null)}>Analizar de nuevo</button>
      </div>
    );

  if (!propuestas || !aspectos)
    return (
      <div className="paso">
        <p className="aviso-suave">
          Este es el megaresumen de <strong>{padre.titulo}</strong>. Al
          analizarlo: sus secciones de anatomía, criterio y técnica se
          convierten DIRECTAMENTE en los 3 nodos estándar de este nivel; el
          resto de entidades específicas (ej. "Colecistitis") se proponen
          aparte como temas completos — máximo {MAX_SUBTEMAS_SUGERIDOS}
          sugeridos, para no fragmentar de más un paper chico.
        </p>
        {existentes.length > 0 && (
          <p className="nota-fina">
            Ya existen {existentes.length} nodos hijos: {existentes.map((e) => e.titulo).join(" · ")}
          </p>
        )}
        <label className="subir-archivo">
          Subir archivo .md o .txt
          <input type="file" accept=".md,.txt,.markdown"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (!f) return;
                   const r = new FileReader();
                   r.onload = () => setMega(String(r.result));
                   r.readAsText(f);
                 }} />
        </label>
        <textarea
          className="area-mega"
          placeholder={"## Anatomía y fisiología\n…\n\n## Criterio de indicación\n…\n\n## Técnica y complicaciones\n…\n\n## Colgajo sural reverso\nEl colgajo sural reverso es…"}
          value={mega} onChange={(e) => setMega(e.target.value)} rows={14}
        />
        <p className="nota-fina">
          {mega.trim() ? `${mega.trim().split(/\s+/).length} palabras` : "Sin texto aún"}
        </p>
        <div className="fila-botones">
          <button className="boton-secundario" disabled={!mega} onClick={() => setMega("")}>Vaciar</button>
          <button className="boton-principal" disabled={mega.trim().length < 80} onClick={analizar}>
            Analizar y proponer estructura
          </button>
        </div>
      </div>
    );

  const nSeleccionados = propuestas.filter((p) => p.elegido).length;

  return (
    <div className="paso">
      <p className="etiqueta-mono">SE CREARÁN AUTOMÁTICAMENTE, EN ORDEN</p>
      <div className="chips-aspectos">
        <span className={aspectos.anatomia.length ? "chip-aspecto con-contenido" : "chip-aspecto"}>
          1 · Anatomía y fisiología{!aspectos.anatomia.length && " (vacío)"}
        </span>
        <span className={aspectos.criterio.length ? "chip-aspecto con-contenido" : "chip-aspecto"}>
          2 · Criterio de indicación{!aspectos.criterio.length && " (vacío)"}
        </span>
        <span className={aspectos.tecnica.length ? "chip-aspecto con-contenido" : "chip-aspecto"}>
          3 · Técnica y complicaciones{!aspectos.tecnica.length && " (vacío)"}
        </span>
      </div>

      <p className="aviso-suave">
        Encontré {propuestas.length} entidad(es) específica(s) que podrían
        merecer tema propio. Preseleccioné las {Math.min(MAX_SUBTEMAS_SUGERIDOS, propuestas.length)} más
        desarrolladas (recomendado: máx. {MAX_SUBTEMAS_SUGERIDOS} por nivel).
        Cada una que marques se crea como tema completo, con su propia
        anatomía/criterio/técnica en blanco.
      </p>
      <label className="check-linea">
        <input type="checkbox" checked={encadenar} onChange={(e) => setEncadenar(e.target.checked)} />
        Encadenar subtemas como camino (cada uno pide el anterior)
      </label>
      <p className={nSeleccionados > MAX_SUBTEMAS_SUGERIDOS ? "contador-subtemas sobre-limite" : "contador-subtemas"}>
        {nSeleccionados} seleccionado{nSeleccionados === 1 ? "" : "s"}
        {nSeleccionados > MAX_SUBTEMAS_SUGERIDOS && " · más de lo recomendado"}
      </p>

      <ul className="lista-propuestas">
        {propuestas.map((p, i) => (
          <li key={i} className={p.elegido ? "prop elegida" : "prop"}>
            <input type="checkbox" checked={p.elegido}
              onChange={(e) => setPropuestas((ps) =>
                ps!.map((x, j) => j === i ? { ...x, elegido: e.target.checked } : x))} />
            <div className="prop-cuerpo">
              <input className="prop-titulo" value={p.titulo}
                onChange={(e) => setPropuestas((ps) =>
                  ps!.map((x, j) => j === i
                    ? { ...x, titulo: e.target.value, slug: aSlug(e.target.value) } : x))} />
              <div className="prop-meta">
                <code className="prop-id">tema completo → …{p.slug}.{"{"}anatomia,criterio,tecnica{"}"}</code>
                <span className="prop-largo">{p.palabras} palabras</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="fila-botones">
        <button className="boton-secundario" onClick={() => { setPropuestas(null); setAspectos(null); }}>
          Volver
        </button>
        <button className="boton-principal" onClick={confirmar}>
          Crear estructura (3 aspectos + {nSeleccionados} subtema{nSeleccionados === 1 ? "" : "s"})
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   PASO 3 — Flashcards dirigidas
   ============================================================ */

const DIFICULTADES = [
  { id: "recordar", etiqueta: "Básica — recordar", desc: "datos, cifras, definiciones y referencias anatómicas" },
  { id: "aplicar", etiqueta: "Intermedia — aplicar", desc: "elegir conducta ante un escenario clínico concreto" },
  { id: "analizar", etiqueta: "Alta — analizar", desc: "comparar alternativas, justificar y resolver complicaciones" },
  { id: "mixta", etiqueta: "Mixta (progresiva)", desc: "reparte entre los tres niveles, de menor a mayor" },
] as const;

const DIRECCIONES = [
  { id: "fundamento", etiqueta: "Fundamento anatómico y fisiológico" },
  { id: "criterio", etiqueta: "Criterio de indicación y selección" },
  { id: "tecnica", etiqueta: "Pasos técnicos y puntos críticos" },
  { id: "complicaciones", etiqueta: "Complicaciones y rescate" },
  { id: "evidencia", etiqueta: "Evidencia, cifras y estudios" },
  { id: "integracion", etiqueta: "Integración clínica (viñetas de caso)" },
] as const;

function PasoCards({ padre }: { padre: Nodo }) {
  const { hijos, resumenDe, cardsDe, guardarCards } = useStore();
  const candidatos = [padre, ...hijos(padre.id)];
  const [nodeId, setNodeId] = useState(candidatos[0]?.id ?? "");
  const [dificultad, setDificultad] = useState<string>("mixta");
  const [direccion, setDireccion] = useState<string>("criterio");
  const [cantidad, setCantidad] = useState(10);
  const [pegado, setPegado] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [iaCargando, setIaCargando] = useState(false);
  const cfgIA = leerConfigIA();

  const existentes = cardsDe(nodeId);

  const prompt = useMemo(() => {
    const nodo = candidatos.find((c) => c.id === nodeId);
    const dif = DIFICULTADES.find((d) => d.id === dificultad)!;
    const dir = DIRECCIONES.find((d) => d.id === direccion)!;
    const nivelLinea = dificultad === "mixta"
      ? `Reparte los niveles: 30% "recordar", 40% "aplicar", 30% "analizar".`
      : `Todas las cards deben ser de nivel "${dificultad}" (${dif.desc}).`;
    return [
      `Actúa como docente de cirugía en un programa de formación de becados.`,
      `Genera ${cantidad} flashcards de alto nivel sobre "${nodo?.titulo ?? nodeId}", basadas ESTRICTAMENTE en el resumen que va al final.`,
      ``,
      `ENFOQUE: ${dir.etiqueta}.`,
      nivelLinea,
      ``,
      `REGLAS:`,
      `- Nada de sí/no ni opción múltiple: pregunta abierta, respuesta precisa.`,
      `- La respuesta debe ser autosuficiente y no exceder 4 líneas.`,
      `- Prioriza lo que se pregunta en pabellón y en examen oral, no trivia.`,
      `- No inventes cifras ni referencias que no estén en el resumen.`,
      `- Si el resumen no alcanza para ${cantidad} cards de calidad, entrega menos.`,
      ``,
      `FORMATO DE SALIDA: responde SOLO con un array JSON, sin texto antes ni después, sin bloques de código. Cada elemento:`,
      `{"pregunta": "...", "respuesta": "...", "nivel": "recordar" | "aplicar" | "analizar"}`,
      ``,
      `--- RESUMEN ---`,
      resumenDe(nodeId) || "(este nodo aún no tiene resumen)",
    ].join("\n");
  }, [nodeId, dificultad, direccion, cantidad, candidatos, resumenDe]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch { setAviso("El navegador bloqueó el portapapeles. Selecciona el texto y copia a mano."); }
  };

  const procesarJSON = (texto: string) => {
    const limpio = texto.replace(/```json|```/g, "").trim();
    const datos = JSON.parse(limpio);
    if (!Array.isArray(datos)) throw new Error("no es un array");
    const base = existentes.length;
    const nuevas: Flashcard[] = datos.map((d: any, i: number) => {
      if (!d.pregunta || !d.respuesta) throw new Error("falta pregunta o respuesta");
      return {
        id: `${nodeId}#${String(base + i + 1).padStart(3, "0")}`,
        nodeId,
        pregunta: String(d.pregunta),
        respuesta: String(d.respuesta),
        nivel: ["recordar", "aplicar", "analizar"].includes(d.nivel) ? d.nivel : "aplicar",
      };
    });
    guardarCards(nodeId, [...existentes, ...nuevas]);
    return { agregadas: nuevas.length, total: base + nuevas.length };
  };

  const importarCards = () => {
    try {
      const { agregadas, total } = procesarJSON(pegado);
      setPegado("");
      setAviso(`${agregadas} flashcards agregadas. Total del nodo: ${total}.`);
    } catch (e: any) {
      setAviso(`No pude leer el JSON (${e.message}). Pega solo el array, desde [ hasta ].`);
    }
  };

  const generarIA = async () => {
    setIaCargando(true); setAviso(null);
    try {
      const texto = await generarConIA(cfgIA, prompt, { maxTokens: 4000 });
      const { agregadas, total } = procesarJSON(texto);
      setAviso(`${agregadas} flashcards generadas con IA. Total del nodo: ${total}.`);
    } catch (e: any) {
      setAviso(`No se pudo generar (${e.message}).`);
    } finally {
      setIaCargando(false);
    }
  };

  return (
    <div className="paso">
      <label className="campo">
        <span>Nodo de destino</span>
        <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); setAviso(null); }}>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo} {cardsDe(c.id).length ? `(${cardsDe(c.id).length} cards)` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span>Dificultad</span>
        <select value={dificultad} onChange={(e) => setDificultad(e.target.value)}>
          {DIFICULTADES.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
        </select>
      </label>

      <label className="campo">
        <span>Dirección del contenido</span>
        <select value={direccion} onChange={(e) => setDireccion(e.target.value)}>
          {DIRECCIONES.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
        </select>
      </label>

      <label className="campo">
        <span>Cantidad: {cantidad}</span>
        <input type="range" min={5} max={30} step={5} value={cantidad}
               onChange={(e) => setCantidad(Number(e.target.value))} />
      </label>

      <div className="caja-prompt">
        <div className="caja-prompt-cabecera">
          <span className="etiqueta-mono">PROMPT LISTO PARA CLAUDE</span>
          <button className="boton-secundario chico" onClick={copiar}>
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
        <pre className="prompt-texto">{prompt}</pre>
      </div>

      <div className="fila-ia">
        {hayClaveActiva(cfgIA) ? (
          <button className="boton-ia" disabled={iaCargando || !resumenDe(nodeId).trim()} onClick={generarIA}>
            {iaCargando ? "Generando…"
              : !resumenDe(nodeId).trim() ? "El nodo necesita un resumen primero"
              : `✨ Generar ${cantidad} flashcards con ${NOMBRE_PROVEEDOR[cfgIA.proveedor]}`}
          </button>
        ) : (
          <p className="nota-fina">
            Configura una API key en ⚙ Configuración para generar las flashcards
            automáticamente, o copia el prompt y pega el JSON abajo.
          </p>
        )}
      </div>

      <label className="campo">
        <span>Pega aquí el JSON que devolvió Claude</span>
        <textarea className="area-json" rows={6} value={pegado}
                  placeholder='[{"pregunta": "…", "respuesta": "…", "nivel": "aplicar"}]'
                  onChange={(e) => setPegado(e.target.value)} />
      </label>

      {aviso && <p className="aviso-suave">{aviso}</p>}

      <button className="boton-principal" disabled={!pegado.trim()} onClick={importarCards}>
        Agregar flashcards al nodo
      </button>

      {existentes.length > 0 && (
        <details className="detalle-cards">
          <summary>{existentes.length} flashcards ya guardadas en este nodo</summary>
          <ul>
            {existentes.map((c) => (
              <li key={c.id}><strong>{c.nivel}</strong> · {c.pregunta}</li>
            ))}
          </ul>
          <button className="boton-secundario chico" onClick={() => guardarCards(nodeId, [])}>
            Borrar todas las de este nodo
          </button>
        </details>
      )}
    </div>
  );
}
