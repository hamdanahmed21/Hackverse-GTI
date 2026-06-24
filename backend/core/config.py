from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    SECRET_KEY: str = "changeme"
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./dev.db"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
