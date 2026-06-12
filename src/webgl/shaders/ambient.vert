// ============================================================
// ambient.vert — Full-screen quad pass-through for the
// subtle background spotlight + grain shader.
// ============================================================
varying vec2 v_uv;
void main() {
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
