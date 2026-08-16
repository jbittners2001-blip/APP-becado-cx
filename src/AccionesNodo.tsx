/**
 * AccionesNodo: renombrar y eliminar a la papelera.
 * Mover de nivel ya NO se hace aquí con un <select>: se hace
 * arrastrando el nodo en el árbol (modo "✏️ Modificar").
 */
import { useState } from "react";
import { useStore } from "./store";

export function AccionesNodo({
  nodeId, tituloActual, onEliminado,
}: {
  nodeId: string;
  tituloActual: string;
  onEliminado?: () => void;
}) {
  const { actualizarNodo, eliminarNodo } = useStore();
  const [nombre, setNombre] = useState(tituloActual);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const guardarNombre = () => {
    const limpio = nombre.trim();
    if (limpio && limpio !== tituloActual) {
      actualizarNodo(nodeId, { titulo: limpio });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 1500);
    }
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

      {/* Mover: ahora por arrastre */}
      <p className="nota-fina">
        Para mover este nodo a otro dominio, cierra este panel y usa
        <strong> ✏️ Modificar</strong> en el árbol: arrástralo y suéltalo
        sobre su nuevo padre.
      </p>

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
