from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm_service import LLMService

router = APIRouter()
llm = LLMService()

class PromptRequest(BaseModel):
    prompt: str
    context: dict = {}

@router.post("/run")
async def run_ai(payload: PromptRequest):
    try:
        result = await llm.run(payload.prompt, payload.context)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
