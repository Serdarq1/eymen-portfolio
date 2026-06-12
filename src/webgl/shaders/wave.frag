// ============================================================
// wave.frag — Color the bars.
// Dim charcoal at rest, pure white when the mouse is near.
// `v_intensity` arrives from the vertex shader (0..1 proximity).
// ============================================================
precision highp float;

varying float v_intensity;

void main() {
  // Base color (charcoal) and highlight color (pure white).
  vec3 base      = vec3(0.18);
  vec3 highlight = vec3(1.0);

  // smoothstep to keep the transition crisp and editorial.
  float k = smoothstep(0.0, 0.85, v_intensity);
  vec3 col = mix(base, highlight, k);

  gl_FragColor = vec4(col, 1.0);
}
