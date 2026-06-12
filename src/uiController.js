// ============================================================
// uiController.js
//
// Pure DOM glue. Splits into three concerns:
//   1) FAQ accordion (height: 0 → scrollHeight, single-open).
//   2) Horizontal slide player UI (play buttons + waveform progress).
//   3) Archive grid generation + per-card play state.
//
// All audio I/O goes through the shared `audio` singleton so a
// click anywhere stops the previous track.
// ============================================================
import { audio } from './audioManager.js';

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
};

const buildWaveform = (el, seed) => {
  const bars = [];
  for (let i = 0; i < 31; i += 1) {
    const level =
      0.34 +
      0.28 * Math.abs(Math.sin(i * 0.68 + seed)) +
      0.22 * Math.abs(Math.sin(i * 1.31 + seed * 0.7));
    bars.push(`<span class="wave-bar" style="--h:${Math.min(0.92, level).toFixed(3)}; --i:${i}"></span>`);
  }
  el.innerHTML = bars.join('');
};

// ------------------------------------------------------------
// FAQ accordion
// ------------------------------------------------------------
export function initFaq() {
  const items = document.querySelectorAll('[data-faq]');
  items.forEach((item) => {
    const ans = item.querySelector('.faq__a');
    item.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      // Close all
      items.forEach((it) => {
        it.classList.remove('is-open');
        const a = it.querySelector('.faq__a');
        a.style.height = '0px';
      });
      // Open clicked (if it was closed)
      if (!open) {
        item.classList.add('is-open');
        // Measure natural height for the height transition.
        ans.style.height = 'auto';
        const h = ans.scrollHeight;
        ans.style.height = '0px';
        // Force a reflow so the browser registers the start state.
        // eslint-disable-next-line no-unused-expressions
        ans.offsetHeight;
        ans.style.height = h + 'px';
      }
    });
  });
}

// ------------------------------------------------------------
// Horizontal slide player UI
// ------------------------------------------------------------
export function initHorizontalPlayer() {
  const slides = document.querySelectorAll('.song-slide');
  const ids = ['0', '1', '2', '3'];

  const setVisualTrack = (targetId, playing) => {
    slides.forEach((slide) => {
      const active = slide.dataset.track === targetId && playing;
      slide.classList.toggle('is-playing', active);
      const btn = slide.querySelector('.ctrl--play');
      if (btn) btn.textContent = active ? '❚❚' : '▶';
    });
  };

  const goToTrack = (targetId) => {
    setVisualTrack(targetId, true);
    audio.play(targetId);

    const index = ids.indexOf(targetId);
    if (index < 0) return;

    if (window.__goToPinnedTrack) window.__goToPinnedTrack(index, ids.length);
  };

  slides.forEach((slide, index) => {
    const id = slide.dataset.track;
    const playBtn = slide.querySelector('.ctrl--play');
    const wave    = slide.querySelector('[data-wave]');
    const cur     = slide.querySelector('.time--current');
    buildWaveform(wave, index + 1);
    const seek = document.createElement('button');
    seek.className = 'song-slide__seek';
    seek.type = 'button';
    seek.setAttribute('aria-label', 'Seek track');
    seek.innerHTML = '<span class="song-slide__seek-fill"></span>';
    wave.insertAdjacentElement('afterend', seek);

    playBtn.addEventListener('click', () => {
      const willPlay = !audio.isPlaying(id);
      setVisualTrack(id, willPlay);
      audio.toggle(id);
    });

    const seekFromEvent = (e) => {
      if (audio.current !== id) return;
      const r = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - r.left) / r.width;
      audio.seekRatio(ratio);
    };
    seek.addEventListener('click', seekFromEvent);

    // Next/prev wired conservatively — they just hop to neighbour slides.
    const nextBtn = slide.querySelector('.ctrl--next');
    const prevBtn = slide.querySelector('.ctrl--prev');
    nextBtn?.addEventListener('click', () => {
      const basis = ids.includes(audio.current) ? audio.current : id;
      const nxt = ids[(ids.indexOf(basis) + 1) % ids.length];
      goToTrack(nxt);
    });
    prevBtn?.addEventListener('click', () => {
      const basis = ids.includes(audio.current) ? audio.current : id;
      const idx = ids.indexOf(basis);
      const prv = ids[(idx - 1 + ids.length) % ids.length];
      goToTrack(prv);
    });

    audio.subscribe((evt) => {
      // Update play icon for *this* slide.
      const active = evt.id === id && evt.playing;
      slide.classList.toggle('is-playing', active);
      playBtn.textContent = active ? '❚❚' : '▶';

      // Update progress only for the active track.
      if (evt.id === id) {
        const ratio = evt.duration ? (evt.time / evt.duration) : 0;
        seek.style.setProperty('--prog', `${(ratio * 100).toFixed(2)}%`);
        cur.textContent = fmt(evt.time);
      } else {
        // Reset visuals for inactive slides.
        seek.style.setProperty('--prog', '0%');
        cur.textContent = '0:00';
      }
    });
  });
}

// ------------------------------------------------------------
// Archive grid — generate cards, wire play state
// ------------------------------------------------------------
const ARCHIVE = [
  { title: 'Static Sunrise',  artist: 'Eymen Karadeniz',         duration: '2:54' },
  { title: 'Driveways',       artist: 'Eymen Karadeniz',    duration: '3:17' },
  { title: 'Concrete Roses',  artist: 'Eymen Karadeniz',   duration: '4:01' },
  { title: 'Salt & Static',   artist: 'Eymen Karadeniz',   duration: '3:42' },
  { title: 'No Map',          artist: 'Eymen Karadeniz',    duration: '2:38' },
  { title: 'Headlights',      artist: 'Eymen Karadeniz',   duration: '3:55' },
  { title: 'Soft Animal',     artist: 'Eymen Karadeniz',  duration: '4:12' },
  { title: 'Reverb Diary',    artist: 'Eymen Karadeniz',   duration: '3:08' }
];

const archiveWave = (seed) => Array.from({ length: 17 }, (_, i) => {
  const h = 0.3 + Math.abs(Math.sin(seed + i * 0.72)) * 0.58;
  return `<span style="--h:${h.toFixed(3)}; --i:${i}"></span>`;
}).join('');

export function initArchive() {
  const grid = document.getElementById('archive-grid');
  if (!grid) return;

  ARCHIVE.forEach((t, i) => {
    const id = `archive-${i}`;
    // Register track so the manager can resolve it.
    // (We map to existing audio files in round-robin fashion.)
    const card = document.createElement('div');
    card.className = 'archive-card paused';
    card.style.setProperty('--label-color', [
      '#d33f49', '#2bb3b1', '#d19a32', '#7d5cff',
      '#3ccf7a', '#e865a8', '#4f8cff', '#f06d3a'
    ][i % 8]);
    card.innerHTML = `
      <div class="archive-card__cd"></div>
      <div class="archive-card__wave" aria-hidden="true">${archiveWave(i + 1)}</div>
      <button class="archive-card__play" data-archive="${id}" aria-label="Play ${t.title}">▶</button>
      <div class="archive-card__meta">
        <strong>${t.title}</strong>
        ${t.artist} · ${t.duration}
      </div>
    `;
    grid.appendChild(card);

    const btn = card.querySelector('button');
    btn.addEventListener('click', () => {
      // Round-robin to one of the four real tracks.
      const realId = String(i % 4);
      audio.toggle(realId);
      // Tag the card so we can update visuals on subscribe.
      card.dataset.realId = realId;
    });
  });

  audio.subscribe((evt) => {
    document.querySelectorAll('.archive-card').forEach((card) => {
      const realId = card.dataset.realId;
      const active = realId && evt.id === realId && evt.playing;
      card.classList.toggle('paused', !active);
      const btn = card.querySelector('button');
      if (btn) btn.textContent = active ? '❚❚' : '▶';
    });
  });
}
