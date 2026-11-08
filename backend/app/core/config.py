from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """
    Enterprise Configuration for Guardian Copilot Autonomous System.
    Loads from .env, .env.local, and system environment variables.
    """
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Guardian Copilot Enterprise Backend"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ]

    # PayPal Developer Sandbox (REST v2)
    PAYPAL_CLIENT_ID: str = Field(default="", description="PayPal REST v2 Client ID")
    PAYPAL_CLIENT_SECRET: str = Field(default="", description="PayPal REST v2 Secret")
    PAYPAL_BASE_URL: str = Field(
        default="https://api-m.sandbox.paypal.com",
        description="PayPal Sandbox endpoint",
    )
    PAYPAL_TOKEN_BUFFER_SECONDS: int = Field(
        default=60,
        description="Buffer in seconds to refresh OAuth token before expiration",
    )
    DEFAULT_MINIMUM_SAFETY_BALANCE: float = Field(
        default=500.0,
        description="Protected financial buffer floor in USD",
    )

    # Firecrawl Web Scraping Engine
    FIRECRAWL_API_KEY: str = Field(default="", description="Firecrawl API Key")
    FIRECRAWL_API_URL: str = Field(
        default="https://api.firecrawl.dev/v1",
        description="Firecrawl API base endpoint",
    )

    # LLM & AI Engine (Gemini / OpenAI)
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API Key")
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API Key (optional fallback)")
    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key (optional fallback)")

    # Persistence & Checkpointing
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./guardian_copilot.db",
        description="Persistent checkpointer & HITL actions database",
    )
    CHROMA_PERSIST_DIR: str = Field(
        default="./chroma_db",
        description="Directory for local ChromaDB vector store",
    )


settings = Settings()
