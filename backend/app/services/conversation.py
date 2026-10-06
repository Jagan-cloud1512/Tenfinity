import uuid
import time
from typing import Any
from dataclasses import dataclass, field


@dataclass
class Message:
    role: str
    content: str
    timestamp: float = field(default_factory=time.time)
    sources: list[dict[str, Any]] = field(default_factory=list)
    tools_used: list[str] = field(default_factory=list)


@dataclass
class Conversation:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    messages: list[Message] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    title: str = "New Chat"


class ConversationStore:
    """In-memory conversation store. Replace with PostgreSQL later."""

    def __init__(self) -> None:
        self._store: dict[str, Conversation] = {}

    def create(self) -> Conversation:
        conv = Conversation()
        self._store[conv.id] = conv
        return conv

    def get(self, conversation_id: str) -> Conversation | None:
        return self._store.get(conversation_id)

    def get_or_create(self, conversation_id: str | None) -> Conversation:
        if conversation_id and conversation_id in self._store:
            return self._store[conversation_id]
        return self.create()

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: list[dict[str, Any]] | None = None,
        tools_used: list[str] | None = None,
    ) -> Message:
        conv = self._store.get(conversation_id)
        if not conv:
            raise ValueError(f"Conversation {conversation_id} not found")
        msg = Message(
            role=role,
            content=content,
            sources=sources or [],
            tools_used=tools_used or [],
        )
        conv.messages.append(msg)
        if role == "user" and len(conv.messages) == 1:
            conv.title = content[:60] + ("..." if len(content) > 60 else "")
        return msg

    def get_recent_messages(
        self, conversation_id: str, limit: int = 20
    ) -> list[dict[str, str]]:
        conv = self._store.get(conversation_id)
        if not conv:
            return []
        recent = conv.messages[-limit:]
        return [{"role": m.role, "content": m.content} for m in recent]

    def list_conversations(self) -> list[dict[str, Any]]:
        result = []
        for conv in sorted(self._store.values(), key=lambda c: c.created_at, reverse=True):
            result.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "message_count": len(conv.messages),
            })
        return result

    def delete(self, conversation_id: str) -> bool:
        return self._store.pop(conversation_id, None) is not None


conversation_store = ConversationStore()
