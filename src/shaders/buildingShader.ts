export const buildingVertexShader = /* glsl */ `
attribute vec3 instanceColorAttr;
attribute float instanceSeed;
attribute float instanceEmissive;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vSeed;
varying float vEmissive;
varying vec3 vColor;
varying float vHeightNorm;

uniform float uTime;
uniform float uFracture;
uniform float uGravity;
uniform float uFold;
uniform float uDissolve;
uniform float uGhost;
uniform vec3 uCorePos;

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c);
}
mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c);
}
mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0);
}

void main() {
  vUv = uv;
  vSeed = instanceSeed;
  vEmissive = instanceEmissive;
  vColor = instanceColorAttr;

  vec3 pos = position;
  vec4 world = instanceMatrix * vec4(pos, 1.0);
  vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  // Approximate building height from instance Y scale (matrix column length)
  float hScale = length(vec3(instanceMatrix[1].x, instanceMatrix[1].y, instanceMatrix[1].z));
  vHeightNorm = clamp(world.y / max(hScale, 1.0), 0.0, 1.0);

  // --- GRAVITY FAILURE: district-scale lift + tumble (readable at city scale) ---
  float hFactor = clamp(origin.y / 80.0 + hScale / 280.0, 0.0, 1.0);
  float grav = uGravity * hFactor;
  float gSeed = instanceSeed * 6.2831;
  world.y += grav * (25.0 + instanceSeed * 70.0);
  // Tumble rotation around building origin
  float tumble = grav * (instanceSeed - 0.5) * 1.4;
  vec3 local = world.xyz - origin;
  local = rotZ(tumble * 0.7) * rotX(tumble * 0.45) * local;
  world.xyz = origin + local;
  world.x += sin(gSeed + uTime * 0.35) * grav * 22.0;
  world.z += cos(gSeed * 1.3 + uTime * 0.3) * grav * 22.0;

  // --- FOLD: districts tilt & rotate as massive plates ---
  float ang = atan(origin.z + 0.001, origin.x + 0.001);
  float rad = length(origin.xz);
  float sector = floor((ang + 3.14159) / 1.047) ; // ~6 wedges
  float foldAmt = uFold * (0.55 + 0.45 * fract(sin(sector * 12.9898) * 43758.5453));
  float foldAngle = foldAmt * (sector - 2.5) * 0.55;
  // Radial plate lift
  float plateLift = sin(rad * 0.012 + sector) * foldAmt * 35.0;
  // Rotate entire wedge around city Y
  vec2 xz = world.xz;
  float fc = cos(foldAngle);
  float fs = sin(foldAngle);
  world.x = xz.x * fc - xz.y * fs;
  world.z = xz.x * fs + xz.y * fc;
  world.y += plateLift;
  // Inward pitch toward core as fold deepens
  vec3 toC = uCorePos - world.xyz;
  float pitch = foldAmt * clamp(1.0 - rad / 350.0, 0.0, 1.0) * 0.65;
  world.xyz += normalize(toC + vec3(0.0, 0.001, 0.0)) * pitch * 40.0;

  // --- FRACTURE: radial pull + crack jitter toward wound ---
  float dist = length(uCorePos - world.xyz);
  float pull = uFracture * smoothstep(420.0, 30.0, dist) * (0.35 + instanceSeed);
  world.xyz += normalize(uCorePos - world.xyz + 0.001) * pull * 55.0;
  // Vertical shear cracks
  world.x += sin(origin.z * 0.08 + uTime * 1.5 + instanceSeed * 20.0) * uFracture * 4.0 * hFactor;
  world.y += cos(origin.x * 0.06 + instanceSeed * 10.0) * uFracture * 3.0;

  // Dissolve scatter
  world.xyz += vec3(
    sin(instanceSeed * 90.0 + uTime * 3.0),
    cos(instanceSeed * 70.0 + uTime * 2.5),
    sin(instanceSeed * 50.0 - uTime * 2.0)
  ) * uDissolve * 40.0;

  // Ghost: slight duplicate offset in vertex (chromatic feel)
  world.xyz += vec3(uGhost * sin(instanceSeed * 40.0) * 3.0, 0.0, uGhost * cos(instanceSeed * 30.0) * 3.0);

  vNormal = normalize(mat3(instanceMatrix) * normal);
  // Re-orient normal roughly under tumble/fold (cheap)
  if (grav > 0.01 || foldAmt > 0.01) {
    vNormal = normalize(rotZ(tumble * 0.7) * rotX(tumble * 0.45) * vNormal);
  }

  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const buildingFragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vSeed;
varying float vEmissive;
varying vec3 vColor;
varying float vHeightNorm;

uniform float uTime;
uniform float uFracture;
uniform float uGhost;
uniform float uDissolve;
uniform float uGravity;
uniform float uFold;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform vec3 uCameraPos;
uniform vec3 uCorePos;
uniform vec3 uCyan;
uniform vec3 uMagenta;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);

  // --- Wet dark concrete base ---
  float up = abs(N.y);
  float facade = 1.0 - smoothstep(0.55, 0.95, up);
  // Fake AO at vertical edges + base
  float edgeAO = pow(abs(N.x) * abs(N.z) * 4.0, 0.35);
  float baseAO = mix(0.55, 1.0, smoothstep(0.0, 0.15, vHeightNorm));
  vec3 concrete = vColor * (0.55 + 0.45 * baseAO);
  // Subtle vertical weathering bands
  float bands = 0.92 + 0.08 * sin(vUv.y * 40.0 + vSeed * 20.0);
  concrete *= bands;
  // Wet specular rim (cold industrial night)
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  concrete += vec3(0.15, 0.22, 0.32) * fres * 0.35 * facade;
  // Top faces darker wet roofs
  concrete = mix(concrete, concrete * 0.35, smoothstep(0.7, 1.0, up));

  // --- Window grid (hash occupancy, uneven) ---
  float floors = mix(18.0, 64.0, vSeed);
  float cols = mix(5.0, 18.0, fract(vSeed * 7.13));
  // Roof/ground faces: no windows
  vec2 grid = vec2(vUv.x * cols, vUv.y * floors);
  vec2 cell = fract(grid);
  vec2 id = floor(grid);

  float frameX = step(0.14, cell.x) * step(cell.x, 0.86);
  float frameY = step(0.1, cell.y) * step(cell.y, 0.9);
  float windowMask = frameX * frameY * facade;

  float occ = hash21(id + vSeed * 11.0);
  // Uneven: clusters of dark floors
  float floorBand = hash21(vec2(id.y * 0.1, vSeed * 3.0));
  float lit = step(0.38, occ) * step(0.22, floorBand);
  // Occasional bright offices
  float bright = step(0.92, occ);

  float flicker = 0.88 + 0.12 * sin(uTime * (1.2 + vSeed * 2.5) + hash(id) * 20.0);
  // Power flicker during instability
  float power = 1.0 - uFracture * 0.35 * step(0.7, hash(id + floor(uTime * 2.0)));
  flicker *= power;

  vec3 warm = vec3(1.0, 0.78, 0.48) * 0.55;
  vec3 cool = uCyan * 0.5;
  vec3 windowCol = mix(cool, warm, hash21(id * 1.7 + 2.3));
  windowCol = mix(windowCol, uMagenta * 0.65, uFracture * hash21(id + 5.1) * 0.85);
  windowCol *= (1.0 + bright * 0.85);

  vec3 color = concrete;
  color += windowCol * windowMask * lit * vEmissive * flicker;

  // Vertical edge lighting (cheap rim on corners)
  float vertEdge = pow(1.0 - abs(N.y), 2.5) * (abs(N.x) + abs(N.z)) * 0.5;
  color += vec3(0.2, 0.35, 0.5) * vertEdge * 0.25 * (0.4 + vEmissive * 0.6);

  // --- Fracture energy veins (cyan/magenta cracks) ---
  float crackN = hash21(floor(vUv * vec2(cols, floors) * 0.5) + vSeed);
  float vein = smoothstep(0.72, 0.95, crackN) * facade;
  float pulse = 0.6 + 0.4 * sin(uTime * 3.0 + vSeed * 12.0 + vWorldPos.y * 0.05);
  vec3 veinCol = mix(uCyan, uMagenta, 0.5 + 0.5 * sin(uTime + vSeed * 8.0));
  color += veinCol * vein * uFracture * pulse * 1.1;
  // Edge fracture glow
  color += veinCol * vertEdge * uFracture * 0.7;

  // Ghost / dimension overlap wash
  color = mix(color, color.bgr * vec3(0.35, 0.85, 1.15) + uCyan * 0.12, uGhost * 0.7);

  // Dissolve
  float n = hash21(vWorldPos.xz * 0.04 + vSeed);
  if (n < uDissolve * 0.95) discard;
  color += uMagenta * uDissolve * 0.35;

  // Core proximity magenta wash
  float coreDist = length(vWorldPos - uCorePos);
  color += uMagenta * 0.15 * uFracture * smoothstep(120.0, 20.0, coreDist);

  // Atmospheric fog — softens distance dramatically
  float dist = length(vWorldPos - uCameraPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  float heightFog = smoothstep(30.0, 320.0, vWorldPos.y) * 0.4;
  fog = clamp(fog + heightFog * (1.0 - uDissolve), 0.0, 0.95);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
}
`;
