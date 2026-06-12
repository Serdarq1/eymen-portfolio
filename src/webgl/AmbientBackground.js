// ============================================================
// AmbientBackground.js
// Generic full-screen ShaderMaterial container running the
// `ambient` shader. Used by the "What I Do" section as a subtle
// studio-light atmosphere behind the DOM content.
// ============================================================
import * as THREE from 'three';
import vertexShader from './shaders/ambient.vert';
import fragmentShader from './shaders/ambient.frag';

export class AmbientBackground {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this._init();
    this._bind();
    this._resize();
    this._tick();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x050505, 1);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.uniforms = {
      u_time:       { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) }
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    this.geo = geo;
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
    this.uniforms.u_resolution.value.set(w, h);
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
    this.geo.dispose();
    this.mat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
