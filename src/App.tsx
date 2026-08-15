import { useEffect, useState } from "react";
import { Store, useStore, RANGOS } from "./store";
import { SkillTreeView } from "./SkillTree";
import { NodeModal } from "./NodeModal";
import { DomainPanel } from "./DomainPanel";
import { Taller } from "./Taller";
import { RepasoGlobal } from "./RepasoGlobal";
import { SelectorEspecialidad } from "./SelectorEspecialidad";
import { Papelera } from "./Papelera";
import { Configuracion } from "./Configuracion";
import { CrearNodoManual } from "./CrearNodoManual";
import type { Nodo } from "./types";

function HUD({
  especialidad, onVolver, onAbrirPapelera, onAbrirConfiguracion,
}: {
  especialidad: Nodo;
  onVolver: () => void;
  onAbrirPapelera: () => void;
  onAbrirConfiguracion: () => void;
}) {
  const { usuario, cardsVencidasHoy, renombrar, reiniciarProgreso, nodos } = useStore();
  const { perfil } = usuario;
  const siguiente = RANGOS.find((r) => r.xpMin > perfil.xpTotal);
  const anterior = [...RANGOS].reverse().find((r) => r.xpMin <= perfil.xpTotal)!;
  const pct = siguiente
    ? (perfil.xpTotal - anterior.xpMin) / (siguiente.xpMin - anterior.xpMin) : 1;

  return (
    <header className="hud">
      <div className="hud-marca">
        <button className="hud-volver" onClick={onVolver}>◀ Especialidades</button>
        <span className="hud-logo">{especialidad.titulo}</span>
        <span className="hud-sub">BECA-RPG × Quirófano Lab</span>
      </div>
      <div className="hud-vitales">
        <div className="vital">
          <span className="vital-etiqueta">BECADO</span>
          <input className="vital-nombre" value={perfil.nombre}
                 onChange={(e) => renombrar(e.target.value)} aria-label="Nombre" />
        </div>
        <div className="vital">
          <span className="vital-etiqueta">RANGO</span>
          <span className="vital-valor">{perfil.rango}</span>
        </div>
        <div className="vital">
          <span className="vital-etiqueta">XP</span>
          <span className="vital-valor vital-xp">{perfil.xpTotal}</span>
          <div className="barra-xp">
            <div className="barra-xp-relleno" style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
        </div>
        <div className="vital">
          <span className="vital-etiqueta">CARDS HOY</span>
          <span className={`vital-valor ${cardsVencidasHoy > 0 ? "vital-alerta" : ""}`}>
            {cardsVencidasHoy}
          </span>
        </div>
        <div className="vital">
          <span className="vital-etiqueta">NODOS</span>
          <span className="vital-valor">{nodos.length}</span>
        </div>
      </div>
      <div className="hud-acciones">
        <button className="boton-icono" onClick={onAbrirPapelera} title="Papelera">🗑</button>
        <button className="boton-icono" onClick={onAbrirConfiguracion} title="Configuración y respaldo">⚙</button>
        <button className="boton-reset" onClick={() => {
          if (confirm("¿Reiniciar tu progreso en TODAS las especialidades? El contenido que creaste NO se borra."))
            reiniciarProgreso();
        }}>Reiniciar progreso</button>
      </div>
    </header>
  );
}

function VistaEspecialidad({
  especialidadId, onSalir, onAbrirPapelera, onAbrirConfiguracion,
}: {
  especialidadId: string;
  onSalir: () => void;
  onAbrirPapelera: () => void;
  onAbrirConfiguracion: () => void;
}) {
  const { indice } = useStore();
  const [dominio, setDominio] = useState<string | null>(null);
  const [estudio, setEstudio] = useState<string | null>(null);
  const [taller, setTaller] = useState<string | null>(null);
  const [repaso, setRepaso] = useState<string | null>(null);
  const [crearPrincipal, setCrearPrincipal] = useState(false);

  const especialidad = indice.get(especialidadId);
  useEffect(() => { if (!especialidad) onSalir(); }, [especialidad]);
  if (!especialidad) return null;

  /** Navegar a un nodo. Si es la raíz de la especialidad, cierra paneles.
   *  Si es dominio → DomainPanel; si es estudio → NodeModal. */
  const irANodo = (id: string) => {
    const n = indice.get(id);
    if (!n || n.parent === null) {
      // Llegamos a la raíz: cerrar paneles (volver al árbol)
      setDominio(null); setEstudio(null);
      return;
    }
    if (n.clase === "dominio") { setEstudio(null); setDominio(id); }
    else { setDominio(null); setEstudio(id); }
  };

  return (
    <div className="app">
      <HUD especialidad={especialidad} onVolver={onSalir}
           onAbrirPapelera={onAbrirPapelera} onAbrirConfiguracion={onAbrirConfiguracion} />
      <SkillTreeView
        especialidadId={especialidadId}
        onAbrirDominio={setDominio}
        onAbrirEstudio={setEstudio}
        onAbrirCrearPrincipal={() => setCrearPrincipal(true)}
      />
      {dominio && (
        <DomainPanel key={dominio} nodeId={dominio}
          onCerrar={() => setDominio(null)}
          onNavegar={irANodo}
          onAbrirTaller={(id) => { setDominio(null); setTaller(id); }}
          onAbrirRepaso={(id) => setRepaso(id)}
        />
      )}
      {estudio && (
        <NodeModal key={estudio} nodeId={estudio}
          onCerrar={() => setEstudio(null)}
          onNavegar={irANodo}
          onAbrirTaller={(id) => { setEstudio(null); setTaller(id); }}
        />
      )}
      {taller && (
        <Taller key={taller} parentId={taller}
          onCerrar={() => setTaller(null)}
          onIrANodo={(id) => { setTaller(null); irANodo(id); }}
        />
      )}
      {repaso && (
        <RepasoGlobal raizId={repaso} onCerrar={() => setRepaso(null)} />
      )}
      {crearPrincipal && (
        <div className="modal-fondo" onClick={() => setCrearPrincipal(false)}>
          <aside className="modal modal-chico" onClick={(e) => e.stopPropagation()}>
            <header className="modal-cabecera">
              <span className="chip">Nuevo nodo principal</span>
              <button className="boton-cerrar" onClick={() => setCrearPrincipal(false)} aria-label="Cerrar">✕</button>
            </header>
            <p className="aviso-suave">
              Punto de partida de una nueva rama del camino dentro de {especialidad.titulo}.
            </p>
            <CrearNodoManual parentId={especialidadId} onCreado={() => setCrearPrincipal(false)} />
          </aside>
        </div>
      )}
      <footer className="pie">
        El camino es guía, no candado · contenido validado por ti · progreso en este navegador
      </footer>
    </div>
  );
}

function AppInterna() {
  const [especialidadId, setEspecialidadId] = useState<string | null>(null);
  const [papelera, setPapelera] = useState(false);
  const [config, setConfig] = useState(false);

  return (
    <>
      {!especialidadId ? (
        <div className="app">
          <SelectorEspecialidad
            onEntrar={setEspecialidadId}
            onAbrirPapelera={() => setPapelera(true)}
            onAbrirConfiguracion={() => setConfig(true)}
          />
        </div>
      ) : (
        <VistaEspecialidad
          especialidadId={especialidadId}
          onSalir={() => setEspecialidadId(null)}
          onAbrirPapelera={() => setPapelera(true)}
          onAbrirConfiguracion={() => setConfig(true)}
        />
      )}
      {papelera && <Papelera onCerrar={() => setPapelera(false)} />}
      {config && <Configuracion onCerrar={() => setConfig(false)} />}
    </>
  );
}

export default function App() {
  return <Store><AppInterna /></Store>;
}
