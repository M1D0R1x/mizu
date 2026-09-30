// GLSL snippets shared by MIZU's custom shaders.

export const noiseGLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = m * p + 7.3; a *= 0.5; }
  return v;
}
`;

export const skyUniformsGLSL = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uMoonDir;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunColor; uniform vec3 uMoonColor;
uniform float uSunGlow; uniform float uStars; uniform float uCloud; uniform float uTime; uniform float uDaylight;
uniform vec3 uCloudBright; uniform vec3 uCloudDark; uniform vec3 uWind;
`;

// vec3 skyColor(vec3 dir, bool detail) — full atmosphere incl. clouds/stars.
export const skyGLSL = /* glsl */ `
vec3 skyBase(vec3 d) {
  float y = d.y;
  float t = pow(clamp(y, 0.0, 1.0), 0.42);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uHorizon * 0.82, smoothstep(0.0, -0.12, y));
  float sunUp = smoothstep(-0.18, 0.04, uSunDir.y);
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * pow(sd, 5.0) * 0.28 * uSunGlow * sunUp * (1.0 - 0.6 * uCloud);
  col += uSunColor * pow(sd, 48.0) * 0.55 * uSunGlow * sunUp;
  col += uSunColor * smoothstep(0.99935, 0.99965, sd) * 6.0 * smoothstep(-0.03, 0.01, uSunDir.y) * (1.0 - uCloud * 0.9);
  float moonUp = smoothstep(-0.02, 0.06, uMoonDir.y);
  float md = max(dot(d, uMoonDir), 0.0);
  col += uMoonColor * smoothstep(0.99900, 0.99945, md) * 2.2 * moonUp * (1.0 - uCloud * 0.9);
  col += uMoonColor * pow(md, 30.0) * 0.14 * moonUp * (1.0 - uDaylight);
  return col;
}
float starField(vec3 d) {
  if (d.y < 0.02) return 0.0;
  vec2 uv = d.xz / (d.y + 0.35) * 42.0;
  vec2 cell = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash12(cell);
  vec2 off = vec2(hash12(cell + 1.7), hash12(cell + 9.1)) - 0.5;
  float dist = length(f - off * 0.7);
  float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
  float s = smoothstep(0.08, 0.0, dist) * step(0.90, h) * twinkle;
  return s * smoothstep(0.02, 0.25, d.y);
}
vec3 skyColor(vec3 d) {
  vec3 col = skyBase(d);
  col += vec3(0.9, 0.95, 1.0) * starField(d) * uStars * 1.4;
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.14) * 1.35;
    uv += uWind.xy * uTime * 0.006 + vec2(3.7, 1.2);
    float n = fbm(uv);
    float n2 = fbm(uv * 2.1 + vec2(11.0, 5.0) + uWind.xy * uTime * 0.004);
    float density = n * 0.7 + n2 * 0.3;
    float lo = 0.64 - uCloud * 0.44;
    float cover = smoothstep(lo, lo + 0.22, density);
    float shade = clamp(0.5 + (n2 - n) * 1.8 + (1.0 - density) * 0.4, 0.0, 1.0);
    vec3 cc = mix(uCloudDark, uCloudBright, shade);
    // sun-lit rims near the sun direction
    float sd = max(dot(d, uSunDir), 0.0);
    cc += uSunColor * pow(sd, 8.0) * 0.5 * smoothstep(-0.1, 0.05, uSunDir.y) * (1.0 - shade * 0.6);
    float horizonFade = smoothstep(0.0, 0.16, d.y);
    col = mix(col, cc, cover * horizonFade * 0.96);
  }
  return col;
}
`;

export const windGLSL = /* glsl */ `
vec3 windOffset(vec3 wp, float weight) {
  float s = uWind.z;
  vec2 dir = uWind.xy;
  float phase = dot(wp.xz, dir) * 0.12;
  float w = sin(uTime * 1.6 - phase) * 0.5 + sin(uTime * 2.9 - phase * 2.1 + wp.x * 0.35) * 0.22 + sin(uTime * 0.55 - phase * 0.45) * 0.4;
  float gust = 0.5 + 0.5 * sin(uTime * 0.31 + phase * 0.5 + wp.z * 0.02);
  vec2 off = dir * (0.4 + w) * s * (0.55 + gust * 0.9);
  off += vec2(sin(uTime * 2.1 + wp.z * 0.6), cos(uTime * 1.7 + wp.x * 0.6)) * 0.07 * s;
  return vec3(off.x, -abs(off.x + off.y) * 0.15, off.y) * weight;
}
`;

export const fogGLSL = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogDensity;
vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;
