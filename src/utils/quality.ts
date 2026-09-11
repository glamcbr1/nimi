export type QualityLevel = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualitySettings {
  dpr: number;
  buildingCount: number;
  trafficCount: number;
  rainCount: number;
  bloom: boolean;
  shadows: boolean;
  pixelRatioCap: number;
  aa: boolean;
}

/** Composition > density — counts are towers, not mush. */
export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  ULTRA: {
    dpr: 1.75,
    buildingCount: 1600,
    trafficCount: 160,
    rainCount: 7000,
    bloom: true,
    shadows: false,
    pixelRatioCap: 2,
    aa: true,
  },
  HIGH: {
    dpr: 1.35,
    buildingCount: 1100,
    trafficCount: 110,
    rainCount: 4500,
    bloom: true,
    shadows: false,
    pixelRatioCap: 1.75,
    aa: true,
  },
  MEDIUM: {
    dpr: 1.1,
    buildingCount: 700,
    trafficCount: 55,
    rainCount: 2200,
    bloom: true,
    shadows: false,
    pixelRatioCap: 1.25,
    aa: false,
  },
  LOW: {
    dpr: 0.85,
    buildingCount: 380,
    trafficCount: 28,
    rainCount: 700,
    bloom: false,
    shadows: false,
    pixelRatioCap: 1,
    aa: false,
  },
};

export function detectInitialQuality(): QualityLevel {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  if (isMobile) return cores <= 4 ? 'LOW' : 'MEDIUM';
  if (cores >= 8 && mem >= 8) return 'HIGH';
  if (cores >= 4) return 'MEDIUM';
  return 'LOW';
}
