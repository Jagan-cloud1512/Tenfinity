from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = Field(..., min_length=1, max_length=10000)
    mode: str = "auto"
    stream: bool = True


class SourceItem(BaseModel):
    title: str = ""
    url: str = ""


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: list[SourceItem] = []
    tools_used: list[str] = []
    search_performed: bool = False
    provider: str = ""
    model: str = ""


class ConversationInfo(BaseModel):
    id: str
    title: str
    created_at: float
    message_count: int


class ProviderHealth(BaseModel):
    model_config = {"protected_namespaces": ()}

    provider: str
    reachable: bool
    configured: bool = True
    model: str = ""
    latency_ms: int | None = None


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    status: str
    providers: list[ProviderHealth] = []
    search_available: bool
    available_tools: list[str]
    default_mode: str = "auto"
