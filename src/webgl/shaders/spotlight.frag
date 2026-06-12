// ============================================================
// spotlight.frag — Volumetric spotlight from top-right.
//
// We compose three layers in screen-space:
//   1) A soft conical "beam" — the body of the light, falling
//      from an off-screen source toward the floor.
//   2) Dust particles inside the beam — twinkling hash dots
//      that are *only* visible where the beam intensity is high.
//   3) A floor reflection — a soft elliptical pool below.
//
// Uniforms:
//   u_time       (float) seconds since start
//   u_resolution (vec2)  canvas size in CSS pixels
//   u_mouse      (vec2)  mouse position in [0..1] (top-left origin)
// ============================================================
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_mouse;

varying vec2 v_uv;

// Hash + value noise for dust twinkle.
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

void main() {
  // Aspect-corrected UV with origin at top-left, y growing down.
  vec2 uv = v_uv;
  uv.y = 1.0 - uv.y;     // flip so beams come from "top"
  float aspect = u_resolution.x / u_resolution.y;

  // Light source position (top-right). Slight idle drift +
  // very small mouse follow for life.
  vec2 src = vec2(0.64, -0.08);
  src.x += 0.006 * sin(u_time * 0.35);
  src.x += (u_mouse.x - 0.5) * 0.025;

  // Vector from current fragment to the (off-screen) source.
  vec2 d = uv - src;

  // Beam direction (downward + slightly left). Normalised.
  vec2 dir = normalize(vec2(-0.18, 0.98));

  // Project the fragment onto the beam axis and measure how
  // far it is sideways from that axis.
  float along  = dot(d, dir);              // distance along beam
  float across = length(d - dir * along);  // perpendicular distance

  // Beam *widens* as it travels: half-angle ~ 14°.
  float halfWidth = 0.035 + along * 0.24;

  // Smooth falloff perpendicular to the beam.
  float beam = 1.0 - smoothstep(0.0, halfWidth, across);

  // Length falloff — strongest near source, fading further out.
  beam *= smoothstep(1.35, 0.06, along);
  beam *= smoothstep(0.0, 0.18, along);

  // Slight flicker (very subtle) so the light feels alive.
  float flicker = 0.92 + 0.08 * vnoise(vec2(u_time * 1.4, 0.0));
  beam *= flicker;

  // Dust particles inside the beam.
  vec2 dustUV = uv * vec2(aspect, 1.0) * 60.0;
  dustUV += u_time * vec2(-3.0, -6.0);    // drift downward
  float dust = vnoise(dustUV);
  dust = smoothstep(0.86, 1.0, dust);     // sparse stars
  float dustMask = smoothstep(0.05, 0.6, beam);
  vec3 dustColor = vec3(1.0) * dust * dustMask * 0.7;

  // Floor reflection pool — a soft horizontal ellipse at the
  // base of the canvas, brightest directly below the source.
  vec2 floorUV = uv;
  // Compute where the beam axis would hit y = 0.92.
  float floorY = 0.9;
  float tHit = (floorY - src.y) / dir.y;
  vec2 hit = src + dir * tHit;
  float floorDX = (floorUV.x - hit.x) * 1.15;
  float floorDY = (floorUV.y - floorY) * 8.0;
  float pool = exp(-(floorDX * floorDX + floorDY * floorDY) * 2.35);
  float floorLine = exp(-pow((floorUV.y - 0.94) * 34.0, 2.0)) * smoothstep(0.95, 0.25, abs(floorUV.x - hit.x));

  // Compose final color. The beam is a slightly warm white.
  vec3 beamColor = vec3(0.78, 0.9, 0.95);
  vec3 warmCore = vec3(1.0, 0.82, 0.7);
  vec3 col = beamColor * beam * 0.72;
  col += warmCore * pow(beam, 2.4) * 0.18;
  col += dustColor;
  col += beamColor * pool * 0.42;
  col += vec3(0.7, 0.82, 0.88) * floorLine * 0.18;

  // Heavy vignette on the rest of the scene so the spotlight reads.
  float vig = smoothstep(0.92, 0.22, length((uv - vec2(0.52, 0.58)) * vec2(1.15, 0.9)));
  col *= mix(0.22, 1.0, vig);

  // Background ambient — near black with a hint of cool blue.
  vec3 ambient = vec3(0.012, 0.014, 0.02);
  col += ambient;

  gl_FragColor = vec4(col, 1.0);
}
