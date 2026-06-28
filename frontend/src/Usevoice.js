/**
 * useVoice.js
 * AI Meeting Watchdog — Real-time Speech-to-Text Hook
 *
 * Wraps the browser's Web Speech API for live transcript capture.
 * Every "final" utterance chunk fires onChunkReady() → sent to backend
 * for contradiction analysis. Interim results render character-by-character
 * in the UI without triggering re-renders (liveText ref, not state).
 *
 * Architecture note:
 *   Web Speech API  →  useVoice  →  onChunkReady(text)  →  backend /analyze
 *   AudioContext/AnalyserNode  →  analyserRef  →  <WaveformBars /> (reads freq data)
 *   useCursor (setCursorState)  →  cursor ring turns red while recording
 *
 * Post-hackathon: swap Web Speech for Deepgram by replacing the recogniser
 * setup in initRecogniser() — the hook's public API stays identical.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { setCursorState } from "./useCursor";

// ─────────────────────────────────────────────
// Utility: browser support check
// Export this so the UI can degrade to paste-mode on Firefox/Safari
// ─────────────────────────────────────────────
export function useSpeechSupported() {
  return typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// ─────────────────────────────────────────────
// Error message map
// ─────────────────────────────────────────────
const ERROR_MESSAGES = {
  "not-allowed":
    "Microphone access was denied. Please allow mic permissions in your browser and try again.",
  "no-speech":
    "No speech detected. Make sure your microphone is on and try again.",
  "audio-capture":
    "No microphone found. Please connect a mic and reload.",
  "network":
    "Network error in speech recognition. Check your connection.",
  "aborted":
    null, // Intentional stop — not an error worth surfacing
  "service-not-allowed":
    "Speech recognition is not allowed on this page (non-HTTPS?). Use Chrome over HTTPS.",
};

// ─────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────

/**
 * @param {object} options
 * @param {function} options.onChunkReady   - Called with (finalText: string) for each committed utterance.
 *                                            This is the text sent to /analyze on the backend.
 * @param {string}  [options.lang]          - BCP 47 language tag. Default: 'en-US'
 *
 * @returns {{
 *   isListening:    boolean,
 *   transcript:     string,   — live interim text (updates per word as user speaks)
 *   startListening: function,
 *   stopListening:  function,
 *   error:          string|null,
 *   analyserRef:    React.MutableRefObject<AnalyserNode|null>
 * }}
 */
export function useVoice({ onChunkReady, lang = "en-US" } = {}) {
  const [isListening, setIsListening]   = useState(false);
  const [transcript, setTranscript]     = useState("");   // interim display text
  const [error, setError]               = useState(null);

  // ── Internal refs (mutations don't need re-renders) ──────────────────────
  const recogniserRef   = useRef(null);   // SpeechRecognition instance
  const isListeningRef  = useRef(false);  // mirror of state, readable inside callbacks
  const liveTextRef     = useRef("");     // current interim text (no re-render on update)
  const onChunkReadyRef = useRef(onChunkReady); // stable ref so we never re-bind recogniser

  // Keep onChunkReady ref fresh without rebuilding recogniser
  useEffect(() => {
    onChunkReadyRef.current = onChunkReady;
  }, [onChunkReady]);

  // ── Audio context refs ────────────────────────────────────────────────────
  const analyserRef     = useRef(null);   // exposed to WaveformBars
  const audioCtxRef     = useRef(null);
  const micStreamRef    = useRef(null);
  const sourceNodeRef   = useRef(null);

  // ─────────────────────────────────────────────
  // Audio pipeline — runs ONCE per startListening call
  // Tears down cleanly on stopListening
  // ─────────────────────────────────────────────
  const initAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      // smoothingTimeConstant gives the waveform bars a fluid feel
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      source.connect(analyser);
      // Note: we intentionally do NOT connect analyser → audioCtx.destination
      // so the user doesn't hear themselves echoed back

    } catch (err) {
      // getUserMedia failure — surface as a readable error
      setError(
        err.name === "NotAllowedError"
          ? ERROR_MESSAGES["not-allowed"]
          : `Microphone error: ${err.message}`
      );
    }
  }, []);

  const teardownAudioContext = useCallback(() => {
    try {
      sourceNodeRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    } catch (_) {
      // Silent — teardown errors are non-critical
    } finally {
      audioCtxRef.current  = null;
      micStreamRef.current = null;
      sourceNodeRef.current = null;
      analyserRef.current   = null;
    }
  }, []);

  // ─────────────────────────────────────────────
  // Speech recogniser — built once, event handlers re-attached on each start
  // (Some browsers destroy the instance on .stop(); we rebuild defensively)
  // ─────────────────────────────────────────────
  const initRecogniser = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.continuous      = true;   // Never stop between sentences
    rec.interimResults  = true;   // Character-by-character live feed
    rec.lang            = lang;
    rec.maxAlternatives = 1;

    // ── onresult ────────────────────────────────────────────────────────────
    // Separates interim (live display) from final (send to backend) results.
    // We iterate from event.resultIndex — only new results since last event.
    rec.onresult = (event) => {
      let finalText   = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      // Update live interim display (ref → no re-render, just update state once)
      liveTextRef.current = interimText;
      setTranscript(interimText);

      // Fire chunk for backend analysis only when we have a committed utterance
      if (finalText.trim()) {
        onChunkReadyRef.current?.(finalText.trim());
        // Clear interim display — a final result means the utterance is done
        liveTextRef.current = "";
        setTranscript("");
      }
    };

    // ── onerror ─────────────────────────────────────────────────────────────
    rec.onerror = (event) => {
      const msg = ERROR_MESSAGES[event.error];

      // null = intentional abort (not-a-real-error), undefined = unmapped error
      if (msg === undefined) {
        setError(`Speech recognition error: ${event.error}`);
      } else if (msg !== null) {
        setError(msg);
      }

      // On hard errors, stop listening state so UI reflects reality
      if (event.error !== "no-speech") {
        isListeningRef.current = false;
        setIsListening(false);
        setCursorState("idle");
      }
    };

    // ── onend ───────────────────────────────────────────────────────────────
    // The browser silently kills the mic after ~60s of silence or on tab blur.
    // We auto-restart if the user hasn't explicitly stopped.
    rec.onend = () => {
      if (isListeningRef.current) {
        try {
          rec.start();
        } catch (e) {
          // Already started — race condition, safe to ignore
          if (e.name !== "InvalidStateError") {
            console.warn("[useVoice] onend restart failed:", e.message);
          }
        }
      }
    };

    // ── onspeechend ──────────────────────────────────────────────────────────
    // Fires when the user goes quiet. No action needed — onend handles restart.
    rec.onspeechend = () => {
      // Intentionally empty — let onend handle the lifecycle
    };

    return rec;
  }, [lang]);

  // ─────────────────────────────────────────────
  // Public API: startListening
  // ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!useSpeechSupported()) {
      setError(
        "Speech recognition isn't supported in this browser. Use Chrome or Edge, or paste your transcript below."
      );
      return;
    }

    if (isListeningRef.current) return; // Guard double-start

    setError(null);
    setTranscript("");
    liveTextRef.current = "";

    // Build a fresh recogniser (defensive against browsers that invalidate
    // the instance after .stop() is called)
    const rec = initRecogniser();
    if (!rec) return;
    recogniserRef.current = rec;

    // Spin up audio pipeline for waveform visualisation
    await initAudioContext();

    try {
      rec.start();
      isListeningRef.current = true;
      setIsListening(true);
      setCursorState("recording"); // Cursor ring turns red
    } catch (e) {
      setError(`Could not start microphone: ${e.message}`);
    }
  }, [initRecogniser, initAudioContext]);

  // ─────────────────────────────────────────────
  // Public API: stopListening
  // ─────────────────────────────────────────────
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setCursorState("idle"); // Cursor ring back to default

    try {
      recogniserRef.current?.stop();
    } catch (_) {
      // Already stopped — safe to ignore
    }

    recogniserRef.current = null;
    teardownAudioContext();
    setTranscript("");
    liveTextRef.current = "";
  }, [teardownAudioContext]);

  // ─────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      try { recogniserRef.current?.stop(); } catch (_) {}
      teardownAudioContext();
    };
  }, [teardownAudioContext]);

  // ─────────────────────────────────────────────
  // Public interface
  // ─────────────────────────────────────────────
  return {
    isListening,
    transcript,       // Live interim text — render this in the transcript panel
    startListening,
    stopListening,
    error,
    analyserRef,      // Pass to <WaveformBars analyser={analyserRef} />
  };
}
