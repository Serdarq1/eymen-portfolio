// ============================================================
// audioManager.js
//
// One canonical audio source for the whole site. Anyone who
// wants to play a track calls `audio.play(trackId)`. The manager
// guarantees that:
//   - Only one track plays at a time (any prior playback stops).
//   - Subscribers (waveform UIs, play buttons, hand scene) get
//     notified of state changes (play/pause/progress/end).
//   - Missing files don't crash the UI — they just no-op.
//
// Tracks are addressed by string ID. Hand-scene plays 'featured'.
// Horizontal slides play '0','1','2','3'. Archive cards play
// 'archive-0' etc.
// ============================================================

const TRACKS = {
  featured:    { src: '/audio/track1.mp3', title: 'Back To Her Men',  artist: 'Demien Rice', duration: 209 },
  '0':         { src: '/audio/track1.mp3', title: 'Back To Her Men',  artist: 'Demien Rice', duration: 209 },
  '1':         { src: '/audio/track2.mp3', title: 'Midnight Bloom',   artist: 'Atlas Verde', duration: 252 },
  '2':         { src: '/audio/track3.mp3', title: 'Ash & Velvet',     artist: 'Junie Rae', duration: 228 },
  '3':         { src: '/audio/track4.mp3', title: 'Glass Cathedral',  artist: 'Noor Halaby', duration: 301 }
};

class AudioManager {
  constructor() {
    this.current = null;       // currently active track id
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.crossOrigin = 'anonymous';
    this.listeners = new Set();
    this.pendingFallbackId = null;
    this.virtual = {
      active: false,
      playing: false,
      time: 0,
      duration: 0,
      timer: null,
      lastTick: 0
    };

    // DOM listeners — relay events to subscribers.
    this.audio.addEventListener('timeupdate', () => this._emit('progress'));
    this.audio.addEventListener('ended',      () => this._emit('ended'));
    this.audio.addEventListener('pause',      () => this._emit('pause'));
    this.audio.addEventListener('play',       () => this._emit('play'));
    this.audio.addEventListener('error',      () => {
      if (this.pendingFallbackId && this.current === this.pendingFallbackId) {
        const id = this.pendingFallbackId;
        this.pendingFallbackId = null;
        this._startVirtual(id);
        return;
      }
      this._emit('error');
    });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(type) {
    const track = TRACKS[this.current];
    const duration = this.virtual.active
      ? this.virtual.duration
      : (isFinite(this.audio.duration) ? this.audio.duration : (track?.duration || 0));
    const payload = {
      type,
      id: this.current,
      time: this.virtual.active ? this.virtual.time : (this.audio.currentTime || 0),
      duration,
      playing: this.virtual.active
        ? this.virtual.playing
        : (!this.audio.paused && !this.audio.ended)
    };
    this.listeners.forEach((fn) => fn(payload));
  }

  _stopVirtual() {
    if (this.virtual.timer) clearInterval(this.virtual.timer);
    this.virtual.timer = null;
    this.virtual.active = false;
    this.virtual.playing = false;
  }

  _startVirtual(id) {
    const track = TRACKS[id];
    this.current = id;
    this.audio.removeAttribute('src');
    this.audio.load();
    this.virtual.active = true;
    this.virtual.playing = true;
    this.virtual.duration = track?.duration || 210;
    if (this.virtual.time >= this.virtual.duration) this.virtual.time = 0;
    this.virtual.lastTick = performance.now();

    if (this.virtual.timer) clearInterval(this.virtual.timer);
    this.virtual.timer = setInterval(() => {
      if (!this.virtual.playing) return;
      const now = performance.now();
      this.virtual.time += (now - this.virtual.lastTick) / 1000;
      this.virtual.lastTick = now;

      if (this.virtual.time >= this.virtual.duration) {
        this.virtual.time = this.virtual.duration;
        this.virtual.playing = false;
        this._emit('ended');
        return;
      }

      this._emit('progress');
    }, 120);

    this._emit('play');
  }

  getTrack(id) { return TRACKS[id] || null; }

  isPlaying(id) {
    if (this.virtual.active) return id === this.current && this.virtual.playing;
    return id === this.current && !this.audio.paused && !this.audio.ended;
  }

  async play(id) {
    const track = TRACKS[id];
    if (!track) return;

    if (this.virtual.active && this.current === id) {
      this.virtual.playing = true;
      this.virtual.lastTick = performance.now();
      this._emit('play');
      return;
    }

    if (this.current !== id || this.audio.error) {
      this._stopVirtual();
      this.virtual.time = 0;
      this.audio.src = track.src;
      this.current = id;
      this.audio.load();
    } else if (this.audio.ended) {
      this.audio.currentTime = 0;
    }

    try {
      this.pendingFallbackId = id;
      await this.audio.play();
      this.pendingFallbackId = null;
    } catch (_) {
      this.pendingFallbackId = null;
      this._startVirtual(id);
    }
  }

  pause() {
    if (this.virtual.active) {
      this.virtual.playing = false;
      this._emit('pause');
      return;
    }
    if (!this.audio.paused) this.audio.pause();
  }

  toggle(id) {
    if (this.isPlaying(id)) {
      this.pause();
    } else {
      this.play(id);
    }
  }

  seekRatio(r) {
    const ratio = Math.max(0, Math.min(1, r));
    if (this.virtual.active) {
      this.virtual.time = ratio * this.virtual.duration;
      this.virtual.lastTick = performance.now();
      this._emit('progress');
      return;
    }
    const d = this.audio.duration;
    if (!isFinite(d) || d <= 0) return;
    this.audio.currentTime = ratio * d;
  }
}

export const audio = new AudioManager();
