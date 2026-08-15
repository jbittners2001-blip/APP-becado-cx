/**
 * Motor de repetición espaciada — algoritmo SM-2 (el de Anki).
 * Portado de Quirófano Lab al contrato de datos unificado.
 */
import type { EstadoSRS } from "./types";

/** Calidad de la respuesta:
 *  2 = Otra vez (la olvidó) · 3 = Difícil · 4 = Bien · 5 = Fácil */
export type Calidad = 2 | 3 | 4 | 5;

export function estadoInicial(cardId: string): EstadoSRS {
  return {
    cardId,
    ease: 2.5,
    intervaloDias: 0,
    repeticiones: 0,
    lapsos: 0,
    dueDate: hoyISO(),
  };
}

export function revisar(prev: EstadoSRS, calidad: Calidad): EstadoSRS {
  let { ease, intervaloDias, repeticiones, lapsos } = prev;

  if (calidad < 3) {
    // La olvidó: se reinicia el intervalo
    repeticiones = 0;
    intervaloDias = 1;
    lapsos += 1;
  } else {
    repeticiones += 1;
    if (repeticiones === 1) intervaloDias = 1;
    else if (repeticiones === 2) intervaloDias = 6;
    else intervaloDias = Math.round(intervaloDias * ease);
  }

  // Ajuste del factor de facilidad (fórmula SM-2 clásica)
  ease = Math.max(
    1.3,
    ease + 0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02)
  );

  const due = new Date();
  due.setDate(due.getDate() + intervaloDias);

  return {
    cardId: prev.cardId,
    ease: Number(ease.toFixed(2)),
    intervaloDias,
    repeticiones,
    lapsos,
    dueDate: due.toISOString().slice(0, 10),
  };
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function estaVencida(s: EstadoSRS): boolean {
  return s.dueDate <= hoyISO();
}
