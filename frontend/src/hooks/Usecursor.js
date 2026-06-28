/* ============================================================
   useCursor.js — Magnetic Custom Cursor
   Hackverse X 2026 — AI Meeting Watchdog

   Architecture: vanilla JS singleton, not React state.
   React state would cause re-renders on every mousemove (60fps).
   Instead we write directly to the DOM via refs, keeping React
   entirely out of the animation loop.

   WHAT THIS DOES:
   ┌─────────────────────────────────────────────────────────┐
   │  1. Two-layer cursor: precise dot + lagging ring        │
   │  2. Lerp (linear interpolation) for the ring lag        │
   │  3. Magnetic snap: ring is pulled toward buttons        │
   │  4. State classes: idle / hovering / danger /           │
   │                    recording / processing               │
   │  5. Click ripple: a quick scale-down on mousedown       │
   │  6. Cursor hides when mouse leaves the window           │
   │  7. Cleans up all listeners on unmount                  │
   └─────────────────────────────────────────────────────────┘

   USAGE:
     // In App.jsx or a top-level layout component:
     import { useCursor } from './hooks/useCursor';
     useCursor();

     // To set cursor state from any child component:
     import { setCursorState } from './hooks/useCursor';
     setCursorState('processing');   // or 'danger', 'recording', 'idle'
     setCursorState('idle');

   HTML required in index.html (or injected by CursorLayer component):
     <div class="cursor-ring" id="cursor-ring"></div>
     <div class="cursor-dot"  id="cursor-dot"></div>
   ============================================================ */

import { useEffect, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────

const LERP_FACTOR   = 0.12;   // ring lag — lower = more lag (0.08–0.18 sweet spot)
const MAGNETIC_DIST = 80;     // px radius within which magnetic pull activates
const MAGNETIC_STR  = 0.38;   // magnetic pull strength (0 = none, 1 = snaps fully)
const FRAME_RATE    = 1000 / 60; // ~16.67ms — target 60fps

// Elements that trigger hover state (ring expands blue)
const HOVER_SELECTORS = [
  'button',
  'a',
  '[role="button"]',
  'label',
  '.btn',
  '.tab-btn',
  '.upload-zone',
  '.policy-rule',
  '.alert-card',
  '.feature-pill',
  'textarea',
  'input',
].join(', ');

// Elements that trigger danger state (ring expands red)
const DANGER_SELECTORS = [
  '.btn-danger',
  '.alert-card',
  '.transcript-line.flagged',
].join(', ');

// ── Singleton state (lives outside React) ─────────────────────

let mouse   = { x: window.innerWidth / 2,  y: window.innerHeight / 2 };
let ring    = { x: window.innerWidth / 2,  y: window.innerHeight / 2 };
let target  = { x: window.innerWidth / 2,  y: window.innerHeight / 2 };
// target = where the ring wants to be (may be pulled by magnet)

let rafId   = null;
let dotEl   = null;
let ringEl  = null;
let currentState = 'idle'; // idle | hovering | danger | recording | processing

// ── Public API: set cursor state from anywhere ─────────────────

/**
 * Set the cursor ring's visual state.
 * Safe to call outside React — no re-render triggered.
 * @param {'idle'|'hovering'|'danger'|'recording'|'processing'} state
 */
export function setCursorState(state) {
  if (!ringEl) return;
  if (state === currentState) return;

  // Remove all state classes, add new one
  ringEl.classList.remove('is-hovering', 'is-danger', 'is-recording', 'is-processing');

  if (state === 'hovering')   ringEl.classList.add('is-hovering');
  if (state === 'danger')     ringEl.classList.add('is-danger');
  if (state === 'recording')  ringEl.classList.add('is-recording');
  if (state === 'processing') ringEl.classList.add('is-processing');

  currentState = state;
}

// ── Lerp helper ───────────────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── Find nearest magnetic element ─────────────────────────────

const MAGNETIC_SELECTORS = 'button, .btn, .voice-btn, .upload-icon, .logo-mark';

function getNearestMagnetic(x, y) {
  const candidates = document.querySelectorAll(MAGNETIC_SELECTORS);
  let   nearest = null;
  let   minDist = Infinity;

  candidates.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);

    if (dist < minDist) { minDist = dist; nearest = { el, cx, cy, dist }; }
  });

  return minDist < MAGNETIC_DIST ? nearest : null;
}

// ── Animation loop ────────────────────────────────────────────

function tick() {
  if (!dotEl || !ringEl) return;

  // 1. Dot tracks precisely — just translate to mouse position
  dotEl.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;

  // 2. Calculate ring target — may be pulled by nearest magnetic element
  const magnetic = getNearestMagnetic(mouse.x, mouse.y);
  if (magnetic) {
    // Pull the ring target toward the element centre
    target.x = lerp(mouse.x, magnetic.cx, MAGNETIC_STR);
    target.y = lerp(mouse.y, magnetic.cy, MAGNETIC_STR);
  } else {
    target.x = mouse.x;
    target.y = mouse.y;
  }

  // 3. Lerp ring toward target — this creates the lag
  ring.x = lerp(ring.x, target.x, LERP_FACTOR);
  ring.y = lerp(ring.y, target.y, LERP_FACTOR);

  ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;

  rafId = requestAnimationFrame(tick);
}

// ── Event handlers ────────────────────────────────────────────

function onMouseMove(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // Determine hover state based on what's under the cursor
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;

  const isDanger   = el.closest(DANGER_SELECTORS);
  const isHovering = el.closest(HOVER_SELECTORS);

  // Don't override externally-set states (recording, processing)
  if (currentState !== 'recording' && currentState !== 'processing') {
    if (isDanger)        setCursorState('danger');
    else if (isHovering) setCursorState('hovering');
    else                 setCursorState('idle');
  }
}

function onMouseDown() {
  if (!dotEl) return;
  // Click ripple: dot briefly scales up
  dotEl.style.transform =
    `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%) scale(2.5)`;
  dotEl.style.opacity = '0.5';
}

function onMouseUp() {
  if (!dotEl) return;
  dotEl.style.transform =
    `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%) scale(1)`;
  dotEl.style.opacity = '1';
}

function onMouseLeave() {
  if (!dotEl || !ringEl) return;
  dotEl.style.opacity  = '0';
  ringEl.style.opacity = '0';
}

function onMouseEnter() {
  if (!dotEl || !ringEl) return;
  dotEl.style.opacity  = '1';
  ringEl.style.opacity = '1';
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * useCursor()
 * Mount once at the top of your component tree (App.jsx).
 * Initialises the cursor animation loop and all event listeners.
 * Cleans up completely on unmount.
 */
export function useCursor() {
  const initialisedRef = useRef(false);

  useEffect(() => {
    // Guard against double-init in React StrictMode
    if (initialisedRef.current) return;
    initialisedRef.current = true;

    // Grab elements (must exist in DOM — injected by <CursorLayer />)
    dotEl  = document.getElementById('cursor-dot');
    ringEl = document.getElementById('cursor-ring');

    if (!dotEl || !ringEl) {
      console.warn('[useCursor] cursor-dot or cursor-ring not found in DOM.');
      return;
    }

    // Attach listeners
    document.addEventListener('mousemove',  onMouseMove,  { passive: true });
    document.addEventListener('mousedown',  onMouseDown,  { passive: true });
    document.addEventListener('mouseup',    onMouseUp,    { passive: true });
    document.addEventListener('mouseleave', onMouseLeave, { passive: true });
    document.addEventListener('mouseenter', onMouseEnter, { passive: true });

    // Kick off animation loop
    rafId = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      initialisedRef.current = false;

      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mousedown',  onMouseDown);
      document.removeEventListener('mouseup',    onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);

      if (rafId) cancelAnimationFrame(rafId);
      rafId  = null;
      dotEl  = null;
      ringEl = null;
      currentState = 'idle';
    };
  }, []);
}
