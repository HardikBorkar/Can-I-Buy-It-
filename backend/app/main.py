import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.database import db_manager
from backend.app.api.routes import copilot, actions

# Setup enterprise structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("guardian.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for application startup and shutdown."""
    logger.info("Initializing Guardian Copilot Enterprise Backend...")
    # Initialize SQLite database schema
    await db_manager.init_db()
    logger.info("Guardian Copilot Backend is fully operational on port %d", settings.PORT)
    yield
    logger.info("Shutting down Guardian Copilot Backend...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise LangGraph & PayPal REST v2 Autonomous Financial Copilot",
    lifespan=lifespan,
)

# Configure CORS
origins = [origin for origin in settings.CORS_ORIGINS if origin != "*"]
if "http://localhost:3000" not in origins:
    origins.insert(0, "http://localhost:3000")
if "http://127.0.0.1:3000" not in origins:
    origins.append("http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(copilot.router)
app.include_router(actions.router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health status and sandbox connectivity diagnostic."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "paypal_target": settings.PAYPAL_BASE_URL,
        "safety_buffer_floor": settings.DEFAULT_MINIMUM_SAFETY_BALANCE,
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "Guardian Copilot Enterprise Backend",
        "docs_url": "/docs",
        "health_url": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
