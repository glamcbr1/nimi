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

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  ULTRA: {
    dpr: 1.75,
    buildingCount: 2800,
    trafficCount: 180,
    rainCount: 8000,
    bloom: true,
    shadows: false,
    pixelRatioCap: 2,
    aa: true,
  },
  HIGH: {
    dpr: 1.35,
    buildingCount: 1800,
    trafficCount: 120,
    rainCount: 5000,
    bloom: true,
    shadows: false,
    pixelRatioCap: 1.75,
    aa: true,
  },
  MEDIUM: {
    dpr: 1.1,
    buildingCount: 1000,
    trafficCount: 60,
    rainCount: 2500,
    bloom: true,
    shadows: false,
    pixelRatioCap: 1.25,
    aa: false,
  },
  LOW: {
    dpr: 0.85,
    buildingCount: 500,
    trafficCount: 30,
    rainCount: 800,
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
