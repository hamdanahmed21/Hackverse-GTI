/**
 * TranscriptPanel.jsx
 * AI Meeting Watchdog — Live Transcript Display
 *
 * Renders two layers simultaneously:
 *   1. Committed final lines  — complete utterances already sent to /analyze
 *   2. Live interim line      — word-by-word text as the user speaks right now
 *
 * Props:
 *   lines       {Array}   — committed utterances
 *                           each: { id: string, text: string, flagged: boolean, timestamp: string }
 *   liveText    {string}  — current interim text from useVoice's transcript value
 *                           updates character-by-character; empty string when idle
 *   isListening {boolean} — true while mic is active; controls live row visibility
 *
 * Usage:
 *   <TranscriptPanel
 *     lines={lines}
 *     liveText={transcript}
 *     isListening={isListening}
 *   />
 *
 * Auto-scroll:
 *   Uses scrollRef.scrollTop = scrollRef.scrollHeight (NOT scrollIntoView —
 *   that triggers page-level scroll which fights the fixed layout).
 *   Fires on every lines change AND every liveText change.
 *
 * Flagged lines:
 *   When line.flagged is true the row gets .transcript-panel__row--flagged.
 *   The red left-bar animates in via flagged-bar-slam (80ms snap) defined in CSS.
 *   This is intentionally redefined here, independent of AlertCard.css.
 *
 * Empty state:
 *   Shown when lines is empty AND isListening is false.
 *   "waiting for session to start" — an invitation, not an apology.
 */

import { useEffect, useRef } from "react";
import "./TranscriptPanel.css";

export default function TranscriptPanel({ lines = [], liveText = "", isListening = false }) {
  const scrollRef = useRef(null);

  // ── Auto-scroll to bottom on every new line or live text change ──────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, liveText]);

  const isEmpty = lines.length === 0 && !isListening;

  return (
    <div className="transcript-panel">

      {/* ── Scrollable content area ─────────────────────────────────────── */}
      <div className="transcript-panel__scroll" ref={scrollRef}>

        {/* Empty state */}
        {isEmpty && (
          <div className="transcript-panel__empty" aria-live="polite">
            waiting for session to start
          </div>
        )}

        {/* Committed final lines */}
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              "transcript-panel__row" +
              (line.flagged ? " transcript-panel__row--flagged" : "")
            }
          >
            <span className="transcript-panel__ts" aria-label={`at ${line.timestamp}`}>
              {line.timestamp}
            </span>
            <span className="transcript-panel__text">
              {line.text}
            </span>
          </div>
        ))}

        {/* Live interim line — only shown while mic is active */}
        {isListening && (
          <div className="transcript-panel__live" aria-live="off">
            <span className="transcript-panel__ts">
              {/* Live timestamp is intentionally blank — it's not committed yet */}
              &nbsp;
            </span>
            <span className="transcript-panel__live-text">
              {liveText}
              <span className="transcript-panel__cursor" aria-hidden="true">|</span>
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
