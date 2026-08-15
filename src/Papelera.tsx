/**
 * Papelera: el respaldo contra borrados accidentales. Nada
 * desaparece de verdad hasta que lo purgas explícitamente aquí.
 */
import { useStore } from "./store";

export function Papelera({ onCerrar }: { onCerrar: () => void }) {
  const { contenidoUsuario, restaurarDePapelera, purgarDePapelera, vaciarPapelera } = useStore();
  const items = contenidoUsuario.papelera;

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <aside className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <span className="chip">Papelera</span>
          <button className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        {items.length === 0 ? (
          <p className="aviso-suave">
            Vacía. Lo que elimines aparece aquí antes de perderse para siempre.
          </p>
        ) : (
          <>
            <ul className="lista-papelera">
              {items.map((it) => (
                <li key={it.id}>
                  <div>
                    <strong>{it.titulo}</strong>
                    <p className="nota-fina">
                      Eliminado el {it.eliminadoEl} · {it.idsOcultos.length + it.nodosGuardados.length} nodos
                    </p>
                  </div>
                  <div className="fila-botones">
                    <button className="boton-secundario chico" onClick={() => restaurarDePapelera(it.id)}>
                      Restaurar
                    </button>
                    <button className="boton-peligro chico" onClick={() => purgarDePapelera(it.id)}>
                      Borrar definitivo
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="boton-secundario" onClick={vaciarPapelera}>
              Vaciar papelera
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
