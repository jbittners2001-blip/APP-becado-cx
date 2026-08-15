/**
 * SkillTreeView v5 — árbol SVG horizontal compacto.
 * Se expande hacia la DERECHA. Cada rama de primer nivel hereda
 * su color. Solo el primer nivel está expandido al inicio.
 *
 * Aspectos (anatomía/criterio/técnica) → línea de color sólida
 * Subtemas (entidades específicas)     → línea discontinua gris
 *
 * Layout: dendrogram — las hojas se apilan verticalmente,
 * los nodos internos se centran entre su primer y último hijo.
 */
import { useMemo, useState } from "react";
import { useStore } from "./store";
import { separarAspectosYSubtemas } from "./content";
import { SIGLA_TIPO, type Nodo } from "./types";

const NR  = 18;   // radio del nodo
const CW  = 142;  // ancho de columna (por nivel de profundidad)
const RH  = 62;   // alto de fila (por hoja)
const PX  = 28;   // padding izquierdo
const PY  = 28;   // padding arriba

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

export function SkillTreeView({
  especialidadId, onAbrirDominio, onAbrirEstudio, onAbrirCrearPrincipal,
}: {
  especialidadId: string;
  onAbrirDominio: (id: string) => void;
  onAbrirEstudio: (id: string) => void;
  onAbrirCrearPrincipal: () => void;
}) {
  const { hijos, estadoDe, nodos } = useStore();
  const roots = hijos(especialidadId);

  // Solo expandir el primer nivel inicialmente
  const [expandido, setExpandido] = useState<Set<string>>(
    () => new Set(roots.map(r => r.id))
  );

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

  return (
    <div className="zona-arbol">
      <div className="barra-arbol">
        <div className="fila-botones">
          <button className="boton-secundario chico" onClick={() => alternarTodo(true)}>Expandir todo</button>
          <button className="boton-secundario chico" onClick={() => alternarTodo(false)}>Colapsar todo</button>
        </div>
        <button className="boton-taller" onClick={onAbrirCrearPrincipal}>+ Nodo principal</button>
      </div>

      {roots.length === 0 ? (
        <div className="vacio">
          <p>Esta especialidad todavía no tiene nodos principales.</p>
          <button className="boton-principal" onClick={onAbrirCrearPrincipal}>+ Crear el primero</button>
        </div>
      ) : (
        <div className="lienzo-scroll">
          <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}
               role="img" aria-label="Árbol de habilidades">

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
                    fill="none" opacity="0.72" />
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

              const strokeColor =
                estado === "bloqueado" ? "rgba(96,140,134,0.3)" :
                estado === "en_progreso" ? "var(--cauterio)" :
                pos.color;

              return (
                <g key={nodo.id} style={{ cursor: "pointer" }}
                   onClick={() => esDom ? onAbrirDominio(nodo.id) : onAbrirEstudio(nodo.id)}
                   role="button" tabIndex={0}
                   onKeyDown={e => e.key === "Enter" &&
                     (esDom ? onAbrirDominio(nodo.id) : onAbrirEstudio(nodo.id))}>

                  {/* Área clickable ampliada */}
                  <circle cx={pos.x} cy={pos.y} r={NR + 6} fill="transparent" />

                  {/* Círculo principal */}
                  <circle cx={pos.x} cy={pos.y} r={NR}
                    fill={estado === "dominado" ? pos.color + "25" : "var(--superficie-2)"}
                    stroke={strokeColor}
                    strokeWidth={estado === "bloqueado" ? 1 : 1.8}
                    strokeDasharray={estado === "bloqueado" ? "3 3" : "none"} />

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
                    <g onClick={e => alternar(nodo.id, e)} style={{ cursor: "pointer" }}>
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
    </div>
  );
}
