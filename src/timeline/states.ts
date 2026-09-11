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

/** Scroll progress 0..1 mapped to narrative phases */
export const PHASES: PhaseDef[] = [
  { id: 'INTRO', label: 'INTRO', num: '01', start: 0.0, end: 0.06 },
  { id: 'CITY_APPROACH', label: 'APPROACH', num: '02', start: 0.06, end: 0.14 },
  { id: 'IMMERSION', label: 'IMMERSION', num: '03', start: 0.14, end: 0.26 },
  { id: 'INSTABILITY', label: 'INSTABILITY', num: '04', start: 0.26, end: 0.34 },
  { id: 'FRACTURE', label: 'FRACTURE', num: '05', start: 0.34, end: 0.44 },
  { id: 'GRAVITY_FAILURE', label: 'GRAVITY', num: '06', start: 0.44, end: 0.52 },
  { id: 'FOLDING', label: 'FOLDING', num: '07', start: 0.52, end: 0.60 },
  { id: 'DIMENSION_OVERLAP', label: 'OVERLAP', num: '08', start: 0.60, end: 0.68 },
  { id: 'NON_EUCLIDEAN', label: 'NON-EUCLIDEAN', num: '09', start: 0.68, end: 0.76 },
  { id: 'CORE_REVEAL', label: 'THE CORE', num: '10', start: 0.76, end: 0.84 },
  { id: 'COLLAPSE', label: 'COLLAPSE', num: '11', start: 0.84, end: 0.90 },
  { id: 'SILENCE', label: 'SILENCE', num: '12', start: 0.90, end: 0.95 },
  { id: 'FINALE', label: 'FINALE', num: '13', start: 0.95, end: 1.0 },
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
