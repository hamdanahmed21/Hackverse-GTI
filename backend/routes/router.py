from fastapi import APIRouter
from routes.ai import router as ai_router
from routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])
