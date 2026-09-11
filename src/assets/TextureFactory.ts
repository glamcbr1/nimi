import * as THREE from 'three';

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return [canvas, ctx];
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, octaves = 4): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function toDataTexture(
  canvas: HTMLCanvasElement,
  opts: { wrap?: THREE.Wrapping; colorSpace?: THREE.ColorSpace; anisotropy?: number } = {}
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = opts.wrap ?? THREE.RepeatWrapping;
  tex.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural canvas / DataTextures — no external downloads. */
export class TextureFactory {
  static concreteAlbedo(size = 512): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Dark brutalist base
        let n = fbm(u * 6, v * 6, 5);
        const stain = fbm(u * 2.2 + 10, v * 2.2 + 3, 3);
        const fine = noise2(u * 40, v * 40);

        // Panel seams (large grid)
        const panelU = Math.abs((u * 4) % 1 - 0.5);
        const panelV = Math.abs((v * 4) % 1 - 0.5);
        const seam = panelU < 0.015 || panelV < 0.015 ? 0.55 : 1;

        // Sub-panel lines
        const subU = Math.abs((u * 12) % 1 - 0.5);
        const subV = Math.abs((v * 8) % 1 - 0.5);
        const subSeam = subU < 0.008 || subV < 0.008 ? 0.75 : 1;

        let lum = 0.045 + n * 0.07 + fine * 0.025;
        lum *= seam * subSeam;
        // Water stains / dirt streaks (vertical)
        lum *= 0.85 + stain * 0.3;
        if (stain > 0.62) lum *= 0.7;

        // Slight cool tint in cracks
        const i = (y * size + x) * 4;
        d[i] = Math.floor(lum * 255 * 0.85);
        d[i + 1] = Math.floor(lum * 255 * 0.92);
        d[i + 2] = Math.floor(lum * 255 * 1.05);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas);
  }

  static concreteRoughness(size = 512): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 8, v * 8, 4);
        const panelU = Math.abs((u * 4) % 1 - 0.5);
        const panelV = Math.abs((v * 4) % 1 - 0.5);
        const seam = panelU < 0.02 || panelV < 0.02 ? 0.35 : 0;
        // Rough concrete: high roughness, seams smoother (wet)
        let r = 0.72 + n * 0.22 - seam;
        // AO-ish darkening near seams (stored in G channel conceptually via darker)
        const ao = 1 - seam * 0.5 - (n > 0.7 ? 0.1 : 0);
        r = Math.max(0.2, Math.min(1, r));
        const i = (y * size + x) * 4;
        const g = Math.floor(r * 255);
        const aoByte = Math.floor(ao * 255);
        d[i] = g;
        d[i + 1] = aoByte;
        d[i + 2] = g;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas, { colorSpace: THREE.NoColorSpace });
  }

  /**
   * Window emissive atlas — irregular lit windows on dark facade.
   * RGB = emissive window color, A = lit mask.
   */
  static windowEmissive(size = 512): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    // Near-black facade base
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, size, size);

    const cols = 14;
    const rows = 28;
    const cellW = size / cols;
    const cellH = size / rows;
    const padX = cellW * 0.18;
    const padY = cellH * 0.14;

    for (let row = 0; row < rows; row++) {
      // Whole floor dark sometimes
      const floorLit = hash2(row, 7.3) > 0.28;
      // Cluster of dark floors
      const bandDark = hash2(Math.floor(row / 3), 2.1) < 0.22;
      for (let col = 0; col < cols; col++) {
        const occ = hash2(col * 1.7 + 0.3, row * 2.9 + 1.1);
        if (!floorLit || bandDark) continue;
        if (occ < 0.4) continue;

        const bright = occ > 0.9;
        const warm = hash2(col, row + 40) > 0.55;
        let r: number, g: number, b: number;
        if (warm) {
          r = bright ? 255 : 210;
          g = bright ? 200 : 155;
          b = bright ? 120 : 90;
        } else {
          r = bright ? 160 : 90;
          g = bright ? 230 : 170;
          b = bright ? 255 : 210;
        }
        // Occasional dead/broken window (dim blue-gray)
        if (occ > 0.38 && occ < 0.45) {
          r = 40;
          g = 50;
          b = 65;
        }

        const x = col * cellW + padX;
        const y = row * cellH + padY;
        const w = cellW - padX * 2;
        const h = cellH - padY * 2;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);

        // Inner mullion on some windows
        if (hash2(col + 3, row) > 0.7) {
          ctx.fillStyle = '#080a10';
          ctx.fillRect(x + w * 0.45, y, w * 0.08, h);
        }
      }
    }

    // Vertical facade edge darkening
    const edge = ctx.createLinearGradient(0, 0, size, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0.45)');
    edge.addColorStop(0.08, 'rgba(0,0,0,0)');
    edge.addColorStop(0.92, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);

    return toDataTexture(canvas);
  }

  static asphaltAlbedo(size = 512): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 10, v * 10, 5);
        const wet = fbm(u * 3 + 5, v * 3, 3);
        let lum = 0.03 + n * 0.05;
        // Wet patches slightly brighter / cooler
        if (wet > 0.55) lum += 0.02;
        const i = (y * size + x) * 4;
        d[i] = Math.floor(lum * 255 * 0.9);
        d[i + 1] = Math.floor(lum * 255 * 0.95);
        d[i + 2] = Math.floor(lum * 255 * 1.1);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Lane marks — dashed center + edge lines
    ctx.strokeStyle = 'rgba(180, 190, 200, 0.35)';
    ctx.lineWidth = Math.max(2, size / 128);
    ctx.setLineDash([size * 0.06, size * 0.04]);
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(160, 170, 180, 0.22)';
    ctx.beginPath();
    ctx.moveTo(size * 0.12, 0);
    ctx.lineTo(size * 0.12, size);
    ctx.moveTo(size * 0.88, 0);
    ctx.lineTo(size * 0.88, size);
    ctx.stroke();

    // Crosswalk suggestion
    ctx.fillStyle = 'rgba(170, 180, 190, 0.18)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(size * 0.2 + i * size * 0.07, size * 0.42, size * 0.035, size * 0.16);
    }

    return toDataTexture(canvas);
  }

  static metalPanel(size = 512): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 5, v * 5, 4);
        const brush = noise2(u * 60, v * 8) * 0.5 + noise2(u * 8, v * 60) * 0.5;

        // Industrial panel grid
        const pu = Math.abs((u * 6) % 1 - 0.5);
        const pv = Math.abs((v * 6) % 1 - 0.5);
        const seam = pu < 0.02 || pv < 0.02 ? 0.5 : 1;

        // Rivets
        const ru = (u * 6) % 1;
        const rv = (v * 6) % 1;
        const rivet = ru > 0.08 && ru < 0.14 && rv > 0.08 && rv < 0.14 ? 1.35 : 1;

        let lum = (0.08 + n * 0.1 + brush * 0.04) * seam * rivet;
        const i = (y * size + x) * 4;
        d[i] = Math.floor(lum * 255 * 0.95);
        d[i + 1] = Math.floor(lum * 255 * 1.0);
        d[i + 2] = Math.floor(lum * 255 * 1.15);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas);
  }

  private static _bundle: CityTextures | null = null;

  /** Shared singleton bundle for the city. */
  static getCityTextures(): CityTextures {
    if (this._bundle) return this._bundle;
    this._bundle = {
      concrete: this.concreteAlbedo(512),
      roughness: this.concreteRoughness(512),
      windows: this.windowEmissive(512),
      asphalt: this.asphaltAlbedo(512),
      metal: this.metalPanel(512),
    };
    // Reasonable UV repeats for world-scale facades
    this._bundle.concrete.repeat.set(1, 1);
    this._bundle.windows.repeat.set(1, 1);
    this._bundle.asphalt.repeat.set(40, 40);
    this._bundle.metal.repeat.set(2, 2);
    return this._bundle;
  }
}

export interface CityTextures {
  concrete: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  windows: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
}
