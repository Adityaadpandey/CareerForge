import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.client import get_pool, close_pool
from app.api import ingest, analyze, interview, jobs

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_pool()
    logger.info("Database pool initialized")
    yield
    # Shutdown
    await close_pool()
    logger.info("Database pool closed")


app = FastAPI(
    title="CareerForge AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Internal secret validation
@app.middleware("http")
async def validate_internal_secret(request: Request, call_next):
    if request.url.path in ("/", "/health", "/docs", "/openapi.json"):
        return await call_next(request)

    secret = request.headers.get("X-Internal-Secret")
    if secret != settings.INTERNAL_SECRET:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    detail = str(exc) if settings.ENVIRONMENT == "development" else "Internal error"
    return JSONResponse(status_code=500, content={"detail": detail})


# Register routers
app.include_router(ingest.router)
app.include_router(analyze.router)
app.include_router(interview.router)
app.include_router(jobs.router)


@app.get("/")
async def root():
    return {"service": "CareerForge AI", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
