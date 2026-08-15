/**
 * RepasoGlobal: el panel más importante para el objetivo central
 * del proyecto — "¿cómo llego a manejar esta patología si no sé
 * qué estudiar?" Una vez que tienes el contenido construido, aquí
 * puedes leer TODOS los resúmenes o repasar TODAS las flashcards
 * de un nodo y todo lo que contiene, sin ir subnodo por subnodo.
 */
import { useMemo, useState } from "react";
import { marked } from "marked";
import { useStore } from "./store";
import { descendientesDe } from "./content";
import type { Flashcard, Nodo } from "./types";
import { estaVencida, type Calidad } from "./srs";

type Tab = "resumenes" | "flashcards";

export function RepasoGlobal({
  raizId, onCerrar,
}: {
  raizId: string;
  onCerrar: () => void;
}) {
  const { nodos, indice, resumenDe, cardsDe, usuario, registrarReview } = useStore();

  const subArbol: Nodo[] = useMemo(() => {
    const raiz = indice.get(raizId);
    if (!raiz) return [];
    return [raiz, ...descendientesDe(nodos, raizId)];
  }, [nodos, raizId]);

  const nodosConResumen = useMemo(() =>
    subArbol.filter(n => resumenDe(n.id).trim().length > 0)
  , [subArbol]);

  const todasCards: Flashcard[] = useMemo(() => {
    const cards = subArbol.flatMap(n => cardsDe(n.id));
    // SRS: vencidas primero, luego nunca vistas, luego el resto
    return [...cards].sort((a, b) => {
      const sa = usuario.srs[a.id], sb = usuario.srs[b.id];
      const prioA = !sa ? 1 : estaVencida(sa) ? 0 : 2;
      const prioB = !sb ? 1 : estaVencida(sb) ? 0 : 2;
      return prioA - prioB;
    });
  }, [subArbol, usuario.srs]);

  const cardsPendientes = todasCards.filter(c => {
    const s = usuario.srs[c.id];
    return !s || estaVencida(s);
  }).length;

  const raiz = indice.get(raizId);
  const [tab, setTab] = useState<Tab>("resumenes");
  const [nodoAbierto, setNodoAbierto] = useState<string | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [mostrarResp, setMostrarResp] = useState(false);

  const calificar = (q: Calidad) => {
    registrarReview(todasCards[cardIdx].id, q);
    setMostrarResp(false);
    setCardIdx(i => i + 1);
  };

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal modal-ancho" onClick={e => e.stopPropagation()}>
        <header className="modal-cabecera">
          <div>
            <span className="chip chip-repaso">REPASO GLOBAL</span>
            <span className="chip">{raiz?.titulo}</span>
          </div>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="stats-taller">
          <div><strong>{nodosConResumen.length}</strong><span>con resumen</span></div>
          <div><strong>{todasCards.length}</strong><span>flashcards</span></div>
          <div><strong className={cardsPendientes > 0 ? "stat-alerta" : ""}>{cardsPendientes}</strong><span>para hoy</span></div>
          <div><strong>{subArbol.length}</strong><span>nodos totales</span></div>
        </div>

        <nav className="pestanas">
          <button className={tab === "resumenes" ? "pestana activa" : "pestana"}
                  onClick={() => { setTab("resumenes"); setNodoAbierto(null); }}>
            📖 Resúmenes ({nodosConResumen.length})
          </button>
          <button className={tab === "flashcards" ? "pestana activa" : "pestana"}
                  onClick={() => { setTab("flashcards"); setCardIdx(0); setMostrarResp(false); }}>
            🃏 Flashcards ({todasCards.length})
          </button>
        </nav>

        {tab === "resumenes" && (
          nodoAbierto
            ? <LectorResumen nodeId={nodoAbierto} onVolver={() => setNodoAbierto(null)} />
            : <ListaResumenes nodos={nodosConResumen} onAbrir={setNodoAbierto} />
        )}

        {tab === "flashcards" && (
          <SesionCards
            cards={todasCards}
            cardIdx={cardIdx}
            mostrarResp={mostrarResp}
            setMostrarResp={setMostrarResp}
            calificar={calificar}
          />
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ */

function ListaResumenes({
  nodos, onAbrir,
}: {
  nodos: Nodo[];
  onAbrir: (id: string) => void;
}) {
  if (nodos.length === 0)
    return (
      <p className="aviso-suave">
        Aún no hay resúmenes bajo este nodo. Crea contenido en el Taller
        para poder repasar aquí sin ir subnodo por subnodo.
      </p>
    );
  return (
    <ul className="lista-resumenes-global">
      {nodos.map(n => (
        <li key={n.id}>
          <button className="fila-resumen-global" onClick={() => onAbrir(n.id)}>
            <div>
              <strong>{n.titulo}</strong>
              <span className="nota-fina"> · {n.tipo ?? "dominio"} · {n.id}</span>
            </div>
            <span className="flecha-leer">›</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LectorResumen({
  nodeId, onVolver,
}: {
  nodeId: string;
  onVolver: () => void;
}) {
  const { resumenDe, indice } = useStore();
  const texto = resumenDe(nodeId);
  const nodo = indice.get(nodeId);

  const html = useMemo(() => {
    const conEnlaces = texto.replace(/\[\[([\w.]+)\]\]/g, (_m, id) => {
      const t = indice.get(id)?.titulo ?? id;
      return `<a href="#" data-nodo="${id}">${t}</a>`;
    });
    return marked.parse(conEnlaces) as string;
  }, [texto]);

  return (
    <div className="sala-estudio">
      <button className="boton-volver-panel" onClick={onVolver}>
        ◀ Volver a la lista
      </button>
      <p className="modal-id">{nodo?.titulo} · {nodeId}</p>
      <article className="resumen" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function SesionCards({
  cards, cardIdx, mostrarResp, setMostrarResp, calificar,
}: {
  cards: Flashcard[];
  cardIdx: number;
  mostrarResp: boolean;
  setMostrarResp: (v: boolean) => void;
  calificar: (q: Calidad) => void;
}) {
  const { indice } = useStore();

  if (cards.length === 0)
    return (
      <p className="aviso-suave">
        Aún no hay flashcards bajo este nodo. Créalas en el Taller de cada nodo.
      </p>
    );

  if (cardIdx >= cards.length)
    return (
      <div className="fin-sesion">
        <p className="aviso-ok">Sesión completada: {cards.length} cards revisadas.</p>
      </div>
    );

  const card = cards[cardIdx];
  const nodoNombre = indice.get(card.nodeId)?.titulo ?? card.nodeId;

  return (
    <div className="motor-cards">
      <p className="contador-cards">
        Card {cardIdx + 1} de {cards.length} · {card.nivel} · {nodoNombre}
      </p>
      <div className="card-caja">
        <p className="card-pregunta">{card.pregunta}</p>
        {mostrarResp && <p className="card-respuesta">{card.respuesta}</p>}
      </div>
      {!mostrarResp ? (
        <button className="boton-principal" onClick={() => setMostrarResp(true)}>
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
