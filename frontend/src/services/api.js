/**
 * api.js
 * AI Meeting Watchdog — Frontend Service Layer
 *
 * Two functions. That's it.
 *
 *   uploadPolicy(file)           → POST /upload
 *   sendChunk(text, policyId)    → POST /analyze
 *
 * Base URL is read from the Vite env variable VITE_API_URL.
 * Set it in .env for local dev, and in Railway's environment
 * variables panel for production.
 *
 * .env (local):
 *   VITE_API_URL=http://localhost:8000
 *
 * Railway (production):
 *   VITE_API_URL=https://your-backend.up.railway.app
 *
 * Both functions throw on network failure so Session.jsx
 * can catch and handle errors without crashing the session.
 */

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ─────────────────────────────────────────────
// uploadPolicy
// ─────────────────────────────────────────────
/**
 * Uploads a policy document to the backend for parsing.
 * Called once at the start of a session from Session.jsx.
 *
 * @param   {File}    file  — the File object from the file input
 * @returns {Promise<{ policy_id: string, rules: string[] }>}
 *
 * policy_id  — opaque string, passed back to sendChunk on every call
 * rules      — array of extracted policy clauses, rendered in PolicyPanel
 *
 * Accepts: .pdf, .txt, .docx  (backend decides what it can parse)
 */
export async function uploadPolicy(file) {
  const form = new FormData();
  form.append("policy", file);

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: form,
    // Do NOT set Content-Type header — the browser sets it automatically
    // with the correct multipart boundary when using FormData
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Policy upload failed (${res.status}): ${detail}`);
  }

  return res.json(); // { policy_id: string, rules: string[] }
}

// ─────────────────────────────────────────────
// sendChunk
// ─────────────────────────────────────────────
/**
 * Sends one committed utterance to the backend for contradiction analysis.
 * Called from onChunkReady in Session.jsx every time a final transcript
 * result is committed by the Web Speech API.
 *
 * @param   {string}  chunk     — the committed utterance text
 * @param   {string}  policyId  — from uploadPolicy response
 * @returns {Promise<
 *   { contradiction: false } |
 *   {
 *     contradiction:    true,
 *     flagged_text:     string,   // portion of chunk that triggered the flag
 *     conflicting_rule: string,   // the policy clause it breaks
 *     explanation:      string    // one-sentence reason from Groq Llama 3.3
 *   }
 * >}
 */
export async function sendChunk(chunk, policyId) {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunk,
      policy_id: policyId,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Analysis failed (${res.status}): ${detail}`);
  }

  return res.json();
}
