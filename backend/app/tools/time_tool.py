import json
from datetime import datetime, timezone
from typing import Any

from app.tools.base import Tool


class GetCurrentTimeTool(Tool):
    @property
    def name(self) -> str:
        return "get_current_time"

    @property
    def description(self) -> str:
        return "Get the current date and time in UTC. Use this when the user asks about the current date or time."

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }

    async def execute(self, **kwargs: Any) -> str:
        now = datetime.now(timezone.utc)
        return json.dumps({
            "datetime": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S UTC"),
            "day_of_week": now.strftime("%A"),
        })
