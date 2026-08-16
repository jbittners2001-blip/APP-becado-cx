/**
 * Estado global. Dos almacenes SEPARADOS en localStorage:
 *   "beca-rpg:progreso"  → XP, misiones, SRS  (el becado)
 *   "beca-rpg:contenido" → nodos, cards, fuentes, papelera, movidas
 * Esa separación es la que permitirá, en fase 3, mandar el
 * progreso a Supabase y el contenido a Git sin desenredar nada.
 */
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import type {
  EstadoUsuario, ContenidoUsuario, Nodo, Flashcard, Fuente,
  ProgresoNodo, EstadoNodo, MisionesNodo, NivelEscala, ElementoPapelera,
} from "./types";
import { aSlug, nuevoId } from "./types";
import {
  nodosSemilla, resumenSemilla, construirIndice, hijosDe, descendientesDe,
  idUnicoEnNivel, plantillaEstandar,
} from "./content";
import { estadoInicial, revisar, estaVencida, hoyISO, type Calidad } from "./srs";

const K_PROG = "beca-rpg:progreso";        // legado (perfil único, pre-fase 2)
const K_CONT = "beca-rpg:contenido";
const K_PERFILES = "beca-rpg:perfiles";    // registro de perfiles de becado
const progKey = (id: string) => `${K_PROG}:${id}`;

/** Registro de perfiles: quién está activo y la lista de becados. El
 *  progreso de cada uno vive en su propia clave (progKey). El contenido
 *  (currículo, nodos, cards) es compartido entre todos los perfiles. */
export interface RegistroPerfiles {
  activo: string;
  lista: { id: string; nombre: string }[];
}

/** Inicializa el registro de perfiles, migrando el progreso antiguo
 *  (perfil único) al primer perfil la primera vez. */
function iniciarPerfiles(): RegistroPerfiles {
  try {
    const crudo = localStorage.getItem(K_PERFILES);
    if (crudo) {
      const reg = JSON.parse(crudo) as RegistroPerfiles;
      if (reg.lista?.length && reg.lista.some((p) => p.id === reg.activo)) return reg;
    }
  } catch { /* cae a la migración */ }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let nombre = "Becado";
  const legado = localStorage.getItem(K_PROG);
  if (legado) {
    try { nombre = JSON.parse(legado)?.perfil?.nombre || "Becado"; } catch { /* nada */ }
    if (!localStorage.getItem(progKey(id))) localStorage.setItem(progKey(id), legado);
  }
  const reg: RegistroPerfiles = { activo: id, lista: [{ id, nombre }] };
  localStorage.setItem(K_PERFILES, JSON.stringify(reg));
  return reg;
}

export const RANGOS = [
  { nombre: "Interno", xpMin: 0 },
  { nombre: "Becado I", xpMin: 400 },
  { nombre: "Becado II", xpMin: 1000 },
  { nombre: "Becado III", xpMin: 1800 },
  { nombre: "Cirujano Joven", xpMin: 3000 },
];

const progresoVacio = (): EstadoUsuario => ({
  perfil: { nombre: "Becado", rango: "Interno", xpTotal: 0 },
  nodos: {}, srs: {},
});

const contenidoVacio = (): ContenidoUsuario => ({
  version: "3.0.0", nodos: [], cards: {},
  nodosOcultos: [], parentOverrides: {}, papelera: [],
});

function leer<T>(clave: string, porDefecto: () => T): T {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto();
  } catch { return porDefecto(); }
}

const misionesVacias = (): MisionesNodo => ({
  resumen: false, flashcards: false, interrogacion: false,
});

interface API {
  // contenido
  nodos: Nodo[];
  indice: Map<string, Nodo>;
  hijos: (parentId: string | null) => Nodo[];
  resumenDe: (nodeId: string) => string;
  fuentesDe: (nodeId: string) => Fuente[];
  cardsDe: (nodeId: string) => Flashcard[];
  crearNodos: (nuevos: Nodo[]) => void;
  crearEspecialidad: (titulo: string) => string;
  guardarCards: (nodeId: string, cards: Flashcard[]) => void;
  guardarResumen: (nodeId: string, texto: string) => void;
  actualizarNodo: (nodeId: string, cambios: Partial<Nodo>) => void;
  agregarFuente: (nodeId: string, nombre: string, contenido: string) => void;
  eliminarFuente: (nodeId: string, fuenteId: string) => void;
  agregarPlantilla: (nodeId: string) => void;
  moverNodo: (nodeId: string, nuevoParentId: string | null) => string | null;
  eliminarNodo: (nodeId: string) => void;
  contenidoUsuario: ContenidoUsuario;
  importarContenido: (c: ContenidoUsuario) => void;
  restaurarDePapelera: (entradaId: string) => void;
  purgarDePapelera: (entradaId: string) => void;
  vaciarPapelera: () => void;
  // progreso
  usuario: EstadoUsuario;
  progresoDe: (nodeId: string) => ProgresoNodo;
  estadoDe: (nodeId: string) => EstadoNodo;
  completarMision: (nodeId: string, m: keyof MisionesNodo) => void;
  registrarReview: (cardId: string, q: Calidad) => void;
  fijarNivel: (nodeId: string, n: NivelEscala) => void;
  cardsVencidasHoy: number;
  renombrar: (nombre: string) => void;
  reiniciarProgreso: () => void;
  // perfiles de becado
  perfiles: RegistroPerfiles;
  crearPerfil: (nombre: string) => void;
  cambiarPerfil: (id: string) => void;
  eliminarPerfil: (id: string) => void;
  // respaldo completo (para Google Drive): contenido + progreso del perfil activo
  exportarEstado: () => string;
  importarEstado: (json: string) => void;
}

const Ctx = createContext<API | null>(null);

export function Store({ children }: { children: ReactNode }) {
  const [perfiles, setPerfiles] = useState<RegistroPerfiles>(iniciarPerfiles);
  const [usuario, setUsuario] = useState<EstadoUsuario>(() => leer(progKey(perfiles.activo), progresoVacio));
  const [contenido, setContenido] = useState<ContenidoUsuario>(() => {
    const c = leer(K_CONT, contenidoVacio);
    // Compatibilidad con exportaciones/versiones anteriores sin estos campos
    return { ...contenidoVacio(), ...c };
  });

  // El progreso se guarda en la clave del perfil ACTIVO.
  useEffect(() => {
    localStorage.setItem(progKey(perfiles.activo), JSON.stringify(usuario));
  }, [usuario, perfiles.activo]);
  useEffect(() => { localStorage.setItem(K_PERFILES, JSON.stringify(perfiles)); }, [perfiles]);
  useEffect(() => { localStorage.setItem(K_CONT, JSON.stringify(contenido)); }, [contenido]);

  const nodos = useMemo(() => {
    const ocultos = new Set(contenido.nodosOcultos);
    const overrides = contenido.parentOverrides;
    const conOverride = (n: Nodo): Nodo =>
      overrides[n.id] !== undefined ? { ...n, parent: overrides[n.id] } : n;
    const semilla = nodosSemilla.filter((n) => !ocultos.has(n.id)).map(conOverride);
    const taller = contenido.nodos.filter((n) => !ocultos.has(n.id)).map(conOverride);
    return [...semilla, ...taller];
  }, [contenido]);

  const indice = useMemo(() => construirIndice(nodos), [nodos]);
  const hijos = (parentId: string | null) => hijosDe(nodos, parentId);

  const resumenDe = (nodeId: string): string => {
    const n = indice.get(nodeId);
    if (!n) return "";
    if (n.resumen) return n.resumen;
    return resumenSemilla(nodeId);
  };

  const fuentesDe = (nodeId: string): Fuente[] => indice.get(nodeId)?.fuentes ?? [];
  const cardsDe = (nodeId: string): Flashcard[] => contenido.cards[nodeId] ?? [];

  const crearNodos = (nuevos: Nodo[]) =>
    setContenido((c) => ({ ...c, nodos: [...c.nodos, ...nuevos] }));

  const crearEspecialidad = (titulo: string): string => {
    const id = idUnicoEnNivel(indice, null, aSlug(titulo));
    crearNodos([{
      id, titulo, clase: "dominio", parent: null, tipo: null, escala: null,
      prerequisitos: [], xp: 0, origen: "taller",
    }]);
    return id;
  };

  /** Toda edición de contenido pasa por aquí: si el nodo es semilla,
   *  se "clona" al Taller con el cambio ya aplicado (copy-on-write). */
  const actualizarNodo = (nodeId: string, cambios: Partial<Nodo>) =>
    setContenido((c) => {
      if (c.nodos.some((n) => n.id === nodeId))
        return { ...c, nodos: c.nodos.map((n) => n.id === nodeId ? { ...n, ...cambios } : n) };
      const base = indice.get(nodeId);
      if (!base) return c;
      return { ...c, nodos: [...c.nodos, { ...base, ...cambios, origen: "taller" as const }] };
    });

  const guardarResumen = (nodeId: string, texto: string) => actualizarNodo(nodeId, { resumen: texto });
  const guardarCards = (nodeId: string, cards: Flashcard[]) =>
    setContenido((c) => ({ ...c, cards: { ...c.cards, [nodeId]: cards } }));

  const agregarFuente = (nodeId: string, nombre: string, contenidoTexto: string) =>
    actualizarNodo(nodeId, {
      fuentes: [...fuentesDe(nodeId), {
        id: nuevoId(), nombre, contenido: contenidoTexto, agregadoEl: hoyISO(),
      }],
    });

  const eliminarFuente = (nodeId: string, fuenteId: string) =>
    actualizarNodo(nodeId, { fuentes: fuentesDe(nodeId).filter((f) => f.id !== fuenteId) });

  const agregarPlantilla = (nodeId: string) => crearNodos(plantillaEstandar(indice, nodeId));

  const moverNodo = (nodeId: string, nuevoParentId: string | null): string | null => {
    if (nodeId === nuevoParentId) return "Un nodo no puede ser su propio padre.";
    if (nuevoParentId) {
      const destino = indice.get(nuevoParentId);
      if (!destino) return "El destino no existe.";
      if (destino.clase !== "dominio") return "Solo puedes mover nodos dentro de un dominio.";
      const descendientesIds = descendientesDe(nodos, nodeId).map((d) => d.id);
      if (descendientesIds.includes(nuevoParentId))
        return "No puedes mover un nodo dentro de su propio contenido.";
    }
    setContenido((c) => ({
      ...c, parentOverrides: { ...c.parentOverrides, [nodeId]: nuevoParentId },
    }));
    return null;
  };

  const eliminarNodo = (nodeId: string) => {
    const nodo = indice.get(nodeId);
    if (!nodo) return;
    const subarbol = [nodo, ...descendientesDe(nodos, nodeId)];
    const idsTaller = new Set(contenido.nodos.map((n) => n.id));
    const idsOcultos = subarbol.filter((n) => !idsTaller.has(n.id)).map((n) => n.id);
    const nodosGuardados = subarbol
      .filter((n) => idsTaller.has(n.id))
      .map((n) => contenido.nodos.find((u) => u.id === n.id)!);
    const entrada: ElementoPapelera = {
      id: nuevoId(), titulo: nodo.titulo, eliminadoEl: hoyISO(), idsOcultos, nodosGuardados,
    };
    setContenido((c) => ({
      ...c,
      nodosOcultos: [...new Set([...c.nodosOcultos, ...idsOcultos])],
      nodos: c.nodos.filter((n) => !nodosGuardados.some((g) => g.id === n.id)),
      papelera: [entrada, ...c.papelera],
    }));
  };

  const restaurarDePapelera = (entradaId: string) =>
    setContenido((c) => {
      const entrada = c.papelera.find((e) => e.id === entradaId);
      if (!entrada) return c;
      const ocultosSet = new Set(c.nodosOcultos);
      entrada.idsOcultos.forEach((id) => ocultosSet.delete(id));
      const nodosNuevos = [...c.nodos];
      entrada.nodosGuardados.forEach((ng) => {
        if (!nodosNuevos.some((n) => n.id === ng.id)) nodosNuevos.push(ng);
      });
      return {
        ...c,
        nodosOcultos: [...ocultosSet],
        nodos: nodosNuevos,
        papelera: c.papelera.filter((e) => e.id !== entradaId),
      };
    });

  const purgarDePapelera = (entradaId: string) =>
    setContenido((c) => ({ ...c, papelera: c.papelera.filter((e) => e.id !== entradaId) }));

  const vaciarPapelera = () => setContenido((c) => ({ ...c, papelera: [] }));

  const importarContenido = (c: ContenidoUsuario) => setContenido({ ...contenidoVacio(), ...c });

  /* ---------------- perfiles de becado ---------------- */

  const nuevoIdPerfil = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const crearPerfil = (nombre: string) => {
    const limpio = nombre.trim() || `Becado ${perfiles.lista.length + 1}`;
    const id = nuevoIdPerfil();
    const progreso: EstadoUsuario = { ...progresoVacio(), perfil: { nombre: limpio, rango: "Interno", xpTotal: 0 } };
    localStorage.setItem(progKey(id), JSON.stringify(progreso));
    setUsuario(progreso);
    setPerfiles((p) => ({ activo: id, lista: [...p.lista, { id, nombre: limpio }] }));
  };

  const cambiarPerfil = (id: string) => {
    if (id === perfiles.activo) return;
    if (!perfiles.lista.some((p) => p.id === id)) return;
    // el progreso actual ya está persistido por el efecto; cargamos el otro
    setUsuario(leer(progKey(id), progresoVacio));
    setPerfiles((p) => ({ ...p, activo: id }));
  };

  const eliminarPerfil = (id: string) => {
    if (perfiles.lista.length <= 1) return; // siempre debe quedar uno
    const restantes = perfiles.lista.filter((p) => p.id !== id);
    localStorage.removeItem(progKey(id));
    if (id === perfiles.activo) {
      const siguiente = restantes[0].id;
      setUsuario(leer(progKey(siguiente), progresoVacio));
      setPerfiles({ activo: siguiente, lista: restantes });
    } else {
      setPerfiles((p) => ({ ...p, lista: restantes }));
    }
  };

  /* ---------------- respaldo completo (Google Drive) ---------------- */

  const exportarEstado = (): string =>
    JSON.stringify({ version: "5.0.0", contenido, progreso: usuario }, null, 2);

  const importarEstado = (json: string) => {
    const datos = JSON.parse(json);
    if (datos.contenido && Array.isArray(datos.contenido.nodos))
      setContenido({ ...contenidoVacio(), ...datos.contenido });
    if (datos.progreso && datos.progreso.perfil) setUsuario(datos.progreso as EstadoUsuario);
  };

  /* ---------------- progreso ---------------- */

  const progresoDe = (nodeId: string): ProgresoNodo =>
    usuario.nodos[nodeId] ?? { nodeId, nivelEscala: 0, misiones: misionesVacias(), xpGanado: 0 };

  const estadoDe = (nodeId: string): EstadoNodo => {
    const nodo = indice.get(nodeId);
    if (!nodo) return "disponible";

    if (nodo.clase === "dominio") {
      const hs = hijosDe(nodos, nodeId);
      if (hs.length === 0) return "disponible";
      const estados = hs.map((h) => estadoDe(h.id));
      if (estados.every((e) => e === "dominado")) return "dominado";
      if (estados.some((e) => e === "dominado" || e === "en_progreso")) return "en_progreso";
    } else {
      const { misiones } = progresoDe(nodeId);
      if (misiones.resumen && misiones.flashcards && misiones.interrogacion) return "dominado";
      if (misiones.resumen || misiones.flashcards || misiones.interrogacion) return "en_progreso";
    }

    const listos = nodo.prerequisitos.every((p) => estadoDe(p) === "dominado");
    return listos ? "disponible" : "bloqueado";
  };

  const rangoDe = (xp: number) => [...RANGOS].reverse().find((r) => xp >= r.xpMin)!.nombre;

  const completarMision = (nodeId: string, mision: keyof MisionesNodo) =>
    setUsuario((u) => {
      const p = u.nodos[nodeId] ?? { nodeId, nivelEscala: 0 as const, misiones: misionesVacias(), xpGanado: 0 };
      if (p.misiones[mision]) return u;
      const misiones = { ...p.misiones, [mision]: true };
      const completo = misiones.resumen && misiones.flashcards && misiones.interrogacion;
      const xpNuevo = completo && p.xpGanado === 0 ? (indice.get(nodeId)?.xp ?? 0) : 0;
      const xpTotal = u.perfil.xpTotal + xpNuevo;
      return {
        ...u,
        perfil: { ...u.perfil, xpTotal, rango: rangoDe(xpTotal) },
        nodos: { ...u.nodos, [nodeId]: { ...p, misiones, xpGanado: p.xpGanado + xpNuevo } },
      };
    });

  const registrarReview = (cardId: string, q: Calidad) =>
    setUsuario((u) => ({
      ...u, srs: { ...u.srs, [cardId]: revisar(u.srs[cardId] ?? estadoInicial(cardId), q) },
    }));

  const fijarNivel = (nodeId: string, nivel: NivelEscala) =>
    setUsuario((u) => {
      const p = u.nodos[nodeId] ?? { nodeId, nivelEscala: 0 as const, misiones: misionesVacias(), xpGanado: 0 };
      return { ...u, nodos: { ...u.nodos, [nodeId]: { ...p, nivelEscala: nivel } } };
    });

  const cardsVencidasHoy = useMemo(() => {
    let n = 0;
    for (const lista of Object.values(contenido.cards))
      for (const c of lista) {
        const s = usuario.srs[c.id];
        if (s && estaVencida(s)) n++;
      }
    return n;
  }, [usuario.srs, contenido.cards]);

  const api: API = {
    nodos, indice, hijos, resumenDe, fuentesDe, cardsDe, crearNodos, crearEspecialidad,
    guardarCards, guardarResumen, actualizarNodo, agregarFuente, eliminarFuente,
    agregarPlantilla, moverNodo, eliminarNodo, contenidoUsuario: contenido, importarContenido,
    restaurarDePapelera, purgarDePapelera, vaciarPapelera,
    usuario, progresoDe, estadoDe, completarMision, registrarReview, fijarNivel, cardsVencidasHoy,
    renombrar: (nombre) => {
      setUsuario((u) => ({ ...u, perfil: { ...u.perfil, nombre } }));
      setPerfiles((p) => ({
        ...p,
        lista: p.lista.map((x) => (x.id === p.activo ? { ...x, nombre } : x)),
      }));
    },
    reiniciarProgreso: () =>
      setUsuario((u) => ({ ...progresoVacio(), perfil: { ...progresoVacio().perfil, nombre: u.perfil.nombre } })),
    perfiles, crearPerfil, cambiarPerfil, eliminarPerfil, exportarEstado, importarEstado,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): API {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore fuera de Store");
  return c;
}
