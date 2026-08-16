/**
 * NodeModal — el panel de un nodo de ESTUDIO.
 * Misiones: 📖 resumen → 🃏 flashcards → 🎤 interrogación.
 * Desde aquí se abre el Taller para trabajar sus fuentes/resumen,
 * y al final hay gestión: renombrar, mover, eliminar.
 */
import { useMemo, useState } from "react";
import { marked } from "marked";
import { useStore } from "./store";
import { separarAspectosYSubtemas } from "./content";
import { NOMBRE_TIPO, type NivelEscala, type Flashcard } from "./types";
import { estaVencida, type Calidad } from "./srs";
import { AccionesNodo } from "./AccionesNodo";
import { CrearNodoManual } from "./CrearNodoManual";

type Pestana = "misiones" | "resumen" | "flashcards" | "interrogacion";

const DESC_MILLER: Record<NivelEscala, string> = {
  1: "Sabe — conozco el concepto teórico",
  2: "Sabe cómo — puedo explicar cuándo y cómo aplicarlo",
  3: "Demuestra — lo resolví en simulación o interrogación",
  4: "Hace — lo aplico en la práctica clínica real",
};
const DESC_ZWISCH: Record<NivelEscala, string> = {
  1: "Show & tell — observé y comprendo los pasos",
  2: "Ayuda activa — opero con guía constante del docente",
  3: "Ayuda pasiva — opero, el docente interviene puntualmente",
  4: "Supervisión — opero autónomo con supervisión disponible",
};

export function NodeModal({
  nodeId, onCerrar, onNavegar, onAbrirTaller,
}: {
  nodeId: string;
  onCerrar: () => void;
  onNavegar: (id: string) => void;
  onAbrirTaller: (parentId: string) => void;
}) {
  const {
    indice, progresoDe, estadoDe, completarMision, fijarNivel, cardsDe, hijos, fuentesDe,
  } = useStore();
  const [pestana, setPestana] = useState<Pestana>("misiones");
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const nodo = indice.get(nodeId);
  if (!nodo) return null;

  const prog = progresoDe(nodeId);
  const estado = estadoDe(nodeId);
  const cards = cardsDe(nodeId);
  const subnodos = hijos(nodeId);
  const { aspectos, subtemas } = separarAspectosYSubtemas(subnodos);
  const tieneFuentes = fuentesDe(nodeId).length > 0;

  // Padre para el botón "Volver"
  const padreNodo = nodo.parent ? indice.get(nodo.parent) : null;

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <div>
            {nodo.tipo && <span className="chip chip-tipo">{NOMBRE_TIPO[nodo.tipo]}</span>}
            {nodo.escala && (
              <span className="chip">Escala {nodo.escala === "miller" ? "Miller" : "Zwisch"}</span>
            )}
            <span className={`chip chip-${estado}`}>{estado.replace("_", " ")}</span>
            {nodo.origen === "taller" && <span className="chip chip-taller">tuyo</span>}
          </div>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        {/* Botón volver al nivel superior */}
        {padreNodo && (
          <button className="boton-volver-panel" onClick={() => onNavegar(nodo.parent!)}>
            ◀ {padreNodo.titulo}
          </button>
        )}

        <h2 className="modal-titulo">{nodo.titulo}</h2>
        <p className="modal-id">{nodo.id} · {nodo.xp} XP</p>

        {estado === "bloqueado" && (
          <p className="aviso-suave">
            Sugerencia: domina primero lo anterior del camino. Puedes seguir
            igual — el camino es guía, no candado.
          </p>
        )}

        {nodo.prerequisitos.length > 0 && (
          <div className="prereqs">
            {nodo.prerequisitos.map((pre) => (
              <button key={pre} className="prereq" onClick={() => onNavegar(pre)}>
                {estadoDe(pre) === "dominado" ? "✓" : "○"}{" "}
                {indice.get(pre)?.titulo ?? pre}
              </button>
            ))}
          </div>
        )}

        <nav className="pestanas">
          {(["misiones", "resumen", "flashcards", "interrogacion"] as Pestana[]).map((p) => (
            <button key={p} className={pestana === p ? "pestana activa" : "pestana"}
                    onClick={() => setPestana(p)}>
              {p === "misiones" ? "Misiones" : p === "resumen" ? "📖 Resumen"
                : p === "flashcards" ? "🃏 Flashcards" : "🎤 Interrogación"}
            </button>
          ))}
        </nav>

        {pestana === "misiones" && (
          <>
            <ol className="lista-misiones">
              <li className={prog.misiones.resumen ? "hecha" : ""}>
                <button onClick={() => setPestana("resumen")}>
                  📖 Leer el resumen {prog.misiones.resumen && "✓"}
                </button>
              </li>
              <li className={prog.misiones.flashcards ? "hecha" : ""}>
                <button onClick={() => setPestana("flashcards")}>
                  🃏 Completar flashcards ({cards.length}) {prog.misiones.flashcards && "✓"}
                </button>
              </li>
              <li className={prog.misiones.interrogacion ? "hecha" : ""}>
                <button onClick={() => setPestana("interrogacion")}>
                  🎤 Interrogación {prog.misiones.interrogacion && "✓"}
                </button>
              </li>
            </ol>

            <div className="bloque-profundizar">
              <p className="etiqueta-mono">
                CARPETA DE FUENTES {tieneFuentes ? "· con material" : "· vacía"}
              </p>
              {subnodos.length > 0 && (
                <ul className="lista-subnodos">
                  {aspectos.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => onNavegar(s.id)}>
                        {estadoDe(s.id) === "dominado" ? "✓" : "→"} {s.titulo}
                      </button>
                    </li>
                  ))}
                  {aspectos.length > 0 && subtemas.length > 0 && (
                    <li className="divisor-subtemas-lista">SUBTEMAS</li>
                  )}
                  {subtemas.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => onNavegar(s.id)}>▸ {s.titulo}</button>
                    </li>
                  ))}
                </ul>
              )}
              <button className="boton-secundario" onClick={() => onAbrirTaller(nodeId)}>
                Abrir Taller: fuentes → resumen → flashcards
              </button>
            </div>

            <div className="bloque-profundizar">
              <button className="boton-secundario" onClick={() => setMostrarCrear((v) => !v)}>
                {mostrarCrear ? "Cerrar" : "+ Nodo nuevo aquí (manual)"}
              </button>
              {mostrarCrear && (
                <>
                  <p className="nota-fina">
                    Se creará dentro de <strong>{nodo.titulo}</strong>, no en otro nivel.
                  </p>
                  <CrearNodoManual
                    parentId={nodeId}
                    onCreado={(id) => { setMostrarCrear(false); onNavegar(id); }}
                  />
                </>
              )}
            </div>
          </>
        )}

        {pestana === "resumen" && (
          <SummaryReader nodeId={nodeId} leido={prog.misiones.resumen}
            onLeido={() => completarMision(nodeId, "resumen")}
            onNavegar={onNavegar}
            onAbrirTaller={() => onAbrirTaller(nodeId)} />
        )}

        {pestana === "flashcards" && (
          <FlashcardEngine cards={cards} nodeId={nodeId}
            onSesionCompleta={() => completarMision(nodeId, "flashcards")}
            onAbrirTaller={() => onAbrirTaller(nodeId)} />
        )}

        {pestana === "interrogacion" && (
          <Interrogacion escala={nodo.escala ?? "miller"} nivelActual={prog.nivelEscala}
            onConfirmar={(n) => {
              fijarNivel(nodeId, n);
              completarMision(nodeId, "interrogacion");
              setPestana("misiones");
            }} />
        )}

        <details className="gestion-nodo">
          <summary>⚙ Gestión del nodo</summary>
          <AccionesNodo nodeId={nodeId} tituloActual={nodo.titulo} onEliminado={onCerrar} />
        </details>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ */

function SummaryReader({
  nodeId, leido, onLeido, onNavegar, onAbrirTaller,
}: {
  nodeId: string; leido: boolean; onLeido: () => void;
  onNavegar: (id: string) => void; onAbrirTaller: () => void;
}) {
  const { resumenDe, indice } = useStore();
  const texto = resumenDe(nodeId);

  const html = useMemo(() => {
    if (!texto.trim()) return "";
    const conEnlaces = texto.replace(/\[\[([\w.]+)\]\]/g, (_m, id) => {
      const t = indice.get(id)?.titulo ?? id;
      return `<a href="#" data-nodo="${id}">${t}</a>`;
    });
    return marked.parse(conEnlaces) as string;
  }, [texto, indice]);

  if (!texto.trim())
    return (
      <div className="paso">
        <p className="aviso-suave">Este nodo aún no tiene resumen.</p>
        <button className="boton-principal" onClick={onAbrirTaller}>
          Abrir el Taller y trabajar sus fuentes
        </button>
      </div>
    );

  return (
    <div className="sala-estudio">
      <article className="resumen" dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest("a[data-nodo]");
          if (a) { e.preventDefault(); onNavegar(a.getAttribute("data-nodo")!); }
        }} />
      {!leido ? (
        <button className="boton-principal" onClick={onLeido}>
          Marcar resumen como leído ✓
        </button>
      ) : (
        <p className="aviso-ok">Resumen completado.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ */

function FlashcardEngine({
  cards, nodeId, onSesionCompleta, onAbrirTaller,
}: {
  cards: Flashcard[]; nodeId: string;
  onSesionCompleta: () => void; onAbrirTaller: () => void;
}) {
  const { usuario, registrarReview } = useStore();
  const [indiceCard, setIndiceCard] = useState(0);
  const [mostrar, setMostrar] = useState(false);

  const cola = useMemo(() => {
    const vencida = (c: Flashcard) => {
      const s = usuario.srs[c.id];
      return s ? estaVencida(s) : true;
    };
    const vistas = (c: Flashcard) => usuario.srs[c.id]?.repeticiones ?? 0;
    return [...cards].sort((a, b) => {
      const d = (vencida(a) ? 0 : 1) - (vencida(b) ? 0 : 1);
      return d !== 0 ? d : vistas(a) - vistas(b);
    });
  }, [cards, nodeId]);

  if (cards.length === 0)
    return (
      <div className="paso">
        <p className="aviso-suave">Este nodo aún no tiene flashcards.</p>
        <button className="boton-principal" onClick={onAbrirTaller}>
          Generarlas en el Taller (dificultad y dirección a elección)
        </button>
      </div>
    );

  if (indiceCard >= cola.length)
    return (
      <div className="fin-sesion">
        <p className="aviso-ok">Sesión completada: {cola.length} cards revisadas.</p>
        <button className="boton-principal" onClick={onSesionCompleta}>
          Registrar misión de flashcards ✓
        </button>
      </div>
    );

  const card = cola[indiceCard];
  const calificar = (q: Calidad) => {
    registrarReview(card.id, q);
    setMostrar(false);
    setIndiceCard((i) => i + 1);
  };

  return (
    <div className="motor-cards">
      <p className="contador-cards">
        Card {indiceCard + 1} de {cola.length} · nivel {card.nivel}
      </p>
      <div className="card-caja">
        <p className="card-pregunta">{card.pregunta}</p>
        {mostrar && <p className="card-respuesta">{card.respuesta}</p>}
      </div>
      {!mostrar ? (
        <button className="boton-principal" onClick={() => setMostrar(true)}>
          Mostrar respuesta
        </button>
      ) : (
        <div className="botones-calidad">
          <button className="calidad c-otra" onClick={() => calificar(2)}>Otra vez</button>
          <button className="calidad c-dificil" onClick={() => calificar(3)}>Difícil</button>
          <button className="calidad c-bien" onClick={() => calificar(4)}>Bien</button>
          <button className="calidad c-facil" onClick={() => calificar(5)}>Fácil</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ */

function Interrogacion({
  escala, nivelActual, onConfirmar,
}: {
  escala: "miller" | "zwisch"; nivelActual: number;
  onConfirmar: (n: NivelEscala) => void;
}) {
  const [nivel, setNivel] = useState<NivelEscala | 0>((nivelActual as NivelEscala) || 0);
  const desc = escala === "miller" ? DESC_MILLER : DESC_ZWISCH;
  return (
    <div className="paso">
      <p className="aviso-suave">
        Autoevaluación honesta en escala{" "}
        {escala === "miller" ? "de Miller (cognitiva)" : "Zwisch (técnica)"}.
        En la fase 4 esta misión será una interrogación oral con IA.
      </p>
      {([1, 2, 3, 4] as NivelEscala[]).map((n) => (
        <label key={n} className={`opcion-nivel ${nivel === n ? "elegida" : ""}`}>
          <input type="radio" name="nivel" checked={nivel === n} onChange={() => setNivel(n)} />
          <strong>{escala === "miller" ? "M" : "Z"}{n}</strong> — {desc[n]}
        </label>
      ))}
      <button className="boton-principal" disabled={nivel === 0}
              onClick={() => nivel !== 0 && onConfirmar(nivel)}>
        Registrar nivel ✓
      </button>
    </div>
  );
}
