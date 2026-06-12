// ============================================================
// ambient.frag — Studio atmosphere background.
//
// Layers:
//   1) Two drifting radial light pools (warm + cool) that give
//      a sense of off-screen studio lamps.
//   2) Slow, low-amplitude fbm to make the gradient breathe.
//   3) Fine film grain so the deep blacks never look banded.
//
// Uniforms:
//   u_time       (float) seconds since start
//   u_resolution (vec2)  CSS pixel size of the canvas
// ============================================================
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;

varying vec2 v_uv;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(aspect, 1.0);

  // Two slow-drifting spotlight anchors. Their positions are
  // a low-amplitude sine — never enough to feel "animated", just
  // enough to keep the lighting alive.
  vec2 c1 = vec2(0.18 * aspect + 0.05 * sin(u_time * 0.10),
                 0.30 + 0.04 * cos(u_time * 0.08));
  vec2 c2 = vec2(0.85 * aspect + 0.06 * cos(u_time * 0.07),
                 0.78 + 0.04 * sin(u_time * 0.09));

  float d1 = distance(p, c1);
  float d2 = distance(p, c2);

  // Soft falloff pools.
  float pool1 = exp(-d1 * d1 * 3.5);   // upper-left
  float pool2 = exp(-d2 * d2 * 4.0);   // lower-right

  // Breathing fbm overlay (very subtle).
  float n = fbm(uv * 2.6 + vec2(u_time * 0.03, u_time * 0.02));
  float breathe = (n - 0.5) * 0.04;

  // Compose color. Both pools are near-white; the floor is pure black.
  vec3 base   = vec3(0.0);
  vec3 warm   = vec3(0.10, 0.085, 0.075);
  vec3 cool   = vec3(0.06, 0.075, 0.10);

  vec3 col = base
    + warm * pool1 * 1.3
    + cool * pool2 * 1.1
    + vec3(breathe);

  // Fine film grain so deep darks don't band.
  float grain = (hash21(uv * u_resolution + u_time) - 0.5) * 0.025;
  col += grain;

  gl_FragColor = vec4(col, 1.0);
}
