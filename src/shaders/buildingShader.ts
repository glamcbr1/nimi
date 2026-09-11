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

uniform float uTime;
uniform float uFracture;
uniform float uGravity;
uniform float uFold;
uniform float uDissolve;
uniform float uGhost;
uniform vec3 uCorePos;

void main() {
  vUv = uv;
  vSeed = instanceSeed;
  vEmissive = instanceEmissive;
  vColor = instanceColorAttr;
  vNormal = normalize(mat3(instanceMatrix) * normal);

  vec3 pos = position;
  vec4 world = instanceMatrix * vec4(pos, 1.0);

  // Gravity failure — lift & tumble higher buildings
  float hFactor = clamp(world.y / 220.0, 0.0, 1.0);
  float grav = uGravity * hFactor;
  world.y += grav * (18.0 + instanceSeed * 40.0);
  world.x += sin(instanceSeed * 40.0 + uTime * 0.4) * grav * 12.0;
  world.z += cos(instanceSeed * 30.0 + uTime * 0.35) * grav * 12.0;

  // Folding districts — rotate around city axis
  float foldAngle = uFold * (instanceSeed - 0.5) * 1.8;
  float fc = cos(foldAngle);
  float fs = sin(foldAngle);
  vec2 xz = world.xz;
  world.x = xz.x * fc - xz.y * fs;
  world.z = xz.x * fs + xz.y * fc;
  world.y += sin(length(xz) * 0.02 + uTime) * uFold * 8.0;

  // Fracture pull toward core
  vec3 toCore = uCorePos - world.xyz;
  float dist = length(toCore);
  float pull = uFracture * smoothstep(400.0, 40.0, dist) * (0.3 + instanceSeed);
  world.xyz += normalize(toCore + 0.001) * pull * 35.0;

  // Dissolve jitter
  world.xyz += (vec3(
    sin(instanceSeed * 90.0 + uTime * 3.0),
    cos(instanceSeed * 70.0 + uTime * 2.5),
    sin(instanceSeed * 50.0 - uTime * 2.0)
  ) * uDissolve * 25.0);

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

uniform float uTime;
uniform float uFracture;
uniform float uGhost;
uniform float uDissolve;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform vec3 uCameraPos;
uniform vec3 uCyan;
uniform vec3 uMagenta;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Window grid
  float floors = mix(12.0, 48.0, vSeed);
  float cols = mix(4.0, 14.0, fract(vSeed * 7.13));
  vec2 grid = vec2(vUv.x * cols, vUv.y * floors);
  vec2 cell = fract(grid);
  vec2 id = floor(grid);

  float windowMask = step(0.18, cell.x) * step(cell.x, 0.82) * step(0.12, cell.y) * step(cell.y, 0.88);
  // Side faces get fewer windows (use normal)
  float facade = pow(abs(vNormal.y) < 0.7 ? 1.0 : 0.15, 1.0);

  float lit = step(0.35, hash(id + vSeed * 10.0));
  float flicker = 0.85 + 0.15 * sin(uTime * (1.5 + vSeed * 3.0) + hash(id) * 20.0);
  vec3 windowCol = mix(uCyan * 0.55, vec3(1.0, 0.82, 0.55) * 0.45, hash(id * 1.7));
  windowCol = mix(windowCol, uMagenta * 0.7, uFracture * hash(id + 3.1));

  vec3 base = vColor * (0.08 + 0.12 * abs(vNormal.y));
  vec3 color = base;
  color += windowCol * windowMask * lit * vEmissive * flicker * facade;

  // Fracture edge glow
  float edge = pow(1.0 - abs(vNormal.y), 2.0) * abs(vNormal.x);
  color += mix(uCyan, uMagenta, 0.5 + 0.5 * sin(uTime + vSeed * 10.0)) * edge * uFracture * 0.55;

  // Ghost / dimension overlap
  color = mix(color, color.bgr * vec3(0.4, 0.9, 1.2) + uCyan * 0.15, uGhost * 0.65);

  // Dissolve
  float n = hash(vWorldPos.xz * 0.05 + vSeed);
  if (n < uDissolve) discard;
  color += uMagenta * uDissolve * 0.4;

  // Height fog
  float dist = length(vWorldPos - uCameraPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  float heightFog = smoothstep(20.0, 280.0, vWorldPos.y) * 0.35;
  fog = clamp(fog + heightFog, 0.0, 0.92);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
}
`;
