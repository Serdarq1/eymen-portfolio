// ============================================================
// FooterPlasma.js
// Full-screen ShaderMaterial running plasma.vert/frag.
// Mouse uv warps the plasma field toward the cursor.
// ============================================================
import * as THREE from 'three';
import vertexShader from './shaders/plasma.vert';
import fragmentShader from './shaders/plasma.frag';

export class FooterPlasma {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2(0.5, 0.5);
    this.targetMouse = new THREE.Vector2(0.5, 0.5);
    this._init();
    this._bind();
    this._resize();
    this._tick();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x050505, 1);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.uniforms = {
      u_time:       { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_mouse:      { value: new THREE.Vector2(0.5, 0.5) }
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    this.mat = mat;
    this.geo = geo;
  }

  _bind() {
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._onMove = (e) => {
      const r = this.container.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      // y inverted in shader; pass 0..1 with y-top-origin.
      this.targetMouse.set(
        THREE.MathUtils.clamp(x, 0, 1),
        THREE.MathUtils.clamp(1 - y, 0, 1)
      );
    };
    window.addEventListener('mousemove', this._onMove);
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
    this.mouse.lerp(this.targetMouse, 0.06);
    this.uniforms.u_mouse.value.copy(this.mouse);
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMove);
    this.geo.dispose();
    this.mat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
