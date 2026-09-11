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
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural canvas / DataTextures — film-still facade detail, no downloads. */
export class TextureFactory {
  static concreteAlbedo(size = 1024): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        let n = fbm(u * 7, v * 7, 5);
        const stain = fbm(u * 2.4 + 10, v * 2.4 + 3, 4);
        const fine = noise2(u * 55, v * 55);
        // Vertical dirt streaks
        const streak = fbm(u * 14, v * 1.2 + 20, 3);

        const panelU = Math.abs((u * 4) % 1 - 0.5);
        const panelV = Math.abs((v * 4) % 1 - 0.5);
        const seam = panelU < 0.012 || panelV < 0.012 ? 0.48 : 1;

        const subU = Math.abs((u * 12) % 1 - 0.5);
        const subV = Math.abs((v * 8) % 1 - 0.5);
        const subSeam = subU < 0.006 || subV < 0.006 ? 0.72 : 1;

        // Wetness variation patches
        const wet = fbm(u * 3.5 + 2, v * 3.5, 3);
        let lum = 0.042 + n * 0.075 + fine * 0.022;
        lum *= seam * subSeam;
        lum *= 0.82 + stain * 0.32;
        if (stain > 0.62) lum *= 0.68;
        // Dirt streaks pull darker
        lum *= 0.92 + streak * 0.16;
        if (streak > 0.7 && u > 0.1 && u < 0.9) lum *= 0.78;
        // Wet patches slightly darker / cooler
        if (wet > 0.58) lum *= 0.88;

        const i = (y * size + x) * 4;
        const cool = wet > 0.58 ? 1.12 : 1.05;
        d[i] = Math.floor(lum * 255 * 0.82);
        d[i + 1] = Math.floor(lum * 255 * 0.9);
        d[i + 2] = Math.floor(lum * 255 * cool);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas);
  }

  static concreteRoughness(size = 1024): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 8, v * 8, 4);
        const wet = fbm(u * 3.5 + 2, v * 3.5, 3);
        const panelU = Math.abs((u * 4) % 1 - 0.5);
        const panelV = Math.abs((v * 4) % 1 - 0.5);
        const seam = panelU < 0.018 || panelV < 0.018 ? 0.4 : 0;
        let r = 0.7 + n * 0.24 - seam;
        if (wet > 0.58) r -= 0.28; // wet = smoother
        const ao = 1 - seam * 0.55 - (n > 0.72 ? 0.12 : 0);
        r = Math.max(0.15, Math.min(1, r));
        const i = (y * size + x) * 4;
        d[i] = Math.floor(r * 255);
        d[i + 1] = Math.floor(Math.max(0, Math.min(1, ao)) * 255);
        d[i + 2] = Math.floor(r * 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas, { colorSpace: THREE.NoColorSpace });
  }

  /**
   * Window emissive atlas — irregular occupancy, mixed sizes, bright floors.
   * RGB = emissive window color, dark = unlit facade.
   */
  static windowEmissive(size = 1024): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, size, size);

    const cols = 16;
    const rows = 32;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let row = 0; row < rows; row++) {
      const floorLit = hash2(row, 7.3) > 0.22;
      const bandDark = hash2(Math.floor(row / 3), 2.1) < 0.18;
      // Occasional fully bright floor (office overtime / party)
      const brightFloor = hash2(row, 19.7) > 0.92;
      for (let col = 0; col < cols; col++) {
        const occ = hash2(col * 1.7 + 0.3, row * 2.9 + 1.1);
        if (!floorLit || bandDark) continue;
        if (!brightFloor && occ < 0.38) continue;

        // Variable window sizes
        const sizeVar = hash2(col + 9, row + 3);
        const padX = cellW * (sizeVar > 0.7 ? 0.08 : sizeVar > 0.4 ? 0.16 : 0.22);
        const padY = cellH * (sizeVar > 0.75 ? 0.08 : 0.14);
        // Double-wide occasional
        const wide = hash2(col, row + 50) > 0.88 && col < cols - 1;

        const bright = brightFloor || occ > 0.88;
        const warm = hash2(col, row + 40) > 0.52;
        let r: number, g: number, b: number;
        if (warm) {
          r = bright ? 255 : 200;
          g = bright ? 195 : 145;
          b = bright ? 110 : 78;
        } else {
          r = bright ? 150 : 78;
          g = bright ? 225 : 155;
          b = bright ? 255 : 200;
        }
        if (occ > 0.36 && occ < 0.42) {
          r = 35;
          g = 45;
          b = 58;
        }

        const x = col * cellW + padX;
        const y = row * cellH + padY;
        const w = (wide ? cellW * 2 : cellW) - padX * 2;
        const h = cellH - padY * 2;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);

        // Soft bloom bleed into facade (fake GI hint baked into atlas)
        if (bright) {
          ctx.fillStyle = `rgba(${r},${g},${b},0.12)`;
          ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        }

        if (hash2(col + 3, row) > 0.65) {
          ctx.fillStyle = '#060810';
          ctx.fillRect(x + w * 0.45, y, w * 0.07, h);
        }
        if (wide) col++; // skip next
      }
    }

    const edge = ctx.createLinearGradient(0, 0, size, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0.5)');
    edge.addColorStop(0.07, 'rgba(0,0,0,0)');
    edge.addColorStop(0.93, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);

    return toDataTexture(canvas);
  }

  static asphaltAlbedo(size = 1024): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 12, v * 12, 5);
        const wet = fbm(u * 3.2 + 5, v * 3.2, 4);
        const puddle = fbm(u * 1.8 + 1, v * 1.8 + 7, 3);
        let lum = 0.028 + n * 0.048;
        // Darker puddle patches
        if (puddle > 0.62) lum *= 0.55;
        else if (wet > 0.55) lum += 0.018;
        const i = (y * size + x) * 4;
        const cool = puddle > 0.62 ? 1.2 : 1.08;
        d[i] = Math.floor(lum * 255 * 0.88);
        d[i + 1] = Math.floor(lum * 255 * 0.94);
        d[i + 2] = Math.floor(lum * 255 * cool);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Readable lane marks
    ctx.strokeStyle = 'rgba(200, 210, 220, 0.42)';
    ctx.lineWidth = Math.max(3, size / 110);
    ctx.setLineDash([size * 0.07, size * 0.045]);
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(175, 185, 195, 0.28)';
    ctx.lineWidth = Math.max(2, size / 160);
    ctx.beginPath();
    ctx.moveTo(size * 0.12, 0);
    ctx.lineTo(size * 0.12, size);
    ctx.moveTo(size * 0.88, 0);
    ctx.lineTo(size * 0.88, size);
    ctx.stroke();

    // Secondary dashed lanes
    ctx.strokeStyle = 'rgba(160, 170, 180, 0.18)';
    ctx.setLineDash([size * 0.03, size * 0.05]);
    ctx.beginPath();
    ctx.moveTo(size * 0.31, 0);
    ctx.lineTo(size * 0.31, size);
    ctx.moveTo(size * 0.69, 0);
    ctx.lineTo(size * 0.69, size);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(185, 195, 205, 0.22)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(size * 0.2 + i * size * 0.07, size * 0.42, size * 0.035, size * 0.16);
    }

    return toDataTexture(canvas);
  }

  static metalPanel(size = 1024): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 5, v * 5, 4);
        // Anisotropic-looking brushed streaks (horizontal bias)
        const brushH = noise2(u * 4, v * 90) * 0.65 + noise2(u * 12, v * 40) * 0.35;
        const brushV = noise2(u * 70, v * 6) * 0.25;

        const pu = Math.abs((u * 6) % 1 - 0.5);
        const pv = Math.abs((v * 6) % 1 - 0.5);
        const seam = pu < 0.018 || pv < 0.018 ? 0.45 : 1;

        const ru = (u * 6) % 1;
        const rv = (v * 6) % 1;
        const rivet = ru > 0.07 && ru < 0.13 && rv > 0.07 && rv < 0.13 ? 1.4 : 1;

        let lum = (0.07 + n * 0.1 + brushH * 0.06 + brushV * 0.02) * seam * rivet;
        const i = (y * size + x) * 4;
        d[i] = Math.floor(lum * 255 * 0.92);
        d[i + 1] = Math.floor(lum * 255 * 0.98);
        d[i + 2] = Math.floor(lum * 255 * 1.18);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toDataTexture(canvas);
  }

  private static _bundle: CityTextures | null = null;

  static getCityTextures(): CityTextures {
    if (this._bundle) return this._bundle;
    this._bundle = {
      concrete: this.concreteAlbedo(1024),
      roughness: this.concreteRoughness(1024),
      windows: this.windowEmissive(1024),
      asphalt: this.asphaltAlbedo(1024),
      metal: this.metalPanel(1024),
    };
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
