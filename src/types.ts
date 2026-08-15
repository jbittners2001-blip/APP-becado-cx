/**
 * ============================================================
 * BECA-RPG v3 — CONTRATO DE DATOS
 * ============================================================
 * Novedades sobre v2:
 *  - Cada nodo tiene su CARPETA DE FUENTES (Fuente[]): el material
 *    crudo que respalda su resumen. El resumen sigue viviendo en
 *    nodo.resumen ("carpeta de resúmenes" conceptual).
 *  - PAPELERA: nada se borra de verdad al eliminar un nodo. Se
 *    mueve a `papelera`, con snapshot completo para restaurar.
 *  - parentOverrides: mover un nodo (incluso uno semilla) a otro
 *    padre sin reescribir el contenido de Git.
 *  - Las "especialidades" son simplemente nodos con parent = null.
 * ============================================================
 */

export type ClaseNodo = "dominio" | "estudio";

export type TipoNodo =
  | "anatomia" | "fisiologia" | "fisiopatologia" | "diagnostico"
  | "manejo_medico" | "criterio" | "tecnica" | "complicaciones" | "transversal";

export type EscalaEvaluacion = "miller" | "zwisch";
export type NivelEscala = 1 | 2 | 3 | 4;

/** Un documento fuente dentro de la carpeta de fuentes de un nodo */
export interface Fuente {
  id: string;
  nombre: string;
  contenido: string;
  agregadoEl: string; // ISO
}

/** Un nodo del árbol */
export interface Nodo {
  id: string;
  titulo: string;
  clase: ClaseNodo;
  parent: string | null;
  tipo: TipoNodo | null;         // solo nodos de estudio
  escala: EscalaEvaluacion | null;
  prerequisitos: string[];       // gating suave, entre hermanos
  xp: number;
  archivo?: string;               // solo nodos semilla
  flashcards?: string | null;     // solo nodos semilla
  origen?: "semilla" | "taller";
  /** Carpeta de resúmenes (contenido activo) */
  resumen?: string;
  /** Carpeta de fuentes */
  fuentes?: Fuente[];
}

export interface Manifest {
  version: string;
  generadoEl: string;
  totalNodos: number;
  nodos: Nodo[];
}

export interface Flashcard {
  id: string;
  nodeId: string;
  pregunta: string;
  respuesta: string;
  nivel: "recordar" | "aplicar" | "analizar";
}

/* ---------------- Progreso del usuario ---------------- */

export type EstadoNodo = "bloqueado" | "disponible" | "en_progreso" | "dominado";

export interface MisionesNodo {
  resumen: boolean;
  flashcards: boolean;
  interrogacion: boolean;
}

export interface ProgresoNodo {
  nodeId: string;
  nivelEscala: NivelEscala | 0;
  misiones: MisionesNodo;
  xpGanado: number;
}

export interface EstadoSRS {
  cardId: string;
  ease: number;
  intervaloDias: number;
  repeticiones: number;
  lapsos: number;
  dueDate: string;
}

export interface Perfil {
  nombre: string;
  rango: string;
  xpTotal: number;
}

export interface EstadoUsuario {
  perfil: Perfil;
  nodos: Record<string, ProgresoNodo>;
  srs: Record<string, EstadoSRS>;
}

/* ---------------- Contenido creado por el usuario ---------------- */

/** Un registro en la papelera: lo suficiente para restaurar todo. */
export interface ElementoPapelera {
  id: string;
  titulo: string;
  eliminadoEl: string;
  /** IDs de nodos semilla que se ocultaron (su contenido vive en Git,
   *  solo se les apaga la visibilidad) */
  idsOcultos: string[];
  /** Nodos creados en el Taller que se removieron de verdad
   *  (guardados aquí completos para poder restaurarlos) */
  nodosGuardados: Nodo[];
}

export interface ContenidoUsuario {
  version: string;
  nodos: Nodo[];                          // nodos creados en el Taller
  cards: Record<string, Flashcard[]>;
  nodosOcultos: string[];                 // nodos semilla "eliminados"
  parentOverrides: Record<string, string | null>; // resultado de "mover"
  papelera: ElementoPapelera[];
}

/* ---------------- Utilidades ---------------- */

export const NOMBRE_TIPO: Record<TipoNodo, string> = {
  anatomia: "Anatomía",
  fisiologia: "Fisiología",
  fisiopatologia: "Fisiopatología",
  diagnostico: "Diagnóstico",
  manejo_medico: "Manejo médico",
  criterio: "Criterio Qx",
  tecnica: "Técnica",
  complicaciones: "Complicaciones",
  transversal: "Transversal",
};

export const SIGLA_TIPO: Record<TipoNodo, string> = {
  anatomia: "A", fisiologia: "F", fisiopatologia: "Fp", diagnostico: "Dx",
  manejo_medico: "Mx", criterio: "Cr", tecnica: "Tq",
  complicaciones: "Cx", transversal: "T",
};

/** "Delay quirúrgico (autonomización)" → "delay_quirurgico" */
export function aSlug(texto: string): string {
  const s = texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim().split(/\s+/).filter(Boolean).slice(0, 4).join("_")
    .slice(0, 40);
  return s || "nodo";
}

/** ID corto para fuentes y entradas de papelera (no necesita ser global) */
export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
