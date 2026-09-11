/** Fullscreen reality-distortion / grain / grade — used as custom pass fragment */
export const distortFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uDistort;
uniform float uGrain;
uniform float uGrade; // 0 city cool → 1 fracture hot → 2 space cold
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 dUv = uv;
  float distort = uDistort;
  dUv.x += sin(uv.y * 40.0 + uTime * 2.0) * 0.002 * distort;
  dUv.y += cos(uv.x * 30.0 - uTime * 1.5) * 0.002 * distort;
  // Chromatic-ish offset during fracture
  vec4 c = texture2D(inputBuffer, dUv);
  float r = texture2D(inputBuffer, dUv + vec2(0.0015 * distort, 0.0)).r;
  float b = texture2D(inputBuffer, dUv - vec2(0.0015 * distort, 0.0)).b;
  c.r = mix(c.r, r, distort * 0.7);
  c.b = mix(c.b, b, distort * 0.7);

  // Color grade
  vec3 cool = c.rgb * vec3(0.85, 0.92, 1.12);
  vec3 hot = c.rgb * vec3(1.15, 0.75, 1.05) + vec3(0.04, 0.0, 0.02);
  vec3 space = c.rgb * vec3(0.75, 0.8, 1.2) + vec3(0.01, 0.02, 0.05);
  vec3 graded = mix(cool, hot, clamp(uGrade, 0.0, 1.0));
  graded = mix(graded, space, clamp(uGrade - 1.0, 0.0, 1.0));

  float g = hash(gl_FragCoord.xy + fract(uTime) * 100.0);
  graded += (g - 0.5) * uGrain;

  outputColor = vec4(graded, c.a);
}
`;
