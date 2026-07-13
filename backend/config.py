from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "repomind_secret"

    redis_url: str = "redis://localhost:6379"

    chroma_host: str = "localhost"
    chroma_port: int = 8000

    ollama_host: str = "http://localhost:11434"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_chat_model: str = "qwen2.5-coder:7b"

    github_client_id: str = ""
    github_client_secret: str = ""

    groq_api_key: str = ""

    cors_origins: str = "http://localhost:3000"

    repo_clone_dir: str = "/tmp/repos"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
