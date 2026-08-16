/**
 * SkillTreeView v5 — árbol SVG horizontal compacto.
 * Se expande hacia la DERECHA. Cada rama de primer nivel hereda
 * su color. Solo el primer nivel está expandido al inicio.
 *
 * Aspectos (anatomía/criterio/técnica) → línea de color sólida
 * Subtemas (entidades específicas)     → línea discontinua gris
 *
 * MOVER NODOS: botón "✏️ Modificar". En modo edición, arrastra
 * cualquier nodo y suéltalo sobre un dominio (o sobre "nivel
 * principal") para reasignar su padre. Sin <select>, sin ciclos.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import { separarAspectosYSubtemas, descendientesDe, rutaHasta } from "./content";
import { SIGLA_TIPO, type Nodo } from "./types";

const NR  = 18;   // radio del nodo
const CW  = 142;  // ancho de columna (por nivel de profundidad)
const RH  = 62;   // alto de fila (por hoja)
const PX  = 28;   // padding izquierdo
const PY  = 28;   // padding arriba

const RAIZ = "__raiz__"; // destino de soltar = nivel principal

const BRANCH_COLORS = [
  "#2ee6a8", "#f2b33d", "#5fb3ff", "#c98bff",
  "#ff7a7a", "#7ce0d3", "#e6d02e", "#a8e62e",
];

interface NodePos { x: number; y: number; color: string; }

interface LayoutResult {
  puestos: Map<string, NodePos>;
  aspectoIds: Set<string>; // para estilo de borde
  ancho: number;
  alto: number;
}

function calcLayout(
  roots: Nodo[],
  getHijos: (id: string) => Nodo[],
  expandido: Set<string>
): LayoutResult {
  const puestos = new Map<string, NodePos>();
  const aspectoIds = new Set<string>();
  let leaf = 0;

  function visit(n: Nodo, depth: number, color: string, isAspecto: boolean) {
    if (isAspecto) aspectoIds.add(n.id);

    const rawH = getHijos(n.id);
    const { aspectos, subtemas } = separarAspectosYSubtemas(rawH);
    const visible = expandido.has(n.id) && (aspectos.length + subtemas.length > 0);

    if (!visible) {
      puestos.set(n.id, { x: PX + depth * CW, y: PY + leaf * RH, color });
      leaf++;
      return;
    }

    for (const c of aspectos) visit(c, depth + 1, color, true);
    if (aspectos.length > 0 && subtemas.length > 0) leaf += 0.4; // hueco visual
    for (const c of subtemas) visit(c, depth + 1, color, false);

    const all = [...aspectos, ...subtemas];
    const ys = all.map(c => puestos.get(c.id)?.y ?? 0);
    puestos.set(n.id, {
      x: PX + depth * CW,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      color,
    });
  }

  roots.forEach((r, i) => visit(r, 0, BRANCH_COLORS[i % BRANCH_COLORS.length], true));

  const allPos = [...puestos.values()];
  if (!allPos.length) return { puestos, aspectoIds, ancho: 400, alto: 200 };

  return {
    puestos, aspectoIds,
    ancho: Math.max(...allPos.map(p => p.x)) + CW + 20,
    alto: Math.max(...allPos.map(p => p.y)) + RH + 20,
  };
}

function NodoLabel({ titulo, cx, baseY }: { titulo: string; cx: number; baseY: number }) {
  const words = titulo.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > 13 && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return (
    <>
      {lines.slice(0, 2).map((l, i) => (
        <text key={i} x={cx} y={baseY + i * 11} textAnchor="middle"
              fontSize="8.5" fontFamily="var(--mono)" fill="var(--apagado)"
              style={{ pointerEvents: "none", userSelect: "none" }}>
          {i === 1 && lines.length > 2 ? l.slice(0, 12) + "…" : l}
        </text>
      ))}
    </>
  );
}

interface Arrastre {
  id: string;
  titulo: string;
  descendientes: Set<string>;
}

export function SkillTreeView({
  especialidadId, onAbrirDominio, onAbrirEstudio, onAbrirCrearPrincipal,
}: {
  especialidadId: string;
  onAbrirDominio: (id: string) => void;
  onAbrirEstudio: (id: string) => void;
  onAbrirCrearPrincipal: () => void;
}) {
  const { hijos, estadoDe, nodos, indice, moverNodo } = useStore();
  const roots = hijos(especialidadId);
  const especialidad = indice.get(especialidadId);

  // Solo expandir el primer nivel inicialmente
  const [expandido, setExpandido] = useState<Set<string>>(
    () => new Set(roots.map(r => r.id))
  );

  const [busqueda, setBusqueda] = useState("");
  const [modoEdicion, setModoEdicion] = useState(false);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const resultados = useMemo(() => {
    const q = norm(busqueda.trim());
    if (q.length < 2) return [];
    return descendientesDe(nodos, especialidadId)
      .filter((n) => norm(n.titulo).includes(q))
      .slice(0, 12);
  }, [busqueda, nodos, especialidadId]);

  const irAResultado = (id: string) => {
    const ruta = rutaHasta(indice, id);
    const ancestros = ruta.slice(0, -1).map((n) => n.id); // todos menos el propio nodo
    setExpandido((prev) => new Set([...prev, ...ancestros]));
    const n = indice.get(id);
    if (n) (n.clase === "dominio" ? onAbrirDominio : onAbrirEstudio)(id);
    setBusqueda("");
  };
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [objetivo, setObjetivo] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const objetivoRef = useRef<string | null>(null);

  const alternarTodo = (exp: boolean) =>
    setExpandido(exp
      ? new Set(nodos.filter(n => n.clase === "dominio").map(n => n.id))
      : new Set()
    );

  const alternar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandido(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const { puestos, aspectoIds, ancho, alto } = useMemo(() => {
    const rs = hijos(especialidadId);
    return calcLayout(rs, id => hijos(id), expandido);
  }, [nodos, expandido, especialidadId]);

  const nodosRender = useMemo(() => {
    const out: Nodo[] = [];
    puestos.forEach((_, id) => {
      const n = nodos.find(x => x.id === id);
      if (n) out.push(n);
    });
    return out;
  }, [puestos, nodos]);

  /* --------- Drag and drop por punteros --------- */

  // ¿El destino bajo el puntero es válido para el nodo arrastrado?
  const destinoValido = (dropId: string | null, a: Arrastre | null): boolean => {
    if (!dropId || !a) return false;
    if (dropId === RAIZ) return indice.get(a.id)?.parent !== especialidadId;
    if (dropId === a.id || a.descendientes.has(dropId)) return false;
    const destino = indice.get(dropId);
    if (!destino || destino.clase !== "dominio") return false;
    return indice.get(a.id)?.parent !== dropId; // ya está ahí
  };

  const iniciarArrastre = (nodo: Nodo, e: React.PointerEvent) => {
    if (!modoEdicion || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const a: Arrastre = {
      id: nodo.id,
      titulo: nodo.titulo,
      descendientes: new Set(descendientesDe(nodos, nodo.id).map(d => d.id)),
    };
    arrastreRef.current = a;
    setArrastre(a);
    setAviso(null);
    setGhost({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!arrastre) return;

    const hallarDrop = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      const con = el?.closest("[data-drop-id]") as HTMLElement | null;
      return con?.getAttribute("data-drop-id") ?? null;
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      setGhost({ x: e.clientX, y: e.clientY });
      const dropId = hallarDrop(e.clientX, e.clientY);
      const valido = destinoValido(dropId, arrastreRef.current);
      const nuevo = valido ? dropId : null;
      objetivoRef.current = nuevo;
      setObjetivo(nuevo);
    };

    const onUp = () => {
      const a = arrastreRef.current;
      const destino = objetivoRef.current;
      if (a && destino) {
        const nuevoParent = destino === RAIZ ? especialidadId : destino;
        const err = moverNodo(a.id, nuevoParent);
        if (err) setAviso(err);
        else {
          const dest = destino === RAIZ
            ? (especialidad?.titulo ?? "nivel principal")
            : (indice.get(destino)?.titulo ?? "destino");
          setAviso(`"${a.titulo}" → ${dest} ✓`);
          if (destino !== RAIZ) setExpandido(prev => new Set(prev).add(destino));
          setTimeout(() => setAviso(null), 2600);
        }
      }
      arrastreRef.current = null;
      objetivoRef.current = null;
      setArrastre(null);
      setObjetivo(null);
      setGhost(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [arrastre, especialidadId, especialidad, indice, moverNodo]);

  const salirEdicion = () => {
    setModoEdicion(false);
    setArrastre(null);
    setObjetivo(null);
    setGhost(null);
  };

  return (
    <div className="zona-arbol">
      <div className="barra-arbol">
        <div className="fila-botones">
          <button className="boton-secundario chico" onClick={() => alternarTodo(true)}>Expandir todo</button>
          <button className="boton-secundario chico" onClick={() => alternarTodo(false)}>Colapsar todo</button>
          <button
            className={modoEdicion ? "boton-principal chico" : "boton-secundario chico"}
            style={{ marginTop: 0 }}
            onClick={() => (modoEdicion ? salirEdicion() : setModoEdicion(true))}>
            {modoEdicion ? "✓ Listo" : "✏️ Modificar"}
          </button>
        </div>
        <div className="buscador-arbol">
          <input className="input-linea" value={busqueda} placeholder="🔍 Buscar tema o subtema…"
                 onChange={(e) => setBusqueda(e.target.value)} />
          {resultados.length > 0 && (
            <ul className="buscador-resultados">
              {resultados.map((n) => {
                const ruta = rutaHasta(indice, n.id).slice(0, -1).map((x) => x.titulo).join(" › ");
                return (
                  <li key={n.id}>
                    <button onClick={() => irAResultado(n.id)}>
                      <strong>{n.titulo}</strong>
                      {ruta && <span className="buscador-ruta">{ruta}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {busqueda.trim().length >= 2 && resultados.length === 0 && (
            <ul className="buscador-resultados"><li className="buscador-vacio">Sin resultados</li></ul>
          )}
        </div>
        <button className="boton-taller" onClick={onAbrirCrearPrincipal}>+ Nodo principal</button>
      </div>

      {modoEdicion && (
        <div className="barra-edicion">
          <span className="nota-fina">
            Arrastra un nodo y suéltalo sobre un dominio para cambiar su padre.
          </span>
          <span
            data-drop-id={RAIZ}
            className={`zona-raiz ${objetivo === RAIZ ? "activa" : ""}`}>
            ⤒ soltar aquí → nivel principal de {especialidad?.titulo ?? ""}
          </span>
        </div>
      )}

      {aviso && <div className="aviso-mover">{aviso}</div>}

      {roots.length === 0 ? (
        <div className="vacio">
          <p>Esta especialidad todavía no tiene nodos principales.</p>
          <button className="boton-principal" onClick={onAbrirCrearPrincipal}>+ Crear el primero</button>
        </div>
      ) : (
        <div className="lienzo-scroll">
          <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}
               role="img" aria-label="Árbol de habilidades"
               style={{ touchAction: modoEdicion ? "none" : "auto" }}>

            {/* Bordes */}
            {nodosRender.map(nodo => {
              if (!expandido.has(nodo.id)) return null;
              const from = puestos.get(nodo.id);
              if (!from) return null;
              const { aspectos, subtemas } = separarAspectosYSubtemas(hijos(nodo.id));
              return [...aspectos, ...subtemas].map(child => {
                const to = puestos.get(child.id);
                if (!to) return null;
                const isAspecto = aspectoIds.has(child.id);
                const x1 = from.x + NR, x2 = to.x - NR, mx = (x1 + x2) / 2;
                return (
                  <path key={`${nodo.id}→${child.id}`}
                    d={`M ${x1} ${from.y} C ${mx} ${from.y} ${mx} ${to.y} ${x2} ${to.y}`}
                    stroke={isAspecto ? from.color : "rgba(96,140,134,0.35)"}
                    strokeWidth="1.4"
                    strokeDasharray={isAspecto ? "none" : "5 4"}
                    fill="none" opacity="0.72"
                    style={{ pointerEvents: "none" }} />
                );
              });
            })}

            {/* Nodos */}
            {nodosRender.map(nodo => {
              const pos = puestos.get(nodo.id);
              if (!pos) return null;
              const estado = estadoDe(nodo.id);
              const esDom = nodo.clase === "dominio";
              const abierto = expandido.has(nodo.id);
              const tieneHijos = hijos(nodo.id).length > 0;
              const sigla = esDom ? "▸" : (SIGLA_TIPO[nodo.tipo ?? "transversal"] ?? "?");
              const esObjetivo = objetivo === nodo.id;
              const esArrastrado = arrastre?.id === nodo.id;

              const strokeColor =
                esObjetivo ? "var(--exito, #2ee6a8)" :
                estado === "bloqueado" ? "rgba(96,140,134,0.3)" :
                estado === "en_progreso" ? "var(--cauterio)" :
                pos.color;

              const abrir = () => {
                if (modoEdicion) return; // en edición, clic no navega
                esDom ? onAbrirDominio(nodo.id) : onAbrirEstudio(nodo.id);
              };

              return (
                <g key={nodo.id}
                   data-drop-id={nodo.id}
                   style={{
                     cursor: modoEdicion ? "grab" : "pointer",
                     opacity: esArrastrado ? 0.35 : 1,
                   }}
                   onPointerDown={e => iniciarArrastre(nodo, e)}
                   onClick={abrir}
                   role="button" tabIndex={0}
                   onKeyDown={e => e.key === "Enter" && abrir()}>

                  {/* Área clickable ampliada */}
                  <circle cx={pos.x} cy={pos.y} r={NR + 6} fill="transparent" />

                  {/* Halo de destino válido */}
                  {esObjetivo && (
                    <circle cx={pos.x} cy={pos.y} r={NR + 8} fill="none"
                            stroke="var(--exito, #2ee6a8)" strokeWidth="2"
                            strokeDasharray="4 3" style={{ pointerEvents: "none" }} />
                  )}

                  {/* Círculo principal */}
                  <circle cx={pos.x} cy={pos.y} r={NR}
                    fill={estado === "dominado" ? pos.color + "25" : "var(--superficie-2)"}
                    stroke={strokeColor}
                    strokeWidth={esObjetivo ? 2.4 : estado === "bloqueado" ? 1 : 1.8}
                    strokeDasharray={estado === "bloqueado" ? "3 3" : "none"}
                    style={{ pointerEvents: "none" }} />

                  {/* Sigla */}
                  <text x={pos.x} y={pos.y + (esDom ? 5 : 4)} textAnchor="middle"
                        fontSize={esDom ? 12 : 10} fontWeight="700"
                        fontFamily="var(--mono)"
                        fill={estado === "bloqueado" ? "var(--apagado)" : pos.color}
                        style={{ pointerEvents: "none", userSelect: "none" }}>
                    {sigla}
                  </text>

                  {/* Check de dominado */}
                  {estado === "dominado" && (
                    <text x={pos.x + NR - 2} y={pos.y - NR + 5}
                          fontSize="9" fontWeight="700" fill={pos.color}
                          style={{ pointerEvents: "none" }}>✓</text>
                  )}

                  {/* Etiqueta debajo */}
                  <NodoLabel titulo={nodo.titulo} cx={pos.x} baseY={pos.y + NR + 10} />

                  {/* Botón expandir/colapsar */}
                  {esDom && tieneHijos && (
                    <g onClick={e => alternar(nodo.id, e)}
                       onPointerDown={e => e.stopPropagation()}
                       style={{ cursor: "pointer" }}>
                      <circle cx={pos.x + NR - 1} cy={pos.y - NR + 1} r={7}
                        fill="var(--superficie)" stroke={pos.color} strokeWidth="1.2" />
                      <text x={pos.x + NR - 1} y={pos.y - NR + 5.5}
                            textAnchor="middle" fontSize="11" fontWeight="700"
                            fontFamily="var(--mono)" fill={pos.color}
                            style={{ pointerEvents: "none" }}>
                        {abierto ? "−" : "+"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Fantasma que sigue al cursor mientras se arrastra */}
      {arrastre && ghost && (
        <div className="fantasma-arrastre"
             style={{ left: ghost.x + 14, top: ghost.y + 14 }}>
          {arrastre.titulo}
        </div>
      )}
    </div>
  );
}
