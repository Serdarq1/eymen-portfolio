// ============================================================
// HeroWaveform.js
// Canvas-rendered rounded audio bars for the hero section.
// This keeps the reference-style pill caps exact while preserving
// constant idle motion and mouse proximity lift.
// ============================================================

const BAR_COUNT = 25;

export class HeroWaveform {
  constructor(container) {
    this.container = container;
    this.size = { w: 1, h: 1, dpr: 1 };
    this.mouse = { x: 100000, y: 100000 };
    this.targetMouse = { x: 100000, y: 100000 };
    this.start = performance.now();
    this._init();
    this._bind();
    this._resize();
    this._tick();
  }

  _init() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
  }

  _bind() {
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._onMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      this.targetMouse.x = e.clientX - rect.left;
      this.targetMouse.y = e.clientY - rect.top;
    };

    this._onLeave = () => {
      this.targetMouse.x = 100000;
      this.targetMouse.y = 100000;
    };

    window.addEventListener('mousemove', this._onMove);
    this.container.addEventListener('mouseleave', this._onLeave);
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.size.w = Math.max(1, rect.width);
    this.size.h = Math.max(1, rect.height);
    this.size.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.size.w * this.size.dpr);
    this.canvas.height = Math.round(this.size.h * this.size.dpr);
    this.canvas.style.width = `${this.size.w}px`;
    this.canvas.style.height = `${this.size.h}px`;
    this.ctx.setTransform(this.size.dpr, 0, 0, this.size.dpr, 0, 0);
  }

  _roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  _tick = () => {
    this._raf = requestAnimationFrame(this._tick);
    if (this.isVisible === false) return;

    const { w, h } = this.size;
    const ctx = this.ctx;
    const time = (performance.now() - this.start) / 1000;

    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.12;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.12;

    ctx.clearRect(0, 0, w, h);

    const barW = Math.max(7, Math.min(11, w * 0.0085));
    const left = w * 0.018;
    const right = w - left;
    const step = (right - left) / Math.max(BAR_COUNT - 1, 1);
    const centerY = h * 0.5;
    const maxH = h * 0.82;

    for (let i = 0; i < BAR_COUNT; i += 1) {
      const x = left + i * step;
      const base =
        0.52 +
        0.15 * Math.sin(i * 1.7) +
        0.10 * Math.sin(i * 3.1 + 0.6);
      const motion =
        0.07 * Math.sin(time * 1.55 + i * 0.72) +
        0.04 * Math.sin(time * 2.25 + i * 1.18);
      const dx = (x - this.mouse.x) / Math.max(w * 0.18, 1);
      const boost = Math.exp(-(dx * dx) * 1.8) * (Math.abs(this.mouse.y - centerY) < h * 0.58 ? 1 : 0);
      const level = Math.max(0.30, Math.min(0.88, base + motion + boost * 0.14));
      const barH = maxH * level;
      const y = centerY - barH * 0.5;
      const intensity = Math.max(0, Math.min(1, boost));
      const tone = Math.round(48 + intensity * 190);

      ctx.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
      this._roundedRect(x - barW * 0.5, y, barW, barH, barW * 0.5);
      ctx.fill();
    }
  };

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMove);
    this.container.removeEventListener('mouseleave', this._onLeave);
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
