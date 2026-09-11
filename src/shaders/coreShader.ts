export const coreVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPos;
uniform float uTime;
uniform float uIntensity;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec3 p = position;
  float n = sin(p.x * 4.0 + uTime * 2.0) * cos(p.y * 3.0 - uTime) * sin(p.z * 5.0 + uTime * 1.5);
  p += normal * n * 0.08 * uIntensity;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const coreFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vPos;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
  float pulse = 0.55 + 0.45 * sin(uTime * 2.4 + length(vPos) * 6.0);
  vec3 col = mix(uColorA, uColorB, fresnel * pulse);
  col += vec3(1.0, 0.3, 0.1) * fresnel * uIntensity * 1.4;
  float alpha = 0.55 + fresnel * 0.45;
  gl_FragColor = vec4(col * uIntensity, alpha);
}
`;
