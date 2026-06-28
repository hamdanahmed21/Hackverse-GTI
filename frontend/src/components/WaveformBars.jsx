/**
 * WaveformBars.jsx
 * AI Meeting Watchdog — Real-time Mic Frequency Visualiser
 *
 * Reads frequency data from the AnalyserNode exposed by useVoice's analyserRef.
 * Runs its own requestAnimationFrame loop — the hook never touches the DOM.
 *
 * Props:
 *   analyser     {React.MutableRefObject<AnalyserNode|null>}  — from useVoice()
 *   isActive     {boolean}  — true while mic is live (isListening from useVoice)
 *   hasAlert     {boolean}  — true while a contradiction alert is showing
 *   barCount     {number}   — optional, default 40
 *
 * Usage:
 *   <WaveformBars
 *     analyser={analyserRef}
 *     isActive={isListening}
 *     hasAlert={!!activeAlert}
 *   />
 *
 * Visual states:
 *   idle        — all bars at min height (3px), muted colour
 *   recording   — bars driven by live FFT data, red fill, pulse orb visible
 *   alert       — bars switch to orange, amplitude ceiling lifts +20%
 *
 * Design notes:
 *   • Bell-curve envelope (Gaussian) so centre bars are always tallest —
 *     avoids the flat-top look that generic visualisers have.
 *   • Bar heights are clamped to [MIN_H, MAX_H] so even silence looks
 *     intentional rather than dead.
 *   • smoothingTimeConstant: 0.8 is set on the analyser in useVoice —
 *     that's what gives the bars their fluid drag rather than snapping.
 *   • We sample only the lower 60% of the FFT bins (voice lives in
 *     80Hz–3kHz, not the full 0–11kHz Nyquist range) so the bars respond
 *     to speech rather than hiss or fan noise.
 *   • respectsReducedMotion: if prefers-reduced-motion is set, bars stay
 *     at a static height that represents the audio level without animating.
 */

import { useEffect, useRef, useCallback } from "react";
import "./WaveformBars.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BAR_COUNT = 40;
const MIN_H             = 3;    // px — resting height (also used in idle state)
const MAX_H_ACTIVE      = 48;   // px — ceiling while recording
const MAX_H_ALERT       = 58;   // px — ceiling lifts during contradiction alert
const FFT_SAMPLE_RATIO  = 0.6;  // use lower 60% of bins (voice-range focus)

// Gaussian envelope: centre bars taller, edges short
// Pre-computed once at module level — shape never changes
function buildEnvelope(count) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i / (count - 1)) * 2 - 1; // normalise to [-1, 1]
    return Math.exp(-x * x * 2.5);        // σ tuned for a full-width bell
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WaveformBars({
  analyser,
  isActive  = false,
  hasAlert  = false,
  barCount  = DEFAULT_BAR_COUNT,
}) {
  const barsRef    = useRef([]);   // refs to bar DOM nodes
  const rafRef     = useRef(null);
  const envelopeRef = useRef(buildEnvelope(barCount));

  // Rebuild envelope if barCount prop changes (rare, but defensive)
  useEffect(() => {
    envelopeRef.current = buildEnvelope(barCount);
  }, [barCount]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const analyserNode = analyser?.current;
    if (!analyserNode) return;

    const bufferLength = analyserNode.frequencyBinCount; // fftSize / 2 = 128
    const dataArray    = new Uint8Array(bufferLength);
    const sampleBins   = Math.floor(bufferLength * FFT_SAMPLE_RATIO);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      const bars     = barsRef.current;
      const envelope = envelopeRef.current;
      const maxH     = hasAlert ? MAX_H_ALERT : MAX_H_ACTIVE;

      for (let i = 0; i < bars.length; i++) {
        // Map bar index → FFT bin index within the voice-range sample window
        const binIndex = Math.floor((i / bars.length) * sampleBins);
        // dataArray values: 0–255
        const raw = dataArray[binIndex] / 255; // normalise to 0–1

        const h = prefersReduced
          // Reduced motion: static bar at average level, no animation
          ? MIN_H + raw * maxH * 0.5
          // Full animation: envelope shapes the height
          : MIN_H + raw * maxH * envelope[i];

        if (bars[i]) {
          bars[i].style.height = `${Math.round(h)}px`;
        }
      }
    }

    draw();
  }, [analyser, hasAlert]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Reset all bars to idle height
    barsRef.current.forEach((b) => {
      if (b) b.style.height = `${MIN_H}px`;
    });
  }, []);

  // ── Start / stop based on isActive ────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      startLoop();
    } else {
      stopLoop();
    }
    return stopLoop; // cleanup on unmount or when isActive flips
  }, [isActive, startLoop, stopLoop]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  const stateClass = !isActive ? "idle" : hasAlert ? "alert" : "recording";

  return (
    <div
      className={`waveform-bars waveform-bars--${stateClass}`}
      role="img"
      aria-label={
        !isActive
          ? "Microphone inactive"
          : hasAlert
          ? "Contradiction detected — audio still recording"
          : "Microphone active, listening"
      }
    >
      {/* Pulse orb — visible only in recording/alert states */}
      <span className="waveform-bars__orb" aria-hidden="true" />

      {/* Bars — DOM nodes captured into barsRef for direct style writes */}
      {Array.from({ length: barCount }, (_, i) => (
        <span
          key={i}
          className="waveform-bars__bar"
          style={{ height: `${MIN_H}px` }}
          ref={(el) => { barsRef.current[i] = el; }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
