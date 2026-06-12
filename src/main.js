// ============================================================
// main.js
//
// Boot order:
//   1) Mount Lenis as the sole scroll source.
//   2) Wire Lenis → ScrollTrigger so GSAP reads our smooth scroll.
//   3) Initialise all Three.js scenes (each owns its own RAF).
//   4) Wire DOM UI: FAQ, horizontal player, archive grid.
//   5) Wire the hero-style horizontal pinning math (commented below).
//   6) Register reveal-text scroll triggers.
// ============================================================
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { audio } from './audioManager.js';
import { initFaq, initHorizontalPlayer, initArchive } from './uiController.js';

import { HeroWaveform }      from './webgl/HeroWaveform.js';

gsap.registerPlugin(ScrollTrigger);

// ------------------------------------------------------------
// 1) Lenis — single source of smooth-scroll truth.
// ------------------------------------------------------------
const lenis = new Lenis({
  duration: 1.15,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false
});
window.__lenis = lenis;

// ------------------------------------------------------------
// 2) Bridge Lenis with GSAP ScrollTrigger.
// Lenis emits 'scroll' on every frame it advances; we tell
// ScrollTrigger to re-check. We also tell it that lenis owns
// the scroller (not window's native scroll).
// ------------------------------------------------------------
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ------------------------------------------------------------
// 3) WebGL scenes.
// ------------------------------------------------------------
const scenes = [];
const lazyObservers = [];
const sceneObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const inst = entry.target.__sceneInstance;
        if (inst) inst.isVisible = entry.isIntersecting;
      });
    }, { rootMargin: '240px 0px' })
  : null;

function mount(selector, Ctor) {
  const el = document.querySelector(`[data-canvas="${selector}"]`);
  if (!el) return null;
  try {
    const inst = new Ctor(el);
    inst.isVisible = true;
    el.__sceneInstance = inst;
    sceneObserver?.observe(el);
    scenes.push(inst);
    return inst;
  } catch (err) {
    console.error(`[scene:${selector}] init failed`, err);
    return null;
  }
}

async function mountLoaded(selector, loadCtor, onMount) {
  try {
    const Ctor = await loadCtor();
    const inst = mount(selector, Ctor);
    onMount?.(inst);
    return inst;
  } catch (err) {
    console.error(`[scene:${selector}] lazy import failed`, err);
    return null;
  }
}

function mountWhenNear(selector, loadCtor, onMount) {
  const el = document.querySelector(`[data-canvas="${selector}"]`);
  if (!el) return null;

  if (!('IntersectionObserver' in window)) {
    mountLoaded(selector, loadCtor, onMount);
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    mountLoaded(selector, loadCtor, onMount);
  }, { rootMargin: '900px 0px' });

  observer.observe(el);
  lazyObservers.push(observer);
  return null;
}

const heroWave = mount('hero-waveform', HeroWaveform);
let whatBg = mountWhenNear('what-bg', () => import('./webgl/AmbientBackground.js').then((m) => m.AmbientBackground), (inst) => { whatBg = inst; });
let handScene = mountWhenNear('hand-scene', () => import('./webgl/HandScene.js').then((m) => m.HandScene), (inst) => {
  handScene = inst;
  handScene?.setSpinning(audio.isPlaying('featured'));
});
let activeWave = mountWhenNear('active-wave', () => import('./webgl/ActiveWaveform.js').then((m) => m.ActiveWaveform), (inst) => { activeWave = inst; });
let ctaLight = mountWhenNear('cta-light', () => import('./webgl/CtaLight.js').then((m) => m.CtaLight), (inst) => { ctaLight = inst; });
let footerPlas = mountWhenNear('footer-plasma', () => import('./webgl/FooterPlasma.js').then((m) => m.FooterPlasma), (inst) => { footerPlas = inst; });

// ------------------------------------------------------------
// 4) DOM controllers.
// ------------------------------------------------------------
initFaq();
initHorizontalPlayer();
initArchive();

// ------------------------------------------------------------
// 5) Hand-scene play button → audio + scene reaction.
//
// When the user hits the central play button:
//   - Toggle audio for 'featured'.
//   - HandScene starts/stops the CD spin.
//   - Song metadata and waveform appear only while the featured
//     track is actively playing.
// ------------------------------------------------------------
const playBtn    = document.getElementById('hand-play');
const playPlatform = document.getElementById('play-platform');
const trackInfo  = document.querySelector('.hand-track');
const stage      = document.querySelector('.hand-stage');
const handCanvas = document.querySelector('[data-canvas="hand-scene"]');

// ----- Scroll reveal of the entire 3D scene -----
// Fade + rise the canvas in slowly as the section enters view.
if (handCanvas) {
  gsap.set(handCanvas, { autoAlpha: 0, y: 80 });
  gsap.to(handCanvas, {
    autoAlpha: 1,
    y: 0,
    duration: 1.6,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: stage,
      start: 'top 75%',
      once: true
    }
  });
}

if (playBtn && stage && trackInfo) {
  playBtn.addEventListener('click', () => audio.toggle('featured'));

  audio.subscribe((evt) => {
    // Another track took over: reset hand visuals.
    if (evt.id !== 'featured') {
      playBtn.classList.remove('is-playing');
      playPlatform?.classList.remove('is-playing');
      trackInfo.classList.remove('is-visible');
      handScene?.setSpinning(false);
      return;
    }

    if (evt.playing) {
      playBtn.classList.add('is-playing');
      playPlatform?.classList.add('is-playing');
      handScene?.setSpinning(true);
      trackInfo.classList.add('is-visible');
    } else {
      playBtn.classList.remove('is-playing');
      playPlatform?.classList.remove('is-playing');
      trackInfo.classList.remove('is-visible');
      handScene?.setSpinning(false);
    }
  });
}

// ------------------------------------------------------------
// 6) Horizontal pinned scroll math.
//
// We pin the .h-pin element while the user scrolls a *vertical*
// distance equal to the *horizontal* overflow of its inner track.
// That gives the illusion that "scrolling down" pans the slides
// sideways at 1:1 speed.
//
// Let:
//   W_track = inner track scrollWidth  (sum of all slide widths)
//   W_view  = viewport width           (one slide is 100vw)
//   D       = W_track − W_view         (total horizontal travel)
//
// We set ScrollTrigger.end = "+=" + D so the pin lasts exactly D
// pixels of *vertical* scroll. Inside the tween we translate the
// inner track from x=0 to x=-D, scrubbed to the pin progress.
// Recompute D on resize so it stays correct.
// ------------------------------------------------------------
const hPin   = document.getElementById('h-pin');
const hTrack = document.getElementById('h-pin-track');

if (hPin && hTrack) {
  let tween;

  const setup = () => {
    if (tween) { tween.scrollTrigger?.kill(); tween.kill(); tween = null; }

    const distance = hTrack.scrollWidth - window.innerWidth;
    if (distance <= 0) return;

    tween = gsap.to(hTrack, {
      x: -distance,
      ease: 'none',
      scrollTrigger: {
        trigger: hPin,
        start: 'top top',
        end: () => `+=${distance}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    window.__goToPinnedTrack = (index, count = 4) => {
      const st = tween?.scrollTrigger;
      if (!st) return;
      const maxIndex = Math.max(1, count - 1);
      const targetY = st.start + (st.end - st.start) * (index / maxIndex);
      if (window.__lenis?.scrollTo) {
        window.__lenis.scrollTo(targetY, { duration: 1.0 });
      } else {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    };
  };

  setup();
  // Re-measure on resize — ScrollTrigger.refresh() then re-runs end fn.
  let _rT;
  window.addEventListener('resize', () => {
    clearTimeout(_rT);
    _rT = setTimeout(() => {
      setup();
      ScrollTrigger.refresh();
    }, 120);
  });
}

// ------------------------------------------------------------
// 7a) Hero load reveal — premium line-mask cascade.
//
// Order: badge → headline lines (stagger) → subheadline lines
//        → CTA → social proof. Uses translateY on .line-inner
// inside `overflow: hidden` .line-mask wrappers, so each line
// rises cleanly out of a hairline mask — no clip-path repaint
// jank, no per-glyph splitting cost.
// ------------------------------------------------------------
gsap.context(() => {
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    delay: 0.15 // tiny breath before the show starts
  });

  tl.to('[data-hero-anim="badge"]', {
      y: 0, opacity: 1, duration: 0.8
    })
    .to('[data-hero-anim="title"]', {
      y: '0%', duration: 1.1, stagger: 0.12
    }, '-=0.55')
    .to('[data-hero-anim="sub"]', {
      y: '0%', duration: 0.9, stagger: 0.08
    }, '-=0.7')
    .to('[data-hero-anim="cta"]', {
      y: 0, opacity: 1, duration: 0.7
    }, '-=0.5')
    .to('[data-hero-anim="meta"]', {
      y: 0, opacity: 1, duration: 0.6
    }, '-=0.45');
});

// ------------------------------------------------------------
// 7a-bis) Line splitter + ScrollTrigger reveal for
// `[data-split-lines]` blocks (the oversized right-column
// text in the "What I Do" section).
//
// Strategy:
//   1) Split the text into word <span>s.
//   2) Measure each word's bounding rect to group words that
//      share a baseline (same visual line).
//   3) Rewrap each line in
//        <span class="split-line"><span class="split-line__inner">...</span></span>
//      so each line sits inside its own overflow-hidden mask.
//   4) Hand the inner spans to ScrollTrigger for a staggered
//      translate-up reveal.
//
// We re-split on resize because line breaks change with width.
// ------------------------------------------------------------
function splitIntoLines(el) {
  // Read original text from a cached attr so re-splitting on resize
  // doesn't operate on already-wrapped output.
  let text = el.dataset.splitSource;
  if (!text) {
    text = el.textContent.replace(/\s+/g, ' ').trim();
    el.dataset.splitSource = text;
  }
  if (!text) return [];

  // 1) Inject word spans separated by literal space text nodes.
  el.innerHTML = '';
  const wordEls = [];
  const words = text.split(' ');
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'split-word';
    s.textContent = w;
    el.appendChild(s);
    wordEls.push(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });

  // 2) Group word elements by offsetTop (within ~2px tolerance).
  const lines = [];
  let currentTop = null;
  let bucket = [];
  wordEls.forEach((w) => {
    const top = w.offsetTop;
    if (currentTop === null || Math.abs(top - currentTop) > 2) {
      if (bucket.length) lines.push(bucket);
      bucket = [];
      currentTop = top;
    }
    bucket.push(w);
  });
  if (bucket.length) lines.push(bucket);

  // 3) Rewrap — REUSE the measured word elements so the rendered
  // text width exactly matches what we measured. Joining via text
  // would let the browser re-flow with slightly different metrics
  // and silently collide lines inside `overflow: hidden`.
  el.innerHTML = '';
  const inners = [];
  lines.forEach((lineWords) => {
    const lineWrap = document.createElement('span');
    lineWrap.className = 'split-line';
    const inner = document.createElement('span');
    inner.className = 'split-line__inner';
    lineWords.forEach((wEl, i) => {
      inner.appendChild(wEl);
      if (i < lineWords.length - 1) {
        inner.appendChild(document.createTextNode(' '));
      }
    });
    lineWrap.appendChild(inner);
    el.appendChild(lineWrap);
    inners.push(inner);
  });

  return inners;
}

const splitTargets = document.querySelectorAll('[data-split-lines]');
const splitTriggers = [];

function setupSplitReveals() {
  // Kill prior triggers (resize path).
  splitTriggers.forEach((t) => t.kill());
  splitTriggers.length = 0;

  splitTargets.forEach((el) => {
    const inners = splitIntoLines(el);
    if (!inners.length) return;
    gsap.set(inners, { yPercent: 110 });
    const tween = gsap.to(inners, {
      yPercent: 0,
      duration: 1.0,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true
      }
    });
    if (tween.scrollTrigger) splitTriggers.push(tween.scrollTrigger);
  });
}

// Run after webfonts settle so line breaks are measured correctly.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    setupSplitReveals();
    ScrollTrigger.refresh();
  });
} else {
  setupSplitReveals();
}

// Re-split on resize (debounced) — line breaks shift with width.
let _splitResizeT;
window.addEventListener('resize', () => {
  clearTimeout(_splitResizeT);
  _splitResizeT = setTimeout(() => {
    setupSplitReveals();
    ScrollTrigger.refresh();
  }, 200);
});

// ------------------------------------------------------------
// 7b) Scroll reveal animations — text only, NOT canvases.
// ------------------------------------------------------------
gsap.context(() => {
  const items = gsap.utils.toArray('.reveal-text');
  items.forEach((el) => {
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 80%',
        once: true
      }
    });
  });

  // Word-by-word mask reveal for [data-word-reveal] elements:
  //   <h?><span.word-mask><span.word-mask__inner>WORD</span></span>...</h?>
  const wordTargets = gsap.utils.toArray('[data-word-reveal]');
  wordTargets.forEach((el) => {
    const inners = el.querySelectorAll('.word-mask__inner');
    if (!inners.length) return;
    gsap.set(inners, { yPercent: 110 });
    gsap.to(inners, {
      yPercent: 0,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true
      }
    });
  });
});

// ------------------------------------------------------------
// Cleanup on hot reload (Vite HMR friendly).
// ------------------------------------------------------------
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneObserver?.disconnect();
    lazyObservers.forEach((observer) => observer.disconnect());
    scenes.forEach((s) => s.destroy?.());
    ScrollTrigger.getAll().forEach((t) => t.kill());
    delete window.__lenis;
    delete window.__goToPinnedTrack;
    lenis.destroy();
  });
}
