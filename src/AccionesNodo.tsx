/**
 * AccionesNodo: renombrar, mover a otro nivel (select funcional, sin
 * drag), y eliminar a la papelera. Simple, siempre funciona.
 */
import { useState } from "react";
import { useStore } from "./store";
import { descendientesDe } from "./content";

export function AccionesNodo({
  nodeId, tituloActual, onEliminado,
}: {
  nodeId: string;
  tituloActual: string;
  onEliminado?: () => void;
}) {
  const { actualizarNodo, eliminarNodo, moverNodo, nodos, indice } = useStore();
  const [nombre, setNombre] = useState(tituloActual);
  const [mostrarMover, setMostrarMover] = useState(false);
  const [nuevoPadreId, setNuevoPadreId] = useState("");
  const [errorMover, setErrorMover] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  // Todos los dominios válidos como destino (excluye al propio nodo y sus descendientes)
  const desc = descendientesDe(nodos, nodeId).map(d => d.id);
  const nodoActual = indice.get(nodeId);
  const dominiosDisponibles = nodos.filter(n =>
    n.clase === "dominio" &&
    n.id !== nodeId &&
    !desc.includes(n.id) &&
    n.id !== nodoActual?.parent  // ya está ahí, no tiene sentido
  );

  const guardarNombre = () => {
    const limpio = nombre.trim();
    if (limpio && limpio !== tituloActual) {
      actualizarNodo(nodeId, { titulo: limpio });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 1500);
    }
  };

  const ejecutarMover = () => {
    const err = moverNodo(nodeId, nuevoPadreId || null);
    if (err) { setErrorMover(err); return; }
    setMostrarMover(false);
    setNuevoPadreId("");
    setErrorMover(null);
  };

  const confirmarEliminar = () => {
    eliminarNodo(nodeId);
    setConfirmarBorrado(false);
    onEliminado?.();
  };

  return (
    <div className="acciones-nodo">
      {/* Renombrar */}
      <label className="campo">
        <span>Renombrar</span>
        <div className="fila-input-boton">
          <input className="input-linea" value={nombre}
                 onChange={e => setNombre(e.target.value)}
                 onKeyDown={e => e.key === "Enter" && guardarNombre()} />
          <button className="boton-secundario chico" onClick={guardarNombre}>
            {guardadoOk ? "✓" : "Guardar"}
          </button>
        </div>
      </label>

      {/* Mover */}
      <button className="boton-secundario" onClick={() => setMostrarMover(v => !v)}>
        ↔ Mover a otro nivel
      </button>
      {mostrarMover && (
        <div className="panel-mover">
          <label className="campo">
            <span>Nuevo dominio padre</span>
            <select value={nuevoPadreId}
                    onChange={e => { setNuevoPadreId(e.target.value); setErrorMover(null); }}>
              <option value="">— elegir dominio de destino —</option>
              {dominiosDisponibles.map(d => (
                <option key={d.id} value={d.id}>{d.titulo}</option>
              ))}
            </select>
          </label>
          {errorMover && <p className="aviso-suave">{errorMover}</p>}
          <div className="fila-botones">
            <button className="boton-secundario chico"
                    onClick={() => { setMostrarMover(false); setErrorMover(null); }}>
              Cancelar
            </button>
            <button className="boton-principal" disabled={!nuevoPadreId} onClick={ejecutarMover}
                    style={{ marginTop: 0 }}>
              Mover aquí
            </button>
          </div>
        </div>
      )}

      {/* Eliminar */}
      {!confirmarBorrado ? (
        <button className="boton-peligro" onClick={() => setConfirmarBorrado(true)}>
          🗑 Eliminar (a la papelera)
        </button>
      ) : (
        <div className="confirmar-borrado">
          <p className="aviso-suave">
            "{tituloActual}" y todo lo que contiene se moverán a la papelera.
            Podrás restaurarlo después.
          </p>
          <div className="fila-botones">
            <button className="boton-secundario" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
            <button className="boton-peligro" onClick={confirmarEliminar}>
              Sí, eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
