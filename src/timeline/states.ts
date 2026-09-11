export type Phase =
  | 'INTRO'
  | 'CITY_APPROACH'
  | 'IMMERSION'
  | 'INSTABILITY'
  | 'FRACTURE'
  | 'GRAVITY_FAILURE'
  | 'FOLDING'
  | 'DIMENSION_OVERLAP'
  | 'NON_EUCLIDEAN'
  | 'CORE_REVEAL'
  | 'COLLAPSE'
  | 'SILENCE'
  | 'FINALE';

export interface PhaseDef {
  id: Phase;
  label: string;
  num: string;
  start: number;
  end: number;
}

/** Scroll progress 0..1 — early phases stretched for readable establishing flythrough */
export const PHASES: PhaseDef[] = [
  { id: 'INTRO', label: 'INTRO', num: '01', start: 0.0, end: 0.08 },
  { id: 'CITY_APPROACH', label: 'APPROACH', num: '02', start: 0.08, end: 0.18 },
  { id: 'IMMERSION', label: 'IMMERSION', num: '03', start: 0.18, end: 0.35 },
  { id: 'INSTABILITY', label: 'INSTABILITY', num: '04', start: 0.35, end: 0.42 },
  { id: 'FRACTURE', label: 'FRACTURE', num: '05', start: 0.42, end: 0.50 },
  { id: 'GRAVITY_FAILURE', label: 'GRAVITY', num: '06', start: 0.50, end: 0.58 },
  { id: 'FOLDING', label: 'FOLDING', num: '07', start: 0.58, end: 0.66 },
  { id: 'DIMENSION_OVERLAP', label: 'OVERLAP', num: '08', start: 0.66, end: 0.73 },
  { id: 'NON_EUCLIDEAN', label: 'NON-EUCLIDEAN', num: '09', start: 0.73, end: 0.80 },
  { id: 'CORE_REVEAL', label: 'THE CORE', num: '10', start: 0.80, end: 0.87 },
  { id: 'COLLAPSE', label: 'COLLAPSE', num: '11', start: 0.87, end: 0.92 },
  { id: 'SILENCE', label: 'SILENCE', num: '12', start: 0.92, end: 0.96 },
  { id: 'FINALE', label: 'FINALE', num: '13', start: 0.96, end: 1.0 },
];

export function phaseAt(progress: number): PhaseDef {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (progress >= PHASES[i].start) return PHASES[i];
  }
  return PHASES[0];
}

export function phaseLocal(progress: number, phase: PhaseDef): number {
  return Math.max(0, Math.min(1, (progress - phase.start) / (phase.end - phase.start || 1)));
}
