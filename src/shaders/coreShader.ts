/** Dimensional wound — void disc with magenta accretion rim (not a cute orb) */
export const coreVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPos;
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec3 p = position;
  // Subtle event-horizon warble on the rim
  float r = length(p.xz);
  float n = sin(atan(p.z, p.x) * 6.0 + uTime * 1.8) * cos(p.y * 8.0 - uTime);
  p += normal * n * 0.04 * uIntensity * smoothstep(0.3, 1.0, r);
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const coreFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vPos;
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  vec3 N = normalize(vNormal);
  // View-ish fresnel (works in view space approx)
  float fresnel = pow(1.0 - abs(dot(N, vec3(0.0, 0.0, 1.0))), 2.8);
  float r = length(vPos.xz);
  float radial = smoothstep(0.0, 0.55, r);

  // Void interior — near black
  vec3 voidCol = vec3(0.01, 0.005, 0.02);
  // Magenta / cyan accretion rim
  float pulse = 0.7 + 0.3 * sin(uTime * 2.2 + r * 10.0);
  vec3 rim = mix(uColorA, uColorB, fresnel * pulse);
  rim *= (0.5 + fresnel * 1.8) * radial;

  // Light-bend hint: bright thin ring
  float ring = smoothstep(0.08, 0.0, abs(r - 0.72)) * 2.2;
  rim += mix(uColorB, uColorA, 0.4) * ring * pulse;

  vec3 col = mix(voidCol, rim, clamp(fresnel * 0.85 + ring * 0.5, 0.0, 1.0));
  float alpha = mix(0.92, 0.35, radial * (1.0 - fresnel)) * uIntensity;
  alpha = clamp(alpha + ring * 0.4, 0.0, 1.0);

  gl_FragColor = vec4(col * (0.6 + uIntensity * 0.8), alpha);
}
`;

export const woundDiscVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uIntensity;

void main() {
  vUv = uv;
  vec3 p = position;
  float ang = atan(p.y, p.x);
  p.z += sin(ang * 4.0 + uTime * 1.5) * 0.15 * uIntensity;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const woundDiscFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uMagenta;
uniform vec3 uCyan;

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  // Hole in the middle
  if (r < 0.28) discard;
  float rim = smoothstep(1.0, 0.75, r) * smoothstep(0.28, 0.42, r);
  float swirl = sin(atan(c.y, c.x) * 5.0 - uTime * 1.4 + r * 8.0) * 0.5 + 0.5;
  vec3 col = mix(uMagenta, uCyan, swirl * 0.35) * rim * (1.2 + uIntensity);
  float alpha = rim * 0.75 * uIntensity;
  gl_FragColor = vec4(col, alpha);
}
`;
