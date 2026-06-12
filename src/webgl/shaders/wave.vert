// ============================================================
// wave.vert — Hero waveform bar vertex shader
//
// Each bar is rendered as a thin, instanced quad on a horizontal
// grid. We deform its height (Y scale) based on:
//   1) An animated noise envelope (the "audio" idle motion).
//   2) A radial falloff from the mouse, so bars near the cursor
//      bulge upward dramatically.
//
// Uniforms we receive from the JS side:
//   u_time   : seconds elapsed since start                (float)
//   u_mouse  : mouse position in *plane* space, range
//              roughly [-aspect, aspect] x [-1, 1]        (vec2)
//   u_count  : total number of bars (used to normalize x) (float)
//   u_aspect : plane aspect ratio width / height          (float)
//
// Per-instance attribute:
//   a_index  : integer bar index 0..u_count-1             (float)
//
// Varying out:
//   v_intensity : 0..1 — used by the frag shader to brighten
//                 bars that are near the mouse.
// ============================================================

uniform float u_time;
uniform vec2  u_mouse;
uniform float u_count;
uniform float u_aspect;

attribute float a_index;

varying float v_intensity;

// Cheap pseudo-noise — value-noise via fract-sin.
// Good enough for an organic idle motion at low cost.
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
  // The *plane* spans [-u_aspect, u_aspect] horizontally and
  // [-1, 1] vertically. Compute the bar's X anchor along that
  // span by normalizing its index.
  float t = a_index / max(u_count - 1.0, 1.0);
  float anchorX = mix(-u_aspect, u_aspect, t);

  // Idle envelope: a slow drifting sine + noise gives an
  // organic, "music is playing somewhere" baseline motion.
  float idle = 0.18 + 0.22 * vnoise(a_index * 0.35 + u_time * 1.6)
                    + 0.10 * sin(u_time * 2.0 + a_index * 0.5);

  // Mouse falloff — distance in plane-space along X.
  // We *only* use the X distance so the falloff stays banded,
  // which matches the bar geometry better than a circular one.
  float dx = anchorX - u_mouse.x;
  float falloff = exp(-pow(dx * 2.2, 2.0));      // 0..1 gaussian
  // Vertical proximity gates the effect — only when the cursor
  // is actually inside the waveform's vertical band.
  float yGate = smoothstep(1.0, 0.2, abs(u_mouse.y));
  float boost = falloff * yGate;

  // Final per-bar scale. The instanced geometry is a 1-tall
  // quad with origin at y=0 (so we scale upward only).
  float scaleY = idle + boost * 1.6;

  // Move the bar to its anchor and stretch on Y.
  vec3 pos = position;
  pos.y *= scaleY;          // stretch upward
  pos.x += anchorX;         // shift to its slot

  v_intensity = clamp(boost, 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
