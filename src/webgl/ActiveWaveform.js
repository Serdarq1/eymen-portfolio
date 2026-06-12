// ============================================================
// ActiveWaveform.js
// A compact, always-animating GLSL bar waveform that sits below
// the song name once playback starts. Re-uses the hero `wave.vert
// + wave.frag` shaders with `u_mouse` parked off-screen so only
// the idle envelope drives motion (no mouse interactivity here —
// it's a passive visualizer).
// ============================================================
import * as THREE from 'three';
import vertexShader from './shaders/wave.vert';
import fragmentShader from './shaders/wave.frag';

const BAR_COUNT = 56;
const BAR_WIDTH = 0.035;

export class ActiveWaveform {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this._init();
    this._bind();
    this._resize();
    this._tick();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    this.scene = new THREE.Scene();

    const base = new THREE.PlaneGeometry(BAR_WIDTH, 1, 1, 1);
    const geom = new THREE.InstancedBufferGeometry();
    geom.index = base.index;
    geom.attributes = base.attributes;
    geom.instanceCount = BAR_COUNT;

    const indices = new Float32Array(BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) indices[i] = i;
    geom.setAttribute(
      'a_index',
      new THREE.InstancedBufferAttribute(indices, 1)
    );

    this.uniforms = {
      u_time:   { value: 0 },
      // Parked off-screen so the wave.vert mouse-proximity term is
      // permanently inactive: bars only show idle motion.
      u_mouse:  { value: new THREE.Vector2(100, 100) },
      u_count:  { value: BAR_COUNT },
      u_aspect: { value: 1 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.mesh);
    this.geom = geom;
    this.mat = mat;
  }

  _bind() {
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    const r = this.container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -aspect; this.camera.right = aspect;
    this.camera.top = 1; this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.uniforms.u_aspect.value = aspect;
    this.mesh.position.y = 0;
  }

  _tick = () => {
    this._raf = requestAnimationFrame(this._tick);
    if (this.isVisible === false) return;

    this.uniforms.u_time.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.geom.dispose();
    this.mat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
