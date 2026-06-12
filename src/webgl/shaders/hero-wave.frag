// ============================================================
// hero-wave.frag — Rounded pill caps for the hero soundwave.
// ============================================================
precision highp float;

varying float v_intensity;
varying vec2 v_local;
varying vec2 v_halfSize;

void main() {
  float radius = v_halfSize.x;
  vec2 q = abs(v_local) - v_halfSize + radius;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float alpha = 1.0 - smoothstep(0.0, fwidth(dist) * 1.5, dist);
  if (alpha <= 0.0) discard;

  vec3 base = vec3(0.20);
  vec3 highlight = vec3(1.0);
  float k = smoothstep(0.0, 0.85, v_intensity);
  vec3 col = mix(base, highlight, k);

  gl_FragColor = vec4(col, alpha);
}
