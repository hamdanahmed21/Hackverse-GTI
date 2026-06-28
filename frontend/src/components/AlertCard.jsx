/**
 * AlertCard.jsx
 * AI Meeting Watchdog — Contradiction Alert Component
 *
 * The demo's money shot. When a contradiction fires:
 *   1. Card erupts into view (translateY + opacity)
 *   2. Shockwave ring expands from card centre
 *   3. Page border bleeds red for 600ms (via data-alert on <body>)
 *   4. Flagged transcript line gets a red left-bar (handled in TranscriptPanel)
 *   5. Dismiss → card exits, body attribute cleared
 *
 * Props:
 *   alert  {object|null}  — contradiction payload from /analyze, or null
 *     alert.flagged_text      {string}  — the spoken line that triggered it
 *     alert.conflicting_rule  {string}  — the policy clause it breaks
 *     alert.explanation       {string}  — one-sentence reason (from Groq)
 *     alert.timestamp         {string}  — e.g. "02:34" (set by Session.jsx)
 *   onDismiss  {function}  — clears alert state in parent (Session.jsx)
 *
 * Usage:
 *   <AlertCard alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
 *
 * Body attribute protocol:
 *   document.body.dataset.alert = "active"  → triggers CSS border bleed
 *   Cleared automatically 600ms after dismiss begins.
 */

import { useEffect, useRef } from "react";
import "./AlertCard.css";

export default function AlertCard({ alert, onDismiss }) {
  const cardRef      = useRef(null);
  const shockwaveRef = useRef(null);

  // ── Fire animations whenever a new alert arrives ──────────────────────────
  useEffect(() => {
    if (!alert) return;

    const card      = cardRef.current;
    const shockwave = shockwaveRef.current;
    if (!card || !shockwave) return;

    // 1. Page border bleed — set body attribute, CSS handles the animation
    document.body.dataset.alert = "active";

    // 2. Shockwave ring — remove + force reflow + re-add to restart animation
    shockwave.classList.remove("alert-card__shockwave--fire");
    void shockwave.offsetWidth; // force reflow
    shockwave.classList.add("alert-card__shockwave--fire");

    // Clear body attribute after bleed animation completes (600ms)
    const bleedTimer = setTimeout(() => {
      delete document.body.dataset.alert;
    }, 600);

    return () => clearTimeout(bleedTimer);
  }, [alert]);

  // ── Dismiss handler ───────────────────────────────────────────────────────
  function handleDismiss() {
    const card = cardRef.current;
    if (card) card.classList.add("alert-card--exiting");

    // Wait for exit animation before clearing state
    setTimeout(() => {
      delete document.body.dataset.alert;
      onDismiss?.();
    }, 250);
  }

  // Don't render anything when there's no alert
  if (!alert) return null;

  return (
    <div
      className="alert-card"
      ref={cardRef}
      role="alert"
      aria-live="assertive"
      aria-label="Contradiction detected"
    >
      {/* Shockwave ring — absolutely positioned, expands outward from centre */}
      <span
        className="alert-card__shockwave"
        ref={shockwaveRef}
        aria-hidden="true"
      />

      {/* Header row — badge + timestamp */}
      <div className="alert-card__header">
        <span className="alert-card__badge" aria-hidden="true">
          ⚠ contradiction detected
        </span>
        {alert.timestamp && (
          <span className="alert-card__timestamp">{alert.timestamp}</span>
        )}
      </div>

      {/* Flagged utterance — the spoken text that triggered the flag */}
      <div className="alert-card__section">
        <p className="alert-card__section-label">flagged statement</p>
        <blockquote className="alert-card__flagged">
          "{alert.flagged_text}"
        </blockquote>
      </div>

      {/* Conflicting policy rule */}
      <div className="alert-card__section">
        <p className="alert-card__section-label">conflicts with policy</p>
        <p className="alert-card__rule">{alert.conflicting_rule}</p>
      </div>

      {/* One-sentence explanation from Groq */}
      {alert.explanation && (
        <p className="alert-card__explanation">{alert.explanation}</p>
      )}

      {/* Dismiss */}
      <button
        className="alert-card__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss contradiction alert"
      >
        dismiss
      </button>
    </div>
  );
}
