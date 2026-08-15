/**
 * SelectorEspecialidad: la pantalla de entrada. Cada especialidad es
 * un nodo raíz (parent = null). Eliminar exige escribir el nombre
 * exacto y SIEMPRE pasa por la papelera — nunca se pierde al toque.
 */
import { useState } from "react";
import { useStore } from "./store";
import { descendientesDe } from "./content";

export function SelectorEspecialidad({
  onEntrar, onAbrirPapelera, onAbrirConfiguracion,
}: {
  onEntrar: (id: string) => void;
  onAbrirPapelera: () => void;
  onAbrirConfiguracion: () => void;
}) {
  const { nodos, estadoDe, crearEspecialidad, eliminarNodo, contenidoUsuario } = useStore();
  const especialidades = nodos.filter((n) => n.parent === null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [textoConfirma, setTextoConfirma] = useState("");

  const crear = () => {
    const t = nombre.trim();
    if (!t) return;
    const id = crearEspecialidad(t);
    setNombre(""); setCreando(false);
    onEntrar(id);
  };

  return (
    <div className="pantalla-selector">
      <div className="selector-cabecera">
        <div>
          <h1 className="selector-titulo">BECA-RPG</h1>
          <p className="selector-sub">Elige una especialidad para entrenar</p>
        </div>
        <div className="fila-botones">
          <button className="boton-secundario" onClick={onAbrirConfiguracion}>⚙ Configuración</button>
          <button className="boton-secundario" onClick={onAbrirPapelera}>
            🗑 Papelera{contenidoUsuario.papelera.length > 0 ? ` (${contenidoUsuario.papelera.length})` : ""}
          </button>
        </div>
      </div>

      <div className="grilla-especialidades">
        {especialidades.map((e) => {
          const desc = descendientesDe(nodos, e.id);
          const totalEstudio = desc.filter((d) => d.clase === "estudio").length;
          const dominados = desc.filter((d) => d.clase === "estudio" && estadoDe(d.id) === "dominado").length;
          const pct = totalEstudio ? Math.round((dominados / totalEstudio) * 100) : 0;

          return (
            <div key={e.id} className="tarjeta-especialidad">
              <button className="tarjeta-especialidad-cuerpo" onClick={() => onEntrar(e.id)}>
                <h2>{e.titulo}</h2>
                <p className="nota-fina">{totalEstudio} nodos de estudio · {pct}% dominado</p>
                <div className="barra-xp"><div className="barra-xp-relleno" style={{ width: `${pct}%` }} /></div>
              </button>

              {confirmando === e.id ? (
                <div className="confirmar-borrado">
                  <p className="aviso-suave">
                    Escribe “{e.titulo}” para confirmar. Quedará en la papelera, podrás restaurarla.
                  </p>
                  <input className="input-linea" value={textoConfirma}
                         onChange={(ev) => setTextoConfirma(ev.target.value)} />
                  <div className="fila-botones">
                    <button className="boton-secundario"
                            onClick={() => { setConfirmando(null); setTextoConfirma(""); }}>
                      Cancelar
                    </button>
                    <button className="boton-peligro" disabled={textoConfirma.trim() !== e.titulo}
                            onClick={() => { eliminarNodo(e.id); setConfirmando(null); setTextoConfirma(""); }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <button className="boton-borrar-tarjeta" onClick={() => setConfirmando(e.id)}>
                  Eliminar especialidad
                </button>
              )}
            </div>
          );
        })}

        <div className="tarjeta-especialidad tarjeta-nueva">
          {creando ? (
            <div className="paso">
              <input className="input-linea" autoFocus placeholder="Ej: Cirugía Digestiva"
                     value={nombre} onChange={(e) => setNombre(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && crear()} />
              <div className="fila-botones">
                <button className="boton-secundario" onClick={() => setCreando(false)}>Cancelar</button>
                <button className="boton-principal" disabled={!nombre.trim()} onClick={crear}>Crear</button>
              </div>
            </div>
          ) : (
            <button className="boton-tarjeta-nueva" onClick={() => setCreando(true)}>
              + Nueva especialidad
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
