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
varying vec3 vLocalPos;

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
  vLocalPos = position;

  vec3 pos = position;
  vec4 world = instanceMatrix * vec4(pos, 1.0);
  vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  float hScale = length(vec3(instanceMatrix[1].x, instanceMatrix[1].y, instanceMatrix[1].z));
  vHeightNorm = clamp(world.y / max(hScale, 1.0), 0.0, 1.0);

  float hFactor = clamp(origin.y / 80.0 + hScale / 280.0, 0.0, 1.0);
  float grav = uGravity * hFactor;
  float gSeed = instanceSeed * 6.2831;
  world.y += grav * (25.0 + instanceSeed * 70.0);
  float tumble = grav * (instanceSeed - 0.5) * 1.4;
  vec3 local = world.xyz - origin;
  local = rotZ(tumble * 0.7) * rotX(tumble * 0.45) * local;
  world.xyz = origin + local;
  world.x += sin(gSeed + uTime * 0.35) * grav * 22.0;
  world.z += cos(gSeed * 1.3 + uTime * 0.3) * grav * 22.0;

  float ang = atan(origin.z + 0.001, origin.x + 0.001);
  float rad = length(origin.xz);
  float sector = floor((ang + 3.14159) / 1.047);
  float foldAmt = uFold * (0.55 + 0.45 * fract(sin(sector * 12.9898) * 43758.5453));
  float foldAngle = foldAmt * (sector - 2.5) * 0.55;
  float plateLift = sin(rad * 0.012 + sector) * foldAmt * 35.0;
  vec2 xz = world.xz;
  float fc = cos(foldAngle);
  float fs = sin(foldAngle);
  world.x = xz.x * fc - xz.y * fs;
  world.z = xz.x * fs + xz.y * fc;
  world.y += plateLift;
  vec3 toC = uCorePos - world.xyz;
  float pitch = foldAmt * clamp(1.0 - rad / 350.0, 0.0, 1.0) * 0.65;
  world.xyz += normalize(toC + vec3(0.0, 0.001, 0.0)) * pitch * 40.0;

  float dist = length(uCorePos - world.xyz);
  float pull = uFracture * smoothstep(420.0, 30.0, dist) * (0.35 + instanceSeed);
  world.xyz += normalize(uCorePos - world.xyz + 0.001) * pull * 55.0;
  world.x += sin(origin.z * 0.08 + uTime * 1.5 + instanceSeed * 20.0) * uFracture * 4.0 * hFactor;
  world.y += cos(origin.x * 0.06 + instanceSeed * 10.0) * uFracture * 3.0;

  world.xyz += vec3(
    sin(instanceSeed * 90.0 + uTime * 3.0),
    cos(instanceSeed * 70.0 + uTime * 2.5),
    sin(instanceSeed * 50.0 - uTime * 2.0)
  ) * uDissolve * 40.0;

  world.xyz += vec3(uGhost * sin(instanceSeed * 40.0) * 3.0, 0.0, uGhost * cos(instanceSeed * 30.0) * 3.0);

  vNormal = normalize(mat3(instanceMatrix) * normal);
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
varying vec3 vLocalPos;

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

uniform sampler2D uConcreteMap;
uniform sampler2D uRoughnessMap;
uniform sampler2D uWindowMap;
uniform sampler2D uMetalMap;
uniform float uUseTextures;

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

  float up = abs(N.y);
  float facade = 1.0 - smoothstep(0.55, 0.95, up);

  float uvScaleX = mix(2.2, 6.0, fract(vSeed * 5.17));
  float uvScaleY = mix(3.5, 10.0, fract(vSeed * 9.31));
  vec2 facadeUV = vec2(vUv.x * uvScaleX, vUv.y * uvScaleY);
  facadeUV.y *= mix(1.0, 1.85, clamp(vHeightNorm * 2.0, 0.0, 1.0));

  vec3 concreteTex = texture2D(uConcreteMap, facadeUV).rgb;
  vec3 roughAO = texture2D(uRoughnessMap, facadeUV).rgb;
  vec4 windowTex = texture2D(uWindowMap, facadeUV);
  vec3 metalTex = texture2D(uMetalMap, facadeUV * 1.5).rgb;

  float roughness = roughAO.r;
  float ao = roughAO.g;

  // Sharper midtone separation — less muddy
  vec3 concrete = mix(vColor * 0.65, concreteTex * (0.5 + vColor * 1.8), uUseTextures);
  concrete = pow(max(concrete, vec3(0.0)), vec3(0.92)); // slight contrast lift
  concrete *= (0.5 + 0.5 * ao);

  // Rim AO — darken grazing / vertical edges into silhouette
  float rimAO = pow(1.0 - abs(dot(N, V)), 1.8);
  concrete *= mix(1.0, 0.72, rimAO * 0.55 * facade);

  float baseAO = mix(0.5, 1.0, smoothstep(0.0, 0.12, vHeightNorm));
  float topAO = mix(1.0, 0.85, smoothstep(0.9, 1.0, vHeightNorm));
  concrete *= baseAO * topAO;

  // Metal crowns with anisotropic streak feel
  float metalMask = smoothstep(0.82, 0.98, vHeightNorm) * 0.7
                  + step(0.85, fract(vSeed * 13.7)) * 0.35 * facade;
  concrete = mix(concrete, metalTex * 0.6 + vColor * 0.28, metalMask * uUseTextures);

  // Wet fresnel — env fake
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8);
  float wetAmt = (0.22 + (1.0 - roughness) * 0.45) * facade;
  concrete += vec3(0.18, 0.26, 0.38) * fres * wetAmt;
  concrete = mix(concrete, concrete * 0.38, smoothstep(0.7, 1.0, up));

  // --- Windows: sharp contrast + fake GI spill onto facade ---
  vec3 windowCol = windowTex.rgb;
  float winLum = max(windowCol.r, max(windowCol.g, windowCol.b));
  float lit = smoothstep(0.06, 0.18, winLum) * facade;

  // Cluster power flicker
  float cluster = hash(floor(facadeUV * 4.0) + floor(vSeed * 8.0));
  float flicker = 0.88 + 0.12 * sin(uTime * (1.0 + vSeed * 2.4) + vSeed * 40.0);
  float powerCut = step(0.72, hash(floor(facadeUV * 6.0) + floor(uTime * 1.8)));
  float power = 1.0 - uFracture * 0.45 * powerCut * step(0.55, cluster);
  // Occasional whole-cluster blink during fracture
  if (uFracture > 0.3 && cluster > 0.85) {
    power *= 0.35 + 0.65 * step(0.5, fract(uTime * 3.2 + cluster * 10.0));
  }
  flicker *= power;

  windowCol = mix(windowCol, uMagenta * 0.75, uFracture * hash21(floor(facadeUV * 10.0) + 5.1) * 0.65);

  vec3 color = concrete;
  // Bright windows punch through
  color += windowCol * lit * vEmissive * flicker * 1.35 * uUseTextures;
  // Fake GI: lit windows softly warm nearby facade (desaturated spill)
  color += windowCol * lit * vEmissive * 0.18 * facade * uUseTextures;

  if (uUseTextures < 0.5) {
    float floors = mix(18.0, 64.0, vSeed);
    float cols = mix(5.0, 18.0, fract(vSeed * 7.13));
    vec2 grid = vec2(vUv.x * cols, vUv.y * floors);
    vec2 cell = fract(grid);
    vec2 id = floor(grid);
    float windowMask = step(0.14, cell.x) * step(cell.x, 0.86) * step(0.1, cell.y) * step(cell.y, 0.9) * facade;
    float occ = hash21(id + vSeed * 11.0);
    float floorBand = hash21(vec2(id.y * 0.1, vSeed * 3.0));
    float litP = step(0.38, occ) * step(0.22, floorBand);
    vec3 warm = vec3(1.0, 0.78, 0.48) * 0.55;
    vec3 cool = uCyan * 0.5;
    vec3 wc = mix(cool, warm, hash21(id * 1.7 + 2.3));
    color += wc * windowMask * litP * vEmissive * flicker;
  }

  // Vertical edge cyan rim (subtle, cinematic)
  float vertEdge = pow(1.0 - abs(N.y), 2.5) * (abs(N.x) + abs(N.z)) * 0.5;
  color += vec3(0.22, 0.38, 0.55) * vertEdge * 0.28 * (0.35 + vEmissive * 0.65);

  // Fracture energy veins — dangerous, not club
  float crackN = hash21(floor(facadeUV * 6.0) + vSeed);
  float vein = smoothstep(0.74, 0.96, crackN) * facade;
  float pulse = 0.55 + 0.45 * sin(uTime * 2.6 + vSeed * 12.0 + vWorldPos.y * 0.05);
  vec3 veinCol = mix(uCyan * 0.85, uMagenta * 0.9, 0.5 + 0.5 * sin(uTime + vSeed * 8.0));
  color += veinCol * vein * uFracture * pulse * 0.95;
  color += veinCol * vertEdge * uFracture * 0.55;

  color = mix(color, color.bgr * vec3(0.35, 0.85, 1.15) + uCyan * 0.12, uGhost * 0.7);

  float n = hash21(vWorldPos.xz * 0.04 + vSeed);
  if (n < uDissolve * 0.95) discard;
  color += uMagenta * uDissolve * 0.35;

  float coreDist = length(vWorldPos - uCorePos);
  color += uMagenta * 0.12 * uFracture * smoothstep(120.0, 20.0, coreDist);

  // Multi-layer fog: exp2 distance + height haze
  float dist = length(vWorldPos - uCameraPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  float heightFog = smoothstep(40.0, 380.0, vWorldPos.y) * 0.45;
  float groundHaze = smoothstep(0.0, 25.0, vWorldPos.y) * 0.08 * (1.0 - facade * 0.5);
  fog = clamp(fog + heightFog * (1.0 - uDissolve) + groundHaze, 0.0, 0.96);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
}
`;
