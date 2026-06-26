from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    port: int = 8000

    anthropic_api_key: str = "skip"
    groq_api_key: str

    default_llm_provider: str = "groq"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "ai_gateway"
    postgres_user: str = "postgres"
    postgres_password: str = ""

    redis_host: str = "localhost"
    redis_port: int = 6379

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()