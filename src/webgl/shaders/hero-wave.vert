// ============================================================
// hero-wave.vert — Reference-style hero waveform bars.
// Sparse rounded pillars with the original mouse proximity lift.
// ============================================================

uniform float u_time;
uniform vec2  u_mouse;
uniform float u_count;
uniform float u_aspect;
uniform float u_barWidth;

attribute float a_index;

varying float v_intensity;
varying vec2 v_local;
varying vec2 v_halfSize;

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float a = hash11(i);
  float b = hash11(i + 1.0);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u);
}

void main() {
  float t = a_index / max(u_count - 1.0, 1.0);
  float inset = min(u_aspect * 0.035, 0.08);
  float anchorX = mix(-u_aspect + inset, u_aspect - inset, t);

  float pattern = 0.50
    + 0.18 * sin(a_index * 1.70)
    + 0.13 * sin(a_index * 3.10 + 0.6)
    + 0.06 * vnoise(a_index * 0.55);
  float motion = 0.09 * sin(u_time * 1.55 + a_index * 0.72)
    + 0.05 * sin(u_time * 2.25 + a_index * 1.18)
    + 0.04 * vnoise(a_index * 0.45 + u_time * 1.35);
  float idle = clamp(pattern + motion, 0.32, 0.90);

  float dx = anchorX - u_mouse.x;
  float falloff = exp(-pow(dx * 2.2, 2.0));
  float yGate = smoothstep(1.0, 0.2, abs(u_mouse.y));
  float boost = falloff * yGate;

  float scaleY = idle + boost * 0.35;

  vec3 pos = position;
  pos.y *= scaleY;
  pos.x += anchorX;

  v_intensity = clamp(boost, 0.0, 1.0);
  v_local = vec2(position.x, pos.y);
  v_halfSize = vec2(u_barWidth * 0.5, scaleY * 0.5);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
