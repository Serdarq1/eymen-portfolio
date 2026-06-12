import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import handModelUrl from '../../models/hand.glb?url';
import cdModelUrl from '../../models/cd.glb?url';

const CHROME = {
  color: 0xf4f7ff,
  metalness: 1,
  roughness: 0.035,
  clearcoat: 1,
  clearcoatRoughness: 0.018,
  envMapIntensity: 2.8
};

const RED_DISC = {
  color: 0xd71920,
  metalness: 0.94,
  roughness: 0.13,
  clearcoat: 1,
  clearcoatRoughness: 0.035,
  envMapIntensity: 2.15,
  sheen: 1,
  sheenColor: 0xff544d,
  sheenRoughness: 0.25
};

const HAND_BASE_POSITION = new THREE.Vector3(-0.14, -0.72, -0.06);
// Y lowered enough that the back edge of the tilted disc still fits
// inside the camera frame (it was previously rising past the top of
// the canvas into the MADE TO LAST section above). Z kept forward so
// the disc still clears the fingertips.
const CD_BASE_POSITION = new THREE.Vector3(0.14, 1.35, 0.45);
// Keep ~52° tilt so the TOP face stays visible.
const CD_BASE_ROTATION = new THREE.Euler(0.9, 0.02, -0.1);

export class HandScene {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.spinning = false;
    this.spinSpeed = 0;
    this.pointer = new THREE.Vector2();

    this._init();
    this._lights();
    this._buildStage();
    this._bind();
    this._resize();
    this._loadModels();
    this._tick();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // Transparent clear so the CSS gradient on .hand-stage shows through
    // around the silhouette of the hand + CD.
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Null background = let the canvas alpha through to the DOM behind.
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0.06, 0.32, 7.25);
    this.camera.lookAt(0.02, 0.92, 0);

    this.root = new THREE.Group();
    this.root.position.set(0, 0.12, 0);
    this.scene.add(this.root);

    this.modelRig = new THREE.Group();
    this.modelRig.rotation.x = -0.03;
    this.root.add(this.modelRig);
  }

  _lights() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = this._makeEnvTexture();
    this.scene.environment = pmrem.fromScene(envScene, 0.025).texture;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(-2.6, 4.2, 3.3);
    this.scene.add(key);

    const strip = new THREE.DirectionalLight(0xeef5ff, 2.8);
    strip.position.set(3.4, 2.6, 2.2);
    this.scene.add(strip);

    const redRim = new THREE.PointLight(0xff2c26, 34, 8.5, 1.6);
    redRim.position.set(-3.3, 0.8, 1.6);
    this.scene.add(redRim);

    const blueButtonKick = new THREE.PointLight(0x9fc8ff, 18, 5.8, 1.85);
    blueButtonKick.position.set(0, -2.45, 2.3);
    this.scene.add(blueButtonKick);

    const topPin = new THREE.SpotLight(0xffffff, 9, 9, 0.38, 0.48, 1.6);
    topPin.position.set(0.8, 4.8, 2.2);
    topPin.target.position.set(0, 0.75, 0);
    this.scene.add(topPin, topPin.target);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.018));
  }

  _makeEnvTexture() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 1024;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0.00, '#f8fbff');
    g.addColorStop(0.12, '#b7c1d2');
    g.addColorStop(0.26, '#111319');
    g.addColorStop(0.43, '#030304');
    g.addColorStop(0.62, '#590909');
    g.addColorStop(0.78, '#090a12');
    g.addColorStop(1.00, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    for (let y = 70; y < c.height; y += 180) {
      ctx.fillStyle = y % 360 === 70 ? 'rgba(255,255,255,0.52)' : 'rgba(255,40,36,0.28)';
      ctx.fillRect(0, y, c.width, 12);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildStage() {
    this._buildCdEffects();
  }

  _buildCdEffects() {
    this.cdEffects = new THREE.Group();
    this.cdEffects.visible = false;
    this.cdEffects.position.copy(CD_BASE_POSITION);
    this.cdEffects.rotation.copy(CD_BASE_ROTATION);
    this.modelRig.add(this.cdEffects);

    const gearTex = this._makeGearTexture();
    const hub = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 96),
      new THREE.MeshBasicMaterial({
        map: gearTex,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      })
    );
    hub.position.y = 0.035;
    hub.rotation.x = -Math.PI / 2;
    this.cdEffects.add(hub);
    this.hub = hub;

    const trailTex = this._makeTrailTexture();
    this.trailMat = new THREE.MeshBasicMaterial({
      map: trailTex,
      color: 0xff4a40,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const trail = new THREE.Mesh(
      new THREE.RingGeometry(1.03, 1.34, 192),
      this.trailMat
    );
    trail.position.y = 0.02;
    trail.rotation.x = -Math.PI / 2;
    this.cdEffects.add(trail);
    this.trail = trail;

    this.edgeLines = [];
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xff8c82,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0.03),
        new THREE.Vector3(Math.cos(a + 0.12) * 1.22, Math.sin(a + 0.12) * 1.22, 0.03),
        new THREE.Vector3(Math.cos(a + 0.3) * 1.3, Math.sin(a + 0.3) * 1.3, 0.03)
      ]);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)),
        lineMat.clone()
      );
      line.position.y = 0.03;
      line.rotation.x = -Math.PI / 2;
      this.cdEffects.add(line);
      this.edgeLines.push(line);
    }
  }

  _makeGearTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);

    const grad = ctx.createRadialGradient(0, 0, 16, 0, 0, size * 0.48);
    grad.addColorStop(0, 'rgba(0,0,0,0.96)');
    grad.addColorStop(0.26, 'rgba(18,20,24,0.78)');
    grad.addColorStop(0.72, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    const ring = (r, count, amp, alpha) => {
      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const a = (i / count) * Math.PI * 2;
        const tooth = i % 2 === 0 ? amp : -amp * 0.35;
        ctx.lineTo(Math.cos(a) * (r + tooth), Math.sin(a) * (r + tooth));
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(240,248,255,${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };

    ring(92, 96, 6, 0.42);
    ring(128, 128, 4, 0.3);
    ring(58, 64, 4, 0.38);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      ctx.lineTo(Math.cos(a) * 138, Math.sin(a) * 138);
      ctx.stroke();
    }

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _makeTrailTexture() {
    const size = 768;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const len = 0.52 + (i % 3) * 0.09;
      const grd = ctx.createLinearGradient(
        Math.cos(a) * size * 0.28,
        Math.sin(a) * size * 0.28,
        Math.cos(a + len) * size * 0.49,
        Math.sin(a + len) * size * 0.49
      );
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.45, 'rgba(255,118,99,0.42)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 3 + (i % 4);
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.34 + (i % 4) * 0.018), a, a + len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  async _loadModels() {
    const loader = new GLTFLoader();

    try {
      const [handGltf, cdGltf] = await Promise.all([
        loader.loadAsync(handModelUrl),
        loader.loadAsync(cdModelUrl)
      ]);

      this.handGroup = this._prepareHand(handGltf.scene);
      this.cdGroup = this._prepareCd(cdGltf.scene);

      this.modelRig.add(this.handGroup, this.cdGroup);
      this._positionObjects();
      this.cdEffects.visible = true;
    } catch (err) {
      console.error('[HandScene] GLB load failed', err);
      this._fallbackObjects();
    }
  }

  _prepareHand(model) {
    // Bumped from 4.55 → 5.15 so the hand reads larger in frame
    // without changing the CD (the CD has its own normalize call).
    const wrap = this._normalizeModel(model, 5.15);
    const mat = new THREE.MeshPhysicalMaterial(CHROME);

    wrap.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = mat;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.geometry?.computeVertexNormals?.();
    });

    return wrap;
  }

  _prepareCd(model) {
    const wrap = this._normalizeModel(model, 2.72);
    const sheen = this._makeDiscSheenTexture();

    wrap.traverse((obj) => {
      if (!obj.isMesh) return;
      const prev = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      obj.material = new THREE.MeshPhysicalMaterial({
        ...RED_DISC,
        map: prev?.map || sheen,
        normalMap: prev?.normalMap || null,
        roughnessMap: prev?.roughnessMap || null,
        metalnessMap: prev?.metalnessMap || null
      });
      obj.castShadow = false;
      obj.receiveShadow = false;
    });

    return wrap;
  }

  _normalizeModel(model, targetMaxDim) {
    const wrap = new THREE.Group();
    wrap.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    wrap.scale.setScalar(targetMaxDim / maxDim);
    return wrap;
  }

  _positionObjects() {
    this.handGroup.position.copy(HAND_BASE_POSITION);
    this.handGroup.rotation.set(-0.1, -0.08, 0.06);

    this.cdGroup.position.copy(CD_BASE_POSITION);
    this.cdGroup.rotation.copy(CD_BASE_ROTATION);

    this.cdEffects.position.copy(this.cdGroup.position);
    this.cdEffects.rotation.copy(this.cdGroup.rotation);
  }

  _makeDiscSheenTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(size / 2, size / 2, 18, size / 2, size / 2, size / 2);
    grad.addColorStop(0.00, '#360102');
    grad.addColorStop(0.18, '#8d0609');
    grad.addColorStop(0.5, '#ff352f');
    grad.addColorStop(0.76, '#b50b10');
    grad.addColorStop(1.00, '#250102');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 420; i++) {
      const a = (i / 420) * Math.PI * 2;
      const alpha = 0.025 + Math.pow(Math.sin(i * 5.17) * 0.5 + 0.5, 5) * 0.28;
      ctx.strokeStyle = `rgba(255,230,210,${alpha})`;
      ctx.lineWidth = i % 19 === 0 ? 4 : 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55);
      ctx.stroke();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _fallbackObjects() {
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshPhysicalMaterial(CHROME)
    );
    hand.scale.set(1.0, 1.55, 0.48);
    hand.position.set(-0.18, -0.52, -0.05);

    const cd = new THREE.Mesh(
      new THREE.CylinderGeometry(1.17, 1.17, 0.05, 192),
      new THREE.MeshPhysicalMaterial({ ...RED_DISC, map: this._makeDiscSheenTexture() })
    );

    this.handGroup = new THREE.Group();
    this.handGroup.add(hand);
    this.cdGroup = new THREE.Group();
    this.cdGroup.add(cd);
    this.modelRig.add(this.handGroup, this.cdGroup);
    this._positionObjects();
    this.cdEffects.visible = true;
  }

  _bind() {
    this._onResize = this._resize.bind(this);
    this._onPointerMove = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      this.pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    window.addEventListener('resize', this._onResize);
    this.container.addEventListener('pointermove', this._onPointerMove);
  }

  _resize() {
    const r = this.container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;

    // Three tiers so tablet doesn't render at desktop scale inside a
    // smaller canvas (which read as "stretched"). Smaller scale + further
    // camera = hand & disc sit naturally in the frame at every width.
    if (w < 640) {
      this.camera.position.set(0.1, 0.18, 9.6);
      this.root.scale.setScalar(0.80);
    } else if (w < 980) {
      this.camera.position.set(0.08, 0.30, 9.1);
      this.root.scale.setScalar(0.92);
    } else {
      this.camera.position.set(0.06, 0.44, 8.0);
      this.root.scale.setScalar(1.2);
    }

    this.camera.lookAt(0.02, 0.92, 0);
    this.camera.updateProjectionMatrix();
  }

  setSpinning(on) {
    this.spinning = !!on;
  }

  _tick = () => {
    this._raf = requestAnimationFrame(this._tick);
    if (this.isVisible === false) return;

    const dt = Math.min(0.034, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    const targetSpin = this.spinning ? 0.48 : 0;
    this.spinSpeed += (targetSpin - this.spinSpeed) * Math.min(1, dt * 5.5);

    if (this.modelRig) {
      this.modelRig.rotation.y = Math.sin(t * 0.36) * 0.025 + this.pointer.x * 0.018;
      this.modelRig.rotation.x = -0.03 - this.pointer.y * 0.012;
    }

    if (this.handGroup) {
      this.handGroup.position.y = HAND_BASE_POSITION.y + Math.sin(t * 0.8) * 0.01;
      this.handGroup.rotation.y = -0.08 + Math.sin(t * 0.48) * 0.055 + this.pointer.x * 0.018;
      this.handGroup.rotation.x = -0.1 + Math.sin(t * 0.36) * 0.014;
    }

    if (this.cdGroup) {
      this.cdGroup.position.y = CD_BASE_POSITION.y + Math.sin(t * 1.2) * 0.016;
      this.cdGroup.rotateY(this.spinSpeed * dt);
    }

    if (this.cdEffects) {
      this.cdEffects.position.y = this.cdGroup ? this.cdGroup.position.y : this.cdEffects.position.y;
      this.cdEffects.rotateY(this.spinSpeed * dt);
      if (this.hub) this.hub.rotation.z -= this.spinSpeed * dt * 1.6;
      if (this.trail) this.trail.rotation.z -= dt * (0.18 + this.spinSpeed * 1.8);
    }

    const trailOpacity = this.spinning ? 0.52 : 0;
    if (this.trailMat) {
      this.trailMat.opacity += (trailOpacity - this.trailMat.opacity) * Math.min(1, dt * 6);
    }

    const lineOpacity = this.spinning ? 0.22 : 0;
    this.edgeLines?.forEach((line, i) => {
      line.material.opacity += (lineOpacity - line.material.opacity) * Math.min(1, dt * 5);
      line.rotation.z += dt * (0.16 + i * 0.003);
    });

    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.container.removeEventListener('pointermove', this._onPointerMove);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          m.dispose?.();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement);
  }
}
