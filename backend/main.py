"""
main.py
AI Meeting Watchdog — FastAPI Backend

Endpoints:
  POST /upload        Upload a policy document → returns policy_id + rules list
  POST /analyze       Analyze one transcript chunk → returns contradiction result
  POST /transcribe    Upload audio file → Whisper transcription → auto-analyze

Storage:
  In-memory dict (policy_store) keyed by UUID.
  Good enough for a hackathon; swap for Redis or Postgres for production.

Whisper:
  Loaded lazily on first /transcribe call so the server boots fast.
  Model size comes from WHISPER_MODEL env var (default: "base").
  Audio is saved to a temp file, transcribed, then deleted.

CORS:
  Configured to allow the Vite dev server (localhost:5173) and any
  origins listed in the CORS_ORIGINS env var.
"""

import io
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Optional


from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import GROQ_API_KEY, CORS_ORIGINS, WHISPER_MODEL
from ai_engine.pipeline import ContradictionResult, analyze_chunk, parse_policy

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Meeting Watchdog", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory policy store ─────────────────────────────────────────────────────
# { policy_id: list[str] }  — each entry is a list of rule strings
policy_store: dict[str, list[str]] = {}

# ── Lazy Whisper loader ───────────────────────────────────────────────────────
_whisper_model = None

def get_whisper():
    """Load Whisper model once, reuse across requests."""
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            _whisper_model = whisper.load_model(WHISPER_MODEL)
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="Whisper is not installed. Run: pip install openai-whisper",
            )
    return _whisper_model


# ── Text extraction helpers ───────────────────────────────────────────────────

def extract_text_from_file(filename: str, content: bytes) -> str:
    """
    Extract plain text from .txt, .pdf, or .docx uploads.
    Falls back to UTF-8 decode for unrecognised types.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".txt":
        return content.decode("utf-8", errors="replace")

    if ext == ".pdf":
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            return "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF parse error: {e}")

    if ext == ".docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"DOCX parse error: {e}")

    # Unknown type — try UTF-8
    return content.decode("utf-8", errors="replace")


# ── Request / Response models ─────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    chunk:     str
    policy_id: str

class AnalyzeResponse(BaseModel):
    contradiction:    bool
    flagged_text:     Optional[str] = None
    conflicting_rule: Optional[str] = None
    explanation:      Optional[str] = None

class UploadResponse(BaseModel):
    policy_id: str
    rules:     list[str]

class TranscribeResponse(BaseModel):
    transcript:       str
    contradiction:    bool
    flagged_text:     Optional[str] = None
    conflicting_rule: Optional[str] = None
    explanation:      Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.3-70b-versatile", "whisper": WHISPER_MODEL}


@app.post("/upload", response_model=UploadResponse)
async def upload_policy(policy: UploadFile = File(...)):
    """
    Accept a .txt / .pdf / .docx policy document.
    Parse it with Claude to extract rules.
    Return a policy_id and the rules list.
    """
    content = await policy.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    text = extract_text_from_file(policy.filename or "policy.txt", content)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from the file.")

    rules = parse_policy(text)

    policy_id = str(uuid.uuid4())
    policy_store[policy_id] = rules

    return UploadResponse(policy_id=policy_id, rules=rules)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """
    Analyze one committed transcript chunk against stored policy rules.
    Called by the frontend on every final speech recognition result.
    """
    rules = policy_store.get(req.policy_id)
    if rules is None:
        raise HTTPException(
            status_code=404,
            detail=f"Policy '{req.policy_id}' not found. Upload a policy first.",
        )

    result: ContradictionResult = analyze_chunk(req.chunk, rules)

    if not result.contradiction:
        return AnalyzeResponse(contradiction=False)

    return AnalyzeResponse(
        contradiction=True,
        flagged_text=result.flagged_text,
        conflicting_rule=result.conflicting_rule,
        explanation=result.explanation,
    )


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    policy_id: str = "",
):
    """
    Accept an audio file (wav/mp3/webm/ogg/m4a).
    Transcribe it with Whisper.
    Optionally run contradiction analysis if policy_id is provided.

    This endpoint is used when:
      - The user uploads a pre-recorded meeting clip
      - The browser doesn't support Web Speech API (Firefox/Safari fallback)
    """
    model = get_whisper()

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    # Write to temp file — Whisper needs a path, not a buffer
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, fp16=False)
        transcript = result["text"].strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {e}")
    finally:
        os.unlink(tmp_path)

    # If no policy provided, return transcript only
    if not policy_id or policy_id not in policy_store:
        return TranscribeResponse(transcript=transcript, contradiction=False)

    # Run contradiction analysis on full transcript
    rules = policy_store[policy_id]
    contradiction = analyze_chunk(transcript, rules)

    return TranscribeResponse(
        transcript=transcript,
        contradiction=contradiction.contradiction,
        flagged_text=contradiction.flagged_text or None,
        conflicting_rule=contradiction.conflicting_rule or None,
        explanation=contradiction.explanation or None,
    )


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    from backend.config import PORT
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=True)
