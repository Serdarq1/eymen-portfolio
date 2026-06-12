// ============================================================
// plasma.frag — Slow purple/blue electric plasma tendrils.
//
// Technique: layered fbm (fractal noise) whose isolines we
// emphasise with a `1.0 - abs(noise - 0.5)` style ridge term,
// then tinted on a purple→blue gradient. The mouse position
// gently warps the field so tendrils lean toward the cursor.
//
// Uniforms:
//   u_time       (float) elapsed seconds
//   u_resolution (vec2)  pixel size
//   u_mouse      (vec2)  mouse uv [0..1]
// ============================================================
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_mouse;

varying vec2 v_uv;

// Hash + 2D value noise.
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

// Fractal Brownian motion — sum of octaves of noise.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.6;

  // Mouse warp — gently pull the field toward the cursor.
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0) * 2.6;
  vec2 toMouse = m - p;
  float pull = exp(-dot(toMouse, toMouse) * 0.3) * 0.4;
  p += toMouse * pull;

  // Time-evolving sample point.
  vec2 q = p + vec2(u_time * 0.06, u_time * 0.04);

  // Domain warp for stringy, electric look.
  vec2 warp = vec2(
    fbm(q + vec2(0.0, 0.0)),
    fbm(q + vec2(5.2, 1.3))
  );
  float n = fbm(q + warp * 2.5 + u_time * 0.05);

  // Ridge: bright where n is exactly mid — tendrils.
  float ridge = 1.0 - abs(n - 0.5) * 2.0;
  ridge = pow(clamp(ridge, 0.0, 1.0), 4.0);

  // Secondary glow (broader, softer).
  float glow = smoothstep(0.35, 0.65, n) * 0.35;

  // Color ramp: deep purple to electric blue.
  vec3 purple = vec3(0.32, 0.05, 0.62);
  vec3 blue   = vec3(0.20, 0.50, 1.00);
  vec3 hot    = vec3(0.85, 0.65, 1.00);
  vec3 col = mix(purple, blue, smoothstep(0.0, 1.0, n));
  col = mix(col, hot, ridge);

  // Final intensity.
  float intensity = ridge + glow * 0.6;
  col *= 0.4 + intensity * 1.5;

  // Heavy darkening — we want this to read as a background.
  vec3 bg = vec3(0.015, 0.01, 0.025);
  col = mix(bg, col, intensity * 0.85);

  // Vignette to keep DOM content readable.
  float vig = smoothstep(1.2, 0.2, length(uv - 0.5));
  col *= mix(0.45, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
