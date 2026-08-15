/**
 * DomainPanel: el panel de un nodo DOMINIO. Aquí vives cuando
 * entras a "Cobertura de miembro inferior": ves de qué está
 * compuesto, entras al Taller a trabajarlo (fuentes → megaresumen
 * → nodos hijos → flashcards), o creas un nodo manual en este nivel.
 */
import { useState } from "react";
import { useStore } from "./store";
import { rutaHasta, separarAspectosYSubtemas } from "./content";
import { AccionesNodo } from "./AccionesNodo";
import { CrearNodoManual } from "./CrearNodoManual";

export function DomainPanel({
  nodeId, onCerrar, onNavegar, onAbrirTaller, onAbrirRepaso,
}: {
  nodeId: string;
  onCerrar: () => void;
  onNavegar: (id: string) => void;
  onAbrirTaller: (id: string) => void;
  onAbrirRepaso: (id: string) => void;
}) {
  const { indice, hijos, estadoDe, agregarPlantilla, fuentesDe, resumenDe } = useStore();
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const nodo = indice.get(nodeId);
  if (!nodo) return null;

  const ruta = rutaHasta(indice, nodeId);
  const subnodos = hijos(nodeId);
  const { aspectos, subtemas } = separarAspectosYSubtemas(subnodos);
  const tieneFuentes = fuentesDe(nodeId).length > 0;
  const tieneResumen = resumenDe(nodeId).trim().length > 0;

  // Padre para el botón "Volver"
  const padreNodo = nodo.parent ? indice.get(nodo.parent) : null;

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <span className="chip">Dominio</span>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        {/* Botón volver al nivel superior */}
        {padreNodo && (
          <button className="boton-volver-panel" onClick={() => onNavegar(nodo.parent!)}>
            ◀ {padreNodo.titulo}
          </button>
        )}

        {/* Camino de aprendizaje */}
        {ruta.length > 1 && (
          <div className="camino-aprendizaje">
            {ruta.map((n, i) => (
              <span key={n.id} className="camino-tramo">
                {i > 0 && <span className="camino-flecha">›</span>}
                <button className={`camino-paso ${n.id === nodeId ? "activo" : ""}`}
                        onClick={() => n.id !== nodeId && onNavegar(n.id)}>
                  {n.titulo}
                </button>
              </span>
            ))}
          </div>
        )}

        <h2 className="modal-titulo">{nodo.titulo}</h2>
        <p className="modal-id">{nodo.id}</p>

        {/* Repaso global */}
        <button className="boton-repaso-global" onClick={() => onAbrirRepaso(nodeId)}>
          📚 Repaso global — todos los resúmenes y flashcards bajo este nodo
        </button>

        <button className="boton-principal" onClick={() => onAbrirTaller(nodeId)}>
          📖 Taller: fuentes → megaresumen → nodos hijos → flashcards
          {(tieneFuentes || tieneResumen) && (
            <span className="marca-taller"> · {tieneResumen ? "con resumen" : "con fuentes"}</span>
          )}
        </button>

        {subnodos.length === 0 && (
          <button className="boton-secundario" onClick={() => agregarPlantilla(nodeId)}>
            + Plantilla estándar (anatomía/fisiología · criterio · técnica/complicaciones)
          </button>
        )}

        <p className="etiqueta-mono etiqueta-separador">CONTIENE ({subnodos.length})</p>
        {subnodos.length === 0 ? (
          <p className="aviso-suave">Todavía no tiene nodos hijos.</p>
        ) : (
          <ul className="lista-subnodos">
            {aspectos.map((s) => (
              <li key={s.id}>
                <button onClick={() => onNavegar(s.id)}>
                  {estadoDe(s.id) === "dominado" ? "✓" : "○"} {s.titulo}
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

        <button className="boton-secundario" onClick={() => setMostrarCrear((v) => !v)}>
          {mostrarCrear ? "Cerrar" : "+ Nodo nuevo aquí (manual)"}
        </button>
        {mostrarCrear && (
          <CrearNodoManual parentId={nodeId} onCreado={() => setMostrarCrear(false)} />
        )}

        <details className="gestion-nodo">
          <summary>⚙ Gestión del nodo</summary>
          <AccionesNodo nodeId={nodeId} tituloActual={nodo.titulo} onEliminado={onCerrar} />
        </details>
      </aside>
    </div>
  );
}
