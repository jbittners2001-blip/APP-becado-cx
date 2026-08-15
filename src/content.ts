/**
 * Capa de contenido. Une DOS fuentes:
 *   1. Semilla: los .md de /content (versionados en Git)
 *   2. Taller: los nodos que TÚ creas (guardados en el navegador,
 *      exportables a Git)
 * El resto de la app no distingue el origen.
 */
import manifestJson from "../content/manifest.json";
import type { Manifest, Nodo, Flashcard, TipoNodo, EscalaEvaluacion } from "./types";

export const manifestSemilla = manifestJson as unknown as Manifest;

const mdFiles = import.meta.glob("../content/nodos/*.md", {
  as: "raw", eager: true,
}) as Record<string, string>;

/** Cuerpo markdown de un nodo semilla (sin frontmatter) */
export function resumenSemilla(nodeId: string): string {
  const entrada = Object.entries(mdFiles).find(([ruta]) =>
    ruta.endsWith(`/${nodeId}.md`)
  );
  if (!entrada) return "";
  const partes = entrada[1].split(/^---\s*$/m);
  return partes.length >= 3 ? partes.slice(2).join("---").trim() : entrada[1];
}

export const nodosSemilla: Nodo[] = manifestSemilla.nodos.map((n) => ({
  ...n,
  origen: "semilla" as const,
}));

/* ---------- Operaciones sobre el árbol combinado ---------- */

export function construirIndice(nodos: Nodo[]): Map<string, Nodo> {
  return new Map(nodos.map((n) => [n.id, n]));
}

export function hijosDe(nodos: Nodo[], parentId: string | null): Nodo[] {
  return nodos.filter((n) => n.parent === parentId);
}

export function raices(nodos: Nodo[]): Nodo[] {
  return hijosDe(nodos, null);
}

/** Camino desde la raíz hasta el nodo (para la miga de pan) */
export function rutaHasta(indice: Map<string, Nodo>, nodeId: string): Nodo[] {
  const ruta: Nodo[] = [];
  let actual = indice.get(nodeId);
  const vistos = new Set<string>();
  while (actual && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    ruta.unshift(actual);
    actual = actual.parent ? indice.get(actual.parent) : undefined;
  }
  return ruta;
}

/** Todos los descendientes de un nodo (recursivo, a prueba de ciclos) */
export function descendientesDe(
  nodos: Nodo[], id: string, vistos = new Set<string>()
): Nodo[] {
  if (vistos.has(id)) return [];
  vistos.add(id);
  const directos = hijosDe(nodos, id);
  return directos.flatMap((h) => [h, ...descendientesDe(nodos, h.id, vistos)]);
}

/** Sugiere un ID único en un nivel dado. parentId=null → nivel raíz
 *  (especialidades), sin punto de prefijo. */
export function idUnicoEnNivel(
  indice: Map<string, Nodo>, parentId: string | null, slug: string
): string {
  let candidato = parentId ? `${parentId}.${slug}` : slug;
  let n = 2;
  while (indice.has(candidato)) {
    candidato = parentId ? `${parentId}.${slug}_${n++}` : `${slug}_${n++}`;
  }
  return candidato;
}

/** Orden canónico y progresivo de los aspectos de un tema quirúrgico:
 *  primero se conoce la anatomía, luego el criterio de indicación,
 *  y recién al final la técnica (que incluye sus complicaciones). */
export const ORDEN_ASPECTO: TipoNodo[] = [
  "anatomia", "fisiologia", "fisiopatologia", "diagnostico",
  "criterio", "manejo_medico", "tecnica", "complicaciones", "transversal",
];

/** Ordena los hijos de clase "estudio" según el orden progresivo. */
export function ordenarAspectos(hijosEstudio: Nodo[]): Nodo[] {
  return [...hijosEstudio].sort((a, b) => {
    const ia = ORDEN_ASPECTO.indexOf(a.tipo ?? "transversal");
    const ib = ORDEN_ASPECTO.indexOf(b.tipo ?? "transversal");
    return ia - ib;
  });
}

/** Separa los hijos de un nodo en dos grupos: los ASPECTOS (nodos de
 *  estudio propios de este nivel, en orden progresivo) y los
 *  SUBTEMAS (dominios que profundizan una entidad específica). Nunca
 *  se mezclan al mismo nivel visual. */
export function separarAspectosYSubtemas(hijosDeUnNodo: Nodo[]): { aspectos: Nodo[]; subtemas: Nodo[] } {
  return {
    aspectos: ordenarAspectos(hijosDeUnNodo.filter((h) => h.clase === "estudio")),
    subtemas: hijosDeUnNodo.filter((h) => h.clase === "dominio"),
  };
}

/** La plantilla estándar de todo tema quirúrgico, en orden progresivo:
 *  anatomía/fisiología → criterio de indicación → técnica y
 *  complicaciones. Encadenados como camino. */
export function plantillaEstandar(
  indice: Map<string, Nodo>, parentId: string
): Nodo[] {
  const partes: {
    sufijo: string; titulo: string; tipo: TipoNodo; escala: EscalaEvaluacion;
  }[] = [
    { sufijo: "anatomia", titulo: "Anatomía y fisiología", tipo: "anatomia", escala: "miller" },
    { sufijo: "criterio", titulo: "Criterio de indicación", tipo: "criterio", escala: "miller" },
    { sufijo: "tecnica", titulo: "Técnica y complicaciones", tipo: "tecnica", escala: "zwisch" },
  ];
  const out: Nodo[] = [];
  let anterior: string | null = null;
  for (const p of partes) {
    const id = idUnicoEnNivel(indice, parentId, p.sufijo);
    out.push({
      id, titulo: p.titulo, clase: "estudio", parent: parentId,
      tipo: p.tipo, escala: p.escala,
      prerequisitos: anterior ? [anterior] : [],
      xp: 110, origen: "taller",
    });
    anterior = id;
  }
  return out;
}

export type { Flashcard };
