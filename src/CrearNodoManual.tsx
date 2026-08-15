/**
 * CrearNodoManual: crear un nodo en un nivel elegido SIN pasar por
 * el megaresumen — el paso rápido para armar el esqueleto del árbol
 * (ej. "Cobertura de miembro inferior") antes de trabajarlo a fondo.
 */
import { useState } from "react";
import { useStore } from "./store";
import { idUnicoEnNivel } from "./content";
import {
  aSlug, NOMBRE_TIPO, type ClaseNodo, type TipoNodo, type EscalaEvaluacion, type Nodo,
} from "./types";

const TIPOS: TipoNodo[] = [
  "anatomia", "fisiologia", "fisiopatologia", "diagnostico",
  "manejo_medico", "criterio", "tecnica", "complicaciones", "transversal",
];

export function CrearNodoManual({
  parentId, onCreado,
}: {
  parentId: string | null;
  onCreado: (idCreado: string) => void;
}) {
  const { indice, crearNodos, agregarPlantilla } = useStore();
  const [titulo, setTitulo] = useState("");
  const [clase, setClase] = useState<ClaseNodo>("dominio");
  const [conPlantilla, setConPlantilla] = useState(true);
  const [tipo, setTipo] = useState<TipoNodo>("criterio");
  const [escala, setEscala] = useState<EscalaEvaluacion>("miller");

  const crear = () => {
    const t = titulo.trim();
    if (!t) return;
    const id = idUnicoEnNivel(indice, parentId, aSlug(t));
    const nuevo: Nodo = {
      id, titulo: t, clase, parent: parentId,
      tipo: clase === "estudio" ? tipo : null,
      escala: clase === "estudio" ? escala : null,
      prerequisitos: [], xp: clase === "estudio" ? 110 : 0, origen: "taller",
    };
    crearNodos([nuevo]);
    if (clase === "dominio" && conPlantilla) agregarPlantilla(id);
    setTitulo("");
    onCreado(id);
  };

  return (
    <div className="form-crear-nodo">
      <label className="campo">
        <span>Título</span>
        <input
          className="input-linea" autoFocus value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          placeholder="Ej: Cobertura de miembro inferior"
        />
      </label>

      <label className="campo">
        <span>Tipo de nodo</span>
        <select value={clase} onChange={(e) => setClase(e.target.value as ClaseNodo)}>
          <option value="dominio">Dominio (agrupa más nodos debajo)</option>
          <option value="estudio">Nodo de estudio (una sola misión triple)</option>
        </select>
      </label>

      {clase === "dominio" && (
        <label className="check-linea">
          <input type="checkbox" checked={conPlantilla}
                 onChange={(e) => setConPlantilla(e.target.checked)} />
          Crear con plantilla estándar (anatomía/fisiología · criterio · técnica/complicaciones)
        </label>
      )}

      {clase === "estudio" && (
        <>
          <label className="campo">
            <span>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoNodo)}>
              {TIPOS.map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Escala</span>
            <select value={escala} onChange={(e) => setEscala(e.target.value as EscalaEvaluacion)}>
              <option value="miller">Miller (cognitiva)</option>
              <option value="zwisch">Zwisch (técnica)</option>
            </select>
          </label>
        </>
      )}

      <button className="boton-principal" disabled={!titulo.trim()} onClick={crear}>
        Crear nodo
      </button>
    </div>
  );
}
