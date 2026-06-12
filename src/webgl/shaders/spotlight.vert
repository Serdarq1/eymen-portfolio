// ============================================================
// spotlight.vert — Full-screen quad pass-through.
// We do all the heavy lifting in the fragment shader because
// volumetric beams are inherently view-aligned.
// ============================================================
varying vec2 v_uv;

void main() {
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
