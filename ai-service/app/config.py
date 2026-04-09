from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgress@localhost:5432/carrerforge"
    REDIS_URL: str = "redis://:cantremember@localhost:6379"
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    JSEARCH_API_KEY: str = ""
    INTERNAL_SECRET: str = "careerforge-internal-secret-2025"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
