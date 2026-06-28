import { useState, useCallback, useRef } from "react";
import { useVoice, useSpeechSupported } from "../hooks/useVoice";
import WaveformBars from "../components/WaveformBars";
import AlertCard from "../components/AlertCard";
import TranscriptPanel from "../components/TranscriptPanel";
import { sendChunk, uploadPolicy } from "../services/api.js";
import "./Session.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function getCurrentTimestamp() {
  const now = new Date();
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${mm}:${ss}`;
}

function makeId() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Session() {
  const speechSupported = useSpeechSupported();

  // session state
  const [policyId, setPolicyId] = useState(null);
  const [policyRules, setPolicyRules] = useState([]);
  const [lines, setLines] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // ui state
  const [uploadError, setUploadError] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef(null);

  // ── onChunkReady ────────────────────────────────────────────────────────
  const onChunkReady = useCallback(
    async (finalText) => {
      if (!finalText.trim()) return;

      const id = makeId();
      const timestamp = getCurrentTimestamp();

      // (a) append line immediately
      setLines((prev) => [...prev, { id, text: finalText, flagged: false, timestamp }]);

      // (b) mark analysing
      setIsAnalysing(true);

      // (c) call backend
      try {
        const response = await sendChunk(finalText, policyId);
        setIsAnalysing(false);

        // (d) handle response
        if (response.contradiction) {
          setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, flagged: true } : l))
          );
          setActiveAlert({ ...response, timestamp: getCurrentTimestamp() });
        }
      } catch {
        // silent catch — keep session alive
        setIsAnalysing(false);
      }
    },
    [policyId]
  );

  // ── voice hook ──────────────────────────────────────────────────────────
  const { isListening, transcript, startListening, stopListening, error, analyserRef } =
    useVoice({ onChunkReady, lang: "en-US" });

  // ── policy upload ────────────────────────────────────────────────────────
  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const result = await uploadPolicy(file);
      setPolicyId(result.policy_id);
      setPolicyRules(result.rules ?? []);
    } catch (err) {
      setUploadError("Policy upload failed. Please try again.");
    }
  }

  // ── session controls ─────────────────────────────────────────────────────
  function handleStartSession() {
    setSessionActive(true);
    startListening();
  }

  function handleStopSession() {
    stopListening();
    setSessionActive(false);
  }

  // ── paste fallback ───────────────────────────────────────────────────────
  function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    onChunkReady(pasteText);
    setPasteText("");
  }

  // ── derived status ────────────────────────────────────────────────────────
  const dotMod = activeAlert
    ? "session-page__dot--alert"
    : isListening
    ? "session-page__dot--listening"
    : "session-page__dot--idle";

  return (
    <div className="session-page">
      {/* ── header ── */}
      <header className="session-page__header">
        <span className="session-page__title">AI MEETING WATCHDOG</span>
        <div className={`session-page__dot ${dotMod}`} title={
          activeAlert ? "Alert active" : isListening ? "Listening" : "Idle"
        } />
      </header>

      {/* ── voice / upload errors ── */}
      {(error || uploadError) && (
        <div className="session-page__error-banner">
          {error || uploadError}
        </div>
      )}

      {/* ── policy upload strip ── */}
      <div className="session-page__upload-strip">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx"
          disabled={!!policyId}
          className="session-page__file-input"
        />
        <button
          className="session-page__btn"
          onClick={handleUpload}
          disabled={!!policyId}
        >
          {policyId ? "Policy loaded" : "Upload policy"}
        </button>

        {!sessionActive ? (
          <button
            className="session-page__btn session-page__btn--primary"
            onClick={handleStartSession}
            disabled={!policyId}
          >
            Start session
          </button>
        ) : (
          <button
            className="session-page__btn session-page__btn--danger"
            onClick={handleStopSession}
          >
            Stop session
          </button>
        )}
      </div>

      {/* ── two-column grid ── */}
      <div className="session-page__grid">
        {/* left column */}
        <div className="session-page__left">
          <TranscriptPanel
            lines={lines}
            liveText={transcript}
            isListening={isListening}
          />

          {speechSupported ? (
            <>
              <WaveformBars
                analyser={analyserRef}
                isActive={isListening}
                hasAlert={!!activeAlert}
              />
              <div className="session-page__mic-row">
                {!sessionActive ? (
                  <button
                    className="session-page__btn session-page__btn--primary"
                    onClick={handleStartSession}
                    disabled={!policyId}
                  >
                    ● Start listening
                  </button>
                ) : (
                  <button
                    className="session-page__btn session-page__btn--danger"
                    onClick={handleStopSession}
                  >
                    ■ Stop listening
                  </button>
                )}
              </div>
            </>
          ) : (
            /* paste fallback */
            <div className="session-page__paste-fallback">
              <p className="session-page__paste-notice">
                Live microphone is not supported in this browser. Paste transcript text below.
              </p>
              <textarea
                className="session-page__paste-area"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste transcript excerpt…"
                rows={4}
              />
              <button
                className="session-page__btn session-page__btn--primary"
                onClick={handlePasteSubmit}
                disabled={!policyId || !pasteText.trim()}
              >
                Submit
              </button>
            </div>
          )}
        </div>

        {/* right column */}
        <div className="session-page__right">
          <div className="session-page__policy">
            <p className="session-page__policy-label">
              {policyRules.length > 0
                ? `${policyRules.length} rule${policyRules.length !== 1 ? "s" : ""} loaded`
                : "No policy loaded"}
            </p>
            <ul className="session-page__policy-list">
              {policyRules.map((rule, i) => (
                <li key={i} className="session-page__policy-item">
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <AlertCard alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
        </div>
      </div>

      {/* ── analysing indicator ── */}
      {isAnalysing && (
        <div className="session-page__analysing" aria-live="polite">
          analysing…
        </div>
      )}
    </div>
  );
}
